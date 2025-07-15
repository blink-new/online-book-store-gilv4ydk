import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, Package, Star, Truck, Shield, RotateCcw } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { useToast } from '../hooks/use-toast'
import { blink } from '../blink/client'

interface Product {
  id: string
  name: string
  brand: string
  description: string
  price: number
  stockQuantity: number
  category: string
  imageUrl: string
  sku: string
  condition: string
  weight: number
  dimensions: string
  userId: string
}

export function ProductDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const { toast } = useToast()

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) return

      try {
        setLoading(true)
        const products = await blink.db.products.list({
          where: { id },
          limit: 1
        })

        if (products.length > 0) {
          // Map database fields to expected interface - handle snake_case from database
          const productData = products[0]
          const mappedProduct = {
            id: productData.id,
            name: productData.name,
            brand: productData.brand || '',
            description: productData.description || '',
            price: productData.price,
            stockQuantity: productData.stock_quantity || 0,
            category: productData.category || '',
            imageUrl: productData.image_url || '',
            sku: productData.sku || '',
            condition: productData.condition || 'new',
            weight: productData.weight || 0,
            dimensions: productData.dimensions || '',
            userId: productData.user_id || ''
          }
          setProduct(mappedProduct)
        } else {
          toast({
            title: 'Product Not Found',
            description: 'The product you are looking for does not exist.',
            variant: 'destructive'
          })
          navigate('/')
        }
      } catch (error) {
        console.error('Error loading product:', error)
        toast({
          title: 'Error',
          description: 'Failed to load product details. Please try again.',
          variant: 'destructive'
        })
      } finally {
        setLoading(false)
      }
    }

    loadProduct()
  }, [id, navigate, toast])

  const addToCart = async () => {
    if (!product) return

    try {
      // Check if product is out of stock
      if (product.stockQuantity <= 0) {
        toast({
          title: 'Out of Stock',
          description: `"${product.name}" is currently out of stock.`,
          variant: 'destructive'
        })
        return
      }

      // Check if requested quantity exceeds stock
      if (quantity > product.stockQuantity) {
        toast({
          title: 'Insufficient Stock',
          description: `Only ${product.stockQuantity} items available.`,
          variant: 'destructive'
        })
        return
      }

      const user = await blink.auth.me()
      
      // Check if item already exists in cart using snake_case field names
      const existingItems = await blink.db.cartItems.list({
        where: { 
          user_id: user.id,
          product_id: product.id
        }
      })

      if (existingItems.length > 0) {
        const newQuantity = existingItems[0].quantity + quantity
        
        // Check if new total quantity would exceed stock
        if (newQuantity > product.stockQuantity) {
          toast({
            title: 'Insufficient Stock',
            description: `Only ${product.stockQuantity} items available. You already have ${existingItems[0].quantity} in your cart.`,
            variant: 'destructive'
          })
          return
        }

        // Update quantity
        await blink.db.cartItems.update(existingItems[0].id, {
          quantity: newQuantity
        })
      } else {
        // Add new item using snake_case field names
        await blink.db.cartItems.create({
          id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          user_id: user.id,
          product_id: product.id,
          quantity
        })
      }

      toast({
        title: 'Added to Cart',
        description: `${quantity} x "${product.name}" has been added to your cart.`
      })
    } catch (error) {
      console.error('Error adding to cart:', error)
      toast({
        title: 'Error',
        description: 'Failed to add item to cart. Please try again.',
        variant: 'destructive'
      })
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-32 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="h-96 bg-muted rounded"></div>
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
              <div className="h-6 bg-muted rounded w-1/4"></div>
              <div className="h-20 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Product Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The product you are looking for does not exist.
          </p>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        onClick={() => navigate('/')}
        className="mb-8"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Products
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Product Image */}
        <div className="space-y-4">
          <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
            {product.imageUrl ? (
              <img 
                src={product.imageUrl} 
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center text-muted-foreground">
                <Package className="h-16 w-16 mx-auto mb-4" />
                <p>No image available</p>
              </div>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
            {product.brand && (
              <p className="text-lg text-muted-foreground mb-4">by {product.brand}</p>
            )}
            
            <div className="flex gap-2 mb-4">
              {product.category && (
                <Badge variant="secondary">
                  {product.category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </Badge>
              )}
              <Badge variant={product.condition === 'new' ? 'default' : 'outline'}>
                {product.condition?.charAt(0).toUpperCase() + product.condition?.slice(1)}
              </Badge>
              {product.sku && (
                <Badge variant="outline">SKU: {product.sku}</Badge>
              )}
            </div>

            <div className="text-3xl font-bold text-primary mb-4">
              £{product.price.toFixed(2)}
            </div>

            <div className="flex items-center gap-4 mb-6">
              <span className={`text-sm ${product.stockQuantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {product.stockQuantity > 0 ? `${product.stockQuantity} in stock` : 'Out of stock'}
              </span>
            </div>
          </div>

          {/* Add to Cart */}
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label htmlFor="quantity" className="text-sm font-medium">
                Quantity:
              </label>
              <select
                id="quantity"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value))}
                className="border rounded px-3 py-1"
                disabled={product.stockQuantity === 0}
              >
                {Array.from({ length: Math.min(10, product.stockQuantity) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>

            <Button 
              onClick={addToCart}
              disabled={product.stockQuantity === 0}
              className="w-full"
              size="lg"
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              {product.stockQuantity === 0 ? 'Out of Stock' : 'Add to Cart'}
            </Button>
          </div>

          {/* Product Details */}
          <Card>
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {product.description && (
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-muted-foreground">{product.description}</p>
                </div>
              )}
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                {product.weight && (
                  <div>
                    <span className="font-medium">Weight:</span>
                    <span className="ml-2 text-muted-foreground">{product.weight}kg</span>
                  </div>
                )}
                {product.dimensions && (
                  <div>
                    <span className="font-medium">Dimensions:</span>
                    <span className="ml-2 text-muted-foreground">{product.dimensions}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Shipping & Returns */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Free Shipping</p>
                    <p className="text-sm text-muted-foreground">On orders over £50</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Secure Payment</p>
                    <p className="text-sm text-muted-foreground">Your payment information is safe</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <RotateCcw className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">30-Day Returns</p>
                    <p className="text-sm text-muted-foreground">Easy returns and exchanges</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}