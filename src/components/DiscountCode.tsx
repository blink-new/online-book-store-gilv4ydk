import { useState } from 'react'
import { Tag, X, Check } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { useToast } from '../hooks/use-toast'
import { blink } from '../blink/client'

interface DiscountCode {
  id: string
  code: string
  description: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  minimumOrderAmount: number
  maxUses: number
  currentUses: number
  expiresAt: string
  isActive: boolean
}

interface DiscountCodeProps {
  subtotal: number
  onDiscountApplied: (discount: { code: string; amount: number; description: string }) => void
  onDiscountRemoved: () => void
  appliedDiscount?: { code: string; amount: number; description: string } | null
}

export function DiscountCode({ subtotal, onDiscountApplied, onDiscountRemoved, appliedDiscount }: DiscountCodeProps) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const validateAndApplyDiscount = async () => {
    if (!code.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a discount code.',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)
      const user = await blink.auth.me()

      // Find the discount code
      const discountCodes = await blink.db.discountCodes.list({
        where: { 
          code: code.toUpperCase(),
          isActive: "1" // SQLite boolean as string
        },
        limit: 1
      })

      if (discountCodes.length === 0) {
        toast({
          title: 'Invalid Code',
          description: 'The discount code you entered is not valid or has expired.',
          variant: 'destructive'
        })
        return
      }

      const discountCode = discountCodes[0]

      // Check if code has expired
      if (discountCode.expiresAt && new Date(discountCode.expiresAt) < new Date()) {
        toast({
          title: 'Expired Code',
          description: 'This discount code has expired.',
          variant: 'destructive'
        })
        return
      }

      // Check if code has reached max uses
      if (discountCode.maxUses && discountCode.currentUses >= discountCode.maxUses) {
        toast({
          title: 'Code Limit Reached',
          description: 'This discount code has reached its usage limit.',
          variant: 'destructive'
        })
        return
      }

      // Check minimum order amount
      if (subtotal < discountCode.minimumOrderAmount) {
        toast({
          title: 'Minimum Order Not Met',
          description: `This discount requires a minimum order of £${discountCode.minimumOrderAmount.toFixed(2)}.`,
          variant: 'destructive'
        })
        return
      }

      // Check if user has already used this code
      const existingUses = await blink.db.discountCodeUses.list({
        where: { 
          discountCodeId: discountCode.id,
          userId: user.id
        },
        limit: 1
      })

      if (existingUses.length > 0) {
        toast({
          title: 'Already Used',
          description: 'You have already used this discount code.',
          variant: 'destructive'
        })
        return
      }

      // Calculate discount amount
      let discountAmount = 0
      if (discountCode.discountType === 'percentage') {
        discountAmount = (subtotal * discountCode.discountValue) / 100
      } else {
        discountAmount = discountCode.discountValue
      }

      // Don't let discount exceed subtotal
      discountAmount = Math.min(discountAmount, subtotal)

      // Apply the discount
      onDiscountApplied({
        code: discountCode.code,
        amount: discountAmount,
        description: discountCode.description
      })

      setCode('')
      toast({
        title: 'Discount Applied!',
        description: `You saved £${discountAmount.toFixed(2)} with code ${discountCode.code}.`
      })

    } catch (error) {
      console.error('Error applying discount:', error)
      toast({
        title: 'Error',
        description: 'Failed to apply discount code. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const removeDiscount = () => {
    onDiscountRemoved()
    toast({
      title: 'Discount Removed',
      description: 'The discount code has been removed from your order.'
    })
  }

  return (
    <div className="space-y-3">
      {!appliedDiscount ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Have a discount code?</span>
            </div>
            <div className="flex space-x-2 mt-3">
              <Input
                placeholder="Enter discount code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && validateAndApplyDiscount()}
                className="flex-1"
              />
              <Button 
                onClick={validateAndApplyDiscount}
                disabled={loading || !code.trim()}
                size="sm"
              >
                {loading ? 'Applying...' : 'Apply'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Check className="h-4 w-4 text-green-600" />
                <div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      {appliedDiscount.code}
                    </Badge>
                    <span className="text-sm font-medium text-green-800">
                      -£{appliedDiscount.amount.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    {appliedDiscount.description}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={removeDiscount}
                className="text-green-600 hover:text-green-700 hover:bg-green-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}