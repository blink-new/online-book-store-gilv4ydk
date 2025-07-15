import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Package } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
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

export function Cart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number; description: string } | null>(null)
  const navigate = useNavigate()
  const { toast } = useToast()

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
          try {
            const products = await blink.db.products.list({
              where: { id: item.product_id },
              limit: 1
            })
            
            if (products[0]) {
              // Map database fields to expected interface
              const product = products[0]
              return {
                id: item.id,
                userId: item.user_id,
                productId: item.product_id,
                quantity: item.quantity,
                product: {
                  id: product.id,
                  name: product.name,
                  brand: product.brand || '',
                  price: product.price,
                  imageUrl: product.image_url || '',
                  stockQuantity: product.stock_quantity || 0,
                  condition: product.condition || 'new',
                  category: product.category || ''
                }
              }
            }
            return {
              id: item.id,
              userId: item.user_id,
              productId: item.product_id,
              quantity: item.quantity,
              product: null
            }
          } catch (error) {
            console.error(`Error loading product ${item.product_id}:`, error)
            return {
              id: item.id,
              userId: item.user_id,
              productId: item.product_id,
              quantity: item.quantity,
              product: null
            }
          }
        })
      )

      // Filter out items where product no longer exists
      const validItems = itemsWithProducts.filter(item => item.product !== null)
      setCartItems(validItems)
    } catch (error) {
      console.error('Error loading cart items:', error)
      // Don't show error toast for empty cart - it's normal
      if (error?.message && !error.message.includes('No records found')) {
        toast({
          title: 'Error',
          description: 'Failed to load cart items. Please try again.',
          variant: 'destructive'
        })
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadCartItems()
  }, [loadCartItems])

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return

    try {
      setUpdating(itemId)
      
      // Find the cart item to check stock
      const cartItem = cartItems.find(item => item.id === itemId)
      if (!cartItem || !cartItem.product) {
        toast({
          title: 'Error',
          description: 'Product not found.',
          variant: 'destructive'
        })
        return
      }

      // Check if new quantity exceeds available stock
      if (newQuantity > cartItem.product.stockQuantity) {
        toast({
          title: 'Insufficient Stock',
          description: `Only ${cartItem.product.stockQuantity} items available.`,
          variant: 'destructive'
        })
        return
      }

      await blink.db.cartItems.update(itemId, { quantity: newQuantity })
      
      // Update local state
      setCartItems(items =>
        items.map(item =>
          item.id === itemId ? { ...item, quantity: newQuantity } : item
        )
      )
    } catch (error) {
      console.error('Error updating quantity:', error)
      toast({
        title: 'Error',
        description: 'Failed to update quantity. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setUpdating(null)
    }
  }

  const removeItem = async (itemId: string) => {
    try {
      setUpdating(itemId)
      await blink.db.cartItems.delete(itemId)
      
      // Update local state
      setCartItems(items => items.filter(item => item.id !== itemId))
      
      toast({
        title: 'Removed',
        description: 'Item removed from cart.'
      })
    } catch (error) {
      console.error('Error removing item:', error)
      toast({
        title: 'Error',
        description: 'Failed to remove item. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setUpdating(null)
    }
  }

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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-muted rounded mb-8"></div>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4">
                      <div className="h-20 w-16 bg-muted rounded"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 bg-muted rounded"></div>
                        <div className="h-3 w-1/2 bg-muted rounded"></div>
                        <div className="h-4 w-1/4 bg-muted rounded"></div>
                      </div>
                      <div className="h-8 w-24 bg-muted rounded"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Shopping Cart</h1>
          <div className="text-muted-foreground">
            {calculateItemCount()} {calculateItemCount() === 1 ? 'item' : 'items'}
          </div>
        </div>

        {cartItems.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Your cart is empty</h3>
              <p className="text-muted-foreground mb-6">
                Looks like you haven't added any products to your cart yet.
              </p>
              <Button onClick={() => navigate('/')}>
                Continue Shopping
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {cartItems.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4">
                      {/* Product Image */}
                      <div 
                        className="w-16 h-20 bg-muted rounded flex items-center justify-center flex-shrink-0 cursor-pointer"
                        onClick={() => navigate(`/product/${item.productId}`)}
                      >
                        {item.product?.imageUrl ? (
                          <img 
                            src={item.product.imageUrl} 
                            alt={item.product.name}
                            className="w-full h-full object-cover rounded"
                          />
                        ) : (
                          <Package className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <h3 
                          className="font-semibold line-clamp-2 cursor-pointer hover:text-primary"
                          onClick={() => navigate(`/product/${item.productId}`)}
                        >
                          {item.product?.name}
                        </h3>
                        {item.product?.brand && (
                          <p className="text-sm text-muted-foreground">
                            by {item.product.brand}
                          </p>
                        )}
                        
                        <div className="flex gap-2 mt-1">
                          {item.product?.category && (
                            <Badge variant="secondary" className="text-xs">
                              {item.product.category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </Badge>
                          )}
                          {item.product?.condition && (
                            <Badge variant={item.product.condition === 'new' ? 'default' : 'outline'} className="text-xs">
                              {item.product.condition.charAt(0).toUpperCase() + item.product.condition.slice(1)}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-lg font-bold text-primary mt-1">
                          £{item.product?.price.toFixed(2)}
                        </p>
                        
                        {/* Stock warning */}
                        {item.product && item.quantity > item.product.stockQuantity && (
                          <p className="text-sm text-destructive mt-1">
                            Only {item.product.stockQuantity} in stock
                          </p>
                        )}
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          disabled={updating === item.id || item.quantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        
                        <span className="w-8 text-center font-medium">
                          {item.quantity}
                        </span>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          disabled={
                            updating === item.id || 
                            (item.product && item.quantity >= item.product.stockQuantity)
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Remove Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeItem(item.id)}
                        disabled={updating === item.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal ({calculateItemCount()} items)</span>
                      <span>£{calculateSubtotal().toFixed(2)}</span>
                    </div>
                    {appliedDiscount && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount ({appliedDiscount.code})</span>
                        <span>-£{appliedDiscount.amount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Shipping</span>
                      <span className="text-green-600">Free</span>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>£{calculateTotal().toFixed(2)}</span>
                  </div>

                  {/* Discount Code Section */}
                  <DiscountCode
                    subtotal={calculateSubtotal()}
                    onDiscountApplied={setAppliedDiscount}
                    onDiscountRemoved={() => setAppliedDiscount(null)}
                    appliedDiscount={appliedDiscount}
                  />

                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={() => navigate('/checkout', { state: { appliedDiscount } })}
                    disabled={cartItems.length === 0}
                  >
                    Proceed to Checkout
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>

                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate('/')}
                  >
                    Continue Shopping
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}