import { useState, useEffect, useCallback } from 'react'
import { DollarSign, TrendingUp, Clock, CheckCircle, XCircle, Download, CreditCard, Banknote, Wallet } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Separator } from './ui/separator'
import { useToast } from '../hooks/use-toast'
import { blink } from '../blink/client'

interface SellerEarning {
  id: string
  sellerId: string
  orderId: string
  productId: string
  quantity: number
  unitPrice: number
  totalEarnings: number
  commissionRate: number
  commissionAmount: number
  netEarnings: number
  status: string
  createdAt: string
  product?: {
    name: string
    imageUrl: string
  }
}

interface PayoutRequest {
  id: string
  sellerId: string
  amount: number
  status: string
  paymentMethod: string
  paymentDetails: string
  requestedAt: string
  processedAt?: string
  processedBy?: string
  notes?: string
}

interface PayoutStats {
  totalEarnings: number
  availableBalance: number
  pendingPayouts: number
  completedPayouts: number
}

export function SellerPayouts() {
  const [earnings, setEarnings] = useState<SellerEarning[]>([])
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([])
  const [stats, setStats] = useState<PayoutStats>({
    totalEarnings: 0,
    availableBalance: 0,
    pendingPayouts: 0,
    completedPayouts: 0
  })
  const [loading, setLoading] = useState(true)
  const [isPayoutDialogOpen, setIsPayoutDialogOpen] = useState(false)
  const [processingPayout, setProcessingPayout] = useState(false)
  const { toast } = useToast()

  const [payoutFormData, setPayoutFormData] = useState({
    amount: '',
    paymentMethod: 'bank_transfer',
    bankName: '',
    accountNumber: '',
    sortCode: '',
    accountHolderName: '',
    paypalEmail: '',
    notes: ''
  })

  const loadEarnings = useCallback(async () => {
    try {
      const user = await blink.auth.me()
      
      // Get seller earnings
      const earningsData = await blink.db.sellerEarnings.list({
        where: { sellerId: user.id },
        orderBy: { createdAt: 'desc' }
      })

      // Get product details for each earning
      const earningsWithProducts = await Promise.all(
        earningsData.map(async (earning) => {
          const products = await blink.db.products.list({
            where: { id: earning.productId },
            limit: 1
          })
          return {
            ...earning,
            product: products[0] || null
          }
        })
      )

      setEarnings(earningsWithProducts)
      
      // Calculate stats
      const totalEarnings = earningsWithProducts.reduce((sum, earning) => sum + earning.netEarnings, 0)
      const availableBalance = earningsWithProducts
        .filter(earning => earning.status === 'available')
        .reduce((sum, earning) => sum + earning.netEarnings, 0)

      setStats(prev => ({
        ...prev,
        totalEarnings,
        availableBalance
      }))
    } catch (error) {
      console.error('Error loading earnings:', error)
      toast({
        title: 'Error',
        description: 'Failed to load earnings. Please try again.',
        variant: 'destructive'
      })
    }
  }, [toast])

  const loadPayoutRequests = useCallback(async () => {
    try {
      const user = await blink.auth.me()
      
      const requests = await blink.db.payoutRequests.list({
        where: { sellerId: user.id },
        orderBy: { requestedAt: 'desc' }
      })

      setPayoutRequests(requests)

      // Update stats
      const pendingPayouts = requests.filter(req => req.status === 'pending').length
      const completedPayouts = requests.filter(req => req.status === 'completed').length

      setStats(prev => ({
        ...prev,
        pendingPayouts,
        completedPayouts
      }))
    } catch (error) {
      console.error('Error loading payout requests:', error)
      toast({
        title: 'Error',
        description: 'Failed to load payout requests. Please try again.',
        variant: 'destructive'
      })
    }
  }, [toast])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([loadEarnings(), loadPayoutRequests()])
      setLoading(false)
    }
    loadData()
  }, [loadEarnings, loadPayoutRequests])

  const handlePayoutRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const requestAmount = parseFloat(payoutFormData.amount)
    if (!requestAmount || requestAmount <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid amount.',
        variant: 'destructive'
      })
      return
    }

    if (requestAmount > stats.availableBalance) {
      toast({
        title: 'Error',
        description: 'Insufficient available balance.',
        variant: 'destructive'
      })
      return
    }

    try {
      setProcessingPayout(true)
      const user = await blink.auth.me()

      // Prepare payment details based on method
      let paymentDetails = {}
      if (payoutFormData.paymentMethod === 'bank_transfer') {
        paymentDetails = {
          bankName: payoutFormData.bankName,
          accountNumber: payoutFormData.accountNumber,
          sortCode: payoutFormData.sortCode,
          accountHolderName: payoutFormData.accountHolderName
        }
      } else if (payoutFormData.paymentMethod === 'paypal') {
        paymentDetails = {
          paypalEmail: payoutFormData.paypalEmail
        }
      }

      // Create payout request
      const payoutRequestId = `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      await blink.db.payoutRequests.create({
        id: payoutRequestId,
        sellerId: user.id,
        amount: requestAmount,
        status: 'pending',
        paymentMethod: payoutFormData.paymentMethod,
        paymentDetails: JSON.stringify(paymentDetails),
        notes: payoutFormData.notes
      })

      // Get available earnings to allocate to this payout
      const availableEarnings = earnings.filter(earning => earning.status === 'available')
      let remainingAmount = requestAmount

      for (const earning of availableEarnings) {
        if (remainingAmount <= 0) break

        const allocationAmount = Math.min(remainingAmount, earning.netEarnings)
        
        // Create payout item
        await blink.db.payoutItems.create({
          id: `payoutitem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          payoutRequestId,
          sellerEarningId: earning.id,
          amount: allocationAmount
        })

        // Update earning status to pending payout
        await blink.db.sellerEarnings.update(earning.id, {
          status: 'pending_payout'
        })

        remainingAmount -= allocationAmount
      }

      toast({
        title: 'Success',
        description: 'Payout request submitted successfully. We will process it within 3-5 business days.'
      })

      setIsPayoutDialogOpen(false)
      setPayoutFormData({
        amount: '',
        paymentMethod: 'bank_transfer',
        bankName: '',
        accountNumber: '',
        sortCode: '',
        accountHolderName: '',
        paypalEmail: '',
        notes: ''
      })

      // Reload data
      await Promise.all([loadEarnings(), loadPayoutRequests()])
    } catch (error) {
      console.error('Error creating payout request:', error)
      toast({
        title: 'Error',
        description: 'Failed to create payout request. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setProcessingPayout(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'approved':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>
      case 'completed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'bank_transfer':
        return <Banknote className="h-4 w-4" />
      case 'paypal':
        return <Wallet className="h-4 w-4" />
      case 'stripe':
        return <CreditCard className="h-4 w-4" />
      default:
        return <DollarSign className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{stats.totalEarnings.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">All time earnings</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">£{stats.availableBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Ready for payout</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pendingPayouts}</div>
            <p className="text-xs text-muted-foreground">Being processed</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Payouts</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedPayouts}</div>
            <p className="text-xs text-muted-foreground">Successfully paid</p>
          </CardContent>
        </Card>
      </div>

      {/* Payout Request Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Seller Payouts</h2>
          <p className="text-muted-foreground">Manage your earnings and request payouts</p>
        </div>
        <Dialog open={isPayoutDialogOpen} onOpenChange={setIsPayoutDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={stats.availableBalance <= 0}>
              <Download className="h-4 w-4 mr-2" />
              Request Payout
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Request Payout</DialogTitle>
            </DialogHeader>
            <form onSubmit={handlePayoutRequest} className="space-y-4">
              <div>
                <Label htmlFor="amount">Amount (£) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  max={stats.availableBalance}
                  value={payoutFormData.amount}
                  onChange={(e) => setPayoutFormData({ ...payoutFormData, amount: e.target.value })}
                  placeholder={`Max: £${stats.availableBalance.toFixed(2)}`}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Available balance: £{stats.availableBalance.toFixed(2)}
                </p>
              </div>

              <div>
                <Label htmlFor="paymentMethod">Payment Method *</Label>
                <Select 
                  value={payoutFormData.paymentMethod} 
                  onValueChange={(value) => setPayoutFormData({ ...payoutFormData, paymentMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {payoutFormData.paymentMethod === 'bank_transfer' && (
                <>
                  <div>
                    <Label htmlFor="accountHolderName">Account Holder Name *</Label>
                    <Input
                      id="accountHolderName"
                      value={payoutFormData.accountHolderName}
                      onChange={(e) => setPayoutFormData({ ...payoutFormData, accountHolderName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="sortCode">Sort Code *</Label>
                      <Input
                        id="sortCode"
                        placeholder="12-34-56"
                        value={payoutFormData.sortCode}
                        onChange={(e) => setPayoutFormData({ ...payoutFormData, sortCode: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="accountNumber">Account Number *</Label>
                      <Input
                        id="accountNumber"
                        placeholder="12345678"
                        value={payoutFormData.accountNumber}
                        onChange={(e) => setPayoutFormData({ ...payoutFormData, accountNumber: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bankName">Bank Name *</Label>
                    <Input
                      id="bankName"
                      value={payoutFormData.bankName}
                      onChange={(e) => setPayoutFormData({ ...payoutFormData, bankName: e.target.value })}
                      required
                    />
                  </div>
                </>
              )}

              {payoutFormData.paymentMethod === 'paypal' && (
                <div>
                  <Label htmlFor="paypalEmail">PayPal Email *</Label>
                  <Input
                    id="paypalEmail"
                    type="email"
                    value={payoutFormData.paypalEmail}
                    onChange={(e) => setPayoutFormData({ ...payoutFormData, paypalEmail: e.target.value })}
                    required
                  />
                </div>
              )}

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={payoutFormData.notes}
                  onChange={(e) => setPayoutFormData({ ...payoutFormData, notes: e.target.value })}
                  placeholder="Any additional information..."
                  rows={3}
                />
              </div>

              <Separator />

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Payout Information</h4>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>• Processing time: 3-5 business days</p>
                  <p>• Platform commission: 5% (already deducted)</p>
                  <p>• Minimum payout: £10.00</p>
                  <p>• No additional fees for bank transfers</p>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsPayoutDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={processingPayout}>
                  {processingPayout ? 'Processing...' : 'Submit Request'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Payout Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
        </CardHeader>
        <CardContent>
          {payoutRequests.length === 0 ? (
            <div className="text-center py-8">
              <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No payout requests yet</h3>
              <p className="text-muted-foreground mb-4">
                When you have available earnings, you can request a payout here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Processed</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payoutRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        {new Date(request.requestedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="font-medium">
                        £{request.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPaymentMethodIcon(request.paymentMethod)}
                          <span className="capitalize">
                            {request.paymentMethod.replace('_', ' ')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(request.status)}
                      </TableCell>
                      <TableCell>
                        {request.processedAt 
                          ? new Date(request.processedAt).toLocaleDateString()
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        {request.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Earnings Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Earnings Details</CardTitle>
        </CardHeader>
        <CardContent>
          {earnings.length === 0 ? (
            <div className="text-center py-8">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No earnings yet</h3>
              <p className="text-muted-foreground">
                Start selling products to see your earnings here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Net Earnings</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earnings.map((earning) => (
                    <TableRow key={earning.id}>
                      <TableCell>
                        {new Date(earning.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
                            {earning.product?.imageUrl ? (
                              <img 
                                src={earning.product.imageUrl} 
                                alt={earning.product.name}
                                className="w-full h-full object-cover rounded"
                              />
                            ) : (
                              <DollarSign className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <span className="font-medium">
                            {earning.product?.name || 'Product'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{earning.quantity}</TableCell>
                      <TableCell>£{earning.unitPrice.toFixed(2)}</TableCell>
                      <TableCell>£{earning.totalEarnings.toFixed(2)}</TableCell>
                      <TableCell className="text-red-600">
                        -£{earning.commissionAmount.toFixed(2)} ({(earning.commissionRate * 100).toFixed(1)}%)
                      </TableCell>
                      <TableCell className="font-medium text-green-600">
                        £{earning.netEarnings.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={earning.status === 'available' ? 'default' : 'secondary'}>
                          {earning.status === 'available' ? 'Available' : 
                           earning.status === 'pending_payout' ? 'Pending Payout' : 
                           earning.status === 'paid_out' ? 'Paid Out' : earning.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}