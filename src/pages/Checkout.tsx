import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, CreditCard, MapPin, User, Check, Package } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Separator } from '../components/ui/separator'
import { Badge } from '../components/ui/badge'
import { useToast } from '../hooks/use-toast'
import { blink } from '../blink/client'
import { DiscountCode } from '../components/DiscountCode'

interface CartItem {
  id: string
  userId: string
  productId: string
  quantity: number
  product?: {
    id: string
    name: string
    brand: string
    price: number
    imageUrl: string
    stockQuantity: number
    condition: string
    category: string
  }
}

export function Checkout() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [orderComplete, setOrderComplete] = useState(false)
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number; description: string } | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United Kingdom',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardName: ''
  })

  const loadCartItems = useCallback(async () => {
    try {
      setLoading(true)
      const user = await blink.auth.me()
      
      // Get cart items using snake_case field names for database queries
      const items = await blink.db.cartItems.list({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' }
      })

      // Get product details for each cart item
      const itemsWithProducts = await Promise.all(
        items.map(async (item) => {
          const products = await blink.db.products.list({
            where: { id: item.product_id },
            limit: 1
          })
          
          // Map database fields to expected interface
          return {
            id: item.id,
            userId: item.user_id,
            productId: item.product_id,
            quantity: item.quantity,
            product: products[0] ? {
              id: products[0].id,
              name: products[0].name,
              brand: products[0].brand || '',
              price: products[0].price,
              imageUrl: products[0].image_url || '',
              stockQuantity: products[0].stock_quantity || 0,
              condition: products[0].condition || 'new',
              category: products[0].category || ''
            } : null
          }
        })
      )

      // Filter out items where product no longer exists
      const validItems = itemsWithProducts.filter(item => item.product !== null)
      setCartItems(validItems)

      // If cart is empty, redirect to cart page
      if (validItems.length === 0) {
        navigate('/cart')
      }
    } catch (error) {
      console.error('Error loading cart items:', error)
      toast({
        title: 'Error',
        description: 'Failed to load cart items. Please try again.',
        variant: 'destructive'
      })
      navigate('/cart')
    } finally {
      setLoading(false)
    }
  }, [toast, navigate])

  useEffect(() => {
    loadCartItems()
  }, [loadCartItems])

  const calculateSubtotal = () => {
    return cartItems.reduce((total, item) => {
      return total + (item.product?.price || 0) * item.quantity
    }, 0)
  }

  const calculateTotal = () => {
    const subtotal = calculateSubtotal()
    const discountAmount = appliedDiscount?.amount || 0
    return Math.max(0, subtotal - discountAmount)
  }

  const calculateItemCount = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.address) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      })
      return
    }

    try {
      setProcessing(true)
      const user = await blink.auth.me()
      
      // Validate stock levels before processing order
      const stockValidationErrors = []
      for (const item of cartItems) {
        if (!item.product) {
          stockValidationErrors.push(`Product not found for cart item`)
          continue
        }

        // Get fresh product data to check current stock
        const currentProducts = await blink.db.products.list({
          where: { id: item.productId },
          limit: 1
        })

        if (currentProducts.length === 0) {
          stockValidationErrors.push(`Product "${item.product.name}" is no longer available`)
          continue
        }

        const currentStock = currentProducts[0].stock_quantity || 0
        if (currentStock < item.quantity) {
          stockValidationErrors.push(`Insufficient stock for "${item.product.name}". Only ${currentStock} available, but ${item.quantity} requested.`)
        }
      }

      if (stockValidationErrors.length > 0) {
        toast({
          title: 'Stock Validation Failed',
          description: stockValidationErrors.join(' '),
          variant: 'destructive'
        })
        return
      }
      
      // Create order
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const shippingAddress = `${formData.address}, ${formData.city}, ${formData.state} ${formData.zipCode}, ${formData.country}`
      const subtotal = calculateSubtotal()
      const discountAmount = appliedDiscount?.amount || 0
      const totalAmount = calculateTotal()
      
      await blink.db.orders.create({
        id: orderId,
        user_id: user.id,
        total_amount: totalAmount,
        subtotal_amount: subtotal,
        discount_amount: discountAmount,
        discount_code: appliedDiscount?.code || null,
        status: 'completed',
        shipping_address: shippingAddress
      })

      // Create order items, update stock, and create seller earnings
      for (const item of cartItems) {
        await blink.db.orderItems.create({
          id: `orderitem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          order_id: orderId,
          product_id: item.productId,
          quantity: item.quantity,
          price: item.product?.price || 0
        })

        // Update product stock using snake_case field name
        if (item.product) {
          const newStock = Math.max(0, item.product.stockQuantity - item.quantity)
          await blink.db.products.update(item.productId, {
            stock_quantity: newStock
          })

          // Create seller earnings record
          const unitPrice = item.product.price
          const totalEarnings = unitPrice * item.quantity
          const commissionRate = 0.05 // 5% platform commission
          const commissionAmount = totalEarnings * commissionRate
          const netEarnings = totalEarnings - commissionAmount

          // Get product to find seller_id
          const products = await blink.db.products.list({
            where: { id: item.productId },
            limit: 1
          })

          if (products.length > 0) {
            await blink.db.sellerEarnings.create({
              id: `earning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              seller_id: products[0].user_id,
              order_id: orderId,
              product_id: item.productId,
              quantity: item.quantity,
              unit_price: unitPrice,
              total_earnings: totalEarnings,
              commission_rate: commissionRate,
              commission_amount: commissionAmount,
              net_earnings: netEarnings,
              status: 'available' // Available for payout after order completion
            })
          }
        }
      }

      // Record discount usage if applied
      if (appliedDiscount) {
        const discountCodes = await blink.db.discountCodes.list({
          where: { code: appliedDiscount.code },
          limit: 1
        })

        if (discountCodes.length > 0) {
          const discountCode = discountCodes[0]
          
          // Record the usage
          await blink.db.discountCodeUses.create({
            id: `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            discount_code_id: discountCode.id,
            user_id: user.id,
            order_id: orderId,
            discount_amount: appliedDiscount.amount
          })

          // Update usage count
          await blink.db.discountCodes.update(discountCode.id, {
            current_uses: (discountCode.current_uses || 0) + 1
          })
        }
      }

      // Clear cart
      for (const item of cartItems) {
        await blink.db.cartItems.delete(item.id)
      }

      setOrderComplete(true)
      toast({
        title: 'Order Placed!',
        description: 'Your order has been successfully placed.'
      })
    } catch (error) {
      console.error('Error processing order:', error)
      toast({
        title: 'Error',
        description: 'Failed to process order. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  useEffect(() => {
    if (location.state?.appliedDiscount) {
      setAppliedDiscount(location.state.appliedDiscount)
    }
  }, [location.state])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-muted rounded mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="h-64 bg-muted rounded"></div>
                <div className="h-48 bg-muted rounded"></div>
              </div>
              <div className="h-96 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (orderComplete) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <Card>
            <CardContent className="py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold mb-4">Order Confirmed!</h1>
              <p className="text-muted-foreground mb-8">
                Thank you for your purchase. Your order has been successfully placed and will be processed shortly.
              </p>
              <div className="space-y-4">
                <Button onClick={() => navigate('/')} className="w-full">
                  Continue Shopping
                </Button>
                <Button variant="outline" onClick={() => navigate('/cart')} className="w-full">
                  View Cart
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/cart')}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cart
          </Button>
          <h1 className="text-3xl font-bold">Checkout</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Checkout Form */}
            <div className="space-y-6">
              {/* Shipping Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    Shipping Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Address *</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      required
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State/County *</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="zipCode">Postal Code *</Label>
                      <Input
                        id="zipCode"
                        value={formData.zipCode}
                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        disabled
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <CreditCard className="h-5 w-5 mr-2" />
                    Payment Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="cardName">Name on Card *</Label>
                    <Input
                      id="cardName"
                      value={formData.cardName}
                      onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cardNumber">Card Number *</Label>
                    <Input
                      id="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      value={formData.cardNumber}
                      onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="expiryDate">Expiry Date *</Label>
                      <Input
                        id="expiryDate"
                        placeholder="MM/YY"
                        value={formData.expiryDate}
                        onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="cvv">CVV *</Label>
                      <Input
                        id="cvv"
                        placeholder="123"
                        value={formData.cvv}
                        onChange={(e) => setFormData({ ...formData, cvv: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div>
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Order Items */}
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex items-center space-x-3">
                        <div className="w-12 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
                          {item.product?.imageUrl ? (
                            <img 
                              src={item.product.imageUrl} 
                              alt={item.product.name}
                              className="w-full h-full object-cover rounded"
                            />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm line-clamp-2">
                            {item.product?.name}
                          </p>
                          {item.product?.brand && (
                            <p className="text-xs text-muted-foreground">
                              by {item.product.brand}
                            </p>
                          )}
                          <div className="flex gap-1 mt-1">
                            {item.product?.condition && (
                              <Badge variant={item.product.condition === 'new' ? 'default' : 'outline'} className="text-xs">
                                {item.product.condition.charAt(0).toUpperCase() + item.product.condition.slice(1)}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Qty: {item.quantity}
                          </p>
                        </div>
                        <div className="text-sm font-medium">
                          £{((item.product?.price || 0) * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  {/* Totals */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal ({calculateItemCount()} items)</span>
                      <span>£{calculateSubtotal().toFixed(2)}</span>
                    </div>
                    {appliedDiscount && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount ({appliedDiscount.code})</span>
                        <span>-£{appliedDiscount.amount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span>Shipping</span>
                      <span className="text-green-600">Free</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax</span>
                      <span>£0.00</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>£{calculateTotal().toFixed(2)}</span>
                  </div>

                  {/* Discount Code Section - only show if no discount applied yet */}
                  {!appliedDiscount && (
                    <DiscountCode
                      subtotal={calculateSubtotal()}
                      onDiscountApplied={setAppliedDiscount}
                      onDiscountRemoved={() => setAppliedDiscount(null)}
                      appliedDiscount={appliedDiscount}
                    />
                  )}

                  <Button 
                    type="submit"
                    className="w-full" 
                    size="lg"
                    disabled={processing || cartItems.length === 0}
                  >
                    {processing ? 'Processing...' : 'Place Order'}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    By placing your order, you agree to our terms and conditions.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}