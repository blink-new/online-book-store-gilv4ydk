import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, Filter, Grid, List, Star, ShoppingCart, Package } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Card, CardContent, CardFooter, CardHeader } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Skeleton } from '../components/ui/skeleton'
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

export function HomePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState('name')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterCondition, setFilterCondition] = useState('all')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()

  const searchQuery = searchParams.get('search') || ''

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)
      let query: any = {}

      // Apply search filter
      if (searchQuery) {
        query = {
          OR: [
            { name: { contains: searchQuery } },
            { brand: { contains: searchQuery } },
            { description: { contains: searchQuery } },
            { category: { contains: searchQuery } }
          ]
        }
      }

      // Apply category filter
      if (filterCategory !== 'all') {
        query = searchQuery 
          ? { AND: [query, { category: filterCategory }] }
          : { category: filterCategory }
      }

      // Apply condition filter
      if (filterCondition !== 'all') {
        const conditionQuery = { condition: filterCondition }
        query = query.AND || query.OR || Object.keys(query).length > 0
          ? { AND: [query, conditionQuery] }
          : conditionQuery
      }

      const productsData = await blink.db.products.list({
        where: query,
        orderBy: { [sortBy]: 'asc' },
        limit: 50
      })

      // Map database fields to expected interface - handle snake_case from database
      const mappedProducts = productsData.map(product => ({
        id: product.id,
        name: product.name,
        brand: product.brand || '',
        description: product.description || '',
        price: product.price,
        stockQuantity: product.stock_quantity || 0,
        category: product.category || '',
        imageUrl: product.image_url || '',
        sku: product.sku || '',
        condition: product.condition || 'new',
        weight: product.weight || 0,
        dimensions: product.dimensions || '',
        userId: product.user_id || ''
      }))

      setProducts(mappedProducts)
    } catch (error) {
      console.error('Error loading products:', error)
      toast({
        title: 'Error',
        description: 'Failed to load products. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [searchQuery, sortBy, filterCategory, filterCondition, toast])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const addToCart = async (product: Product) => {
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

      const user = await blink.auth.me()
      
      // Check if item already exists in cart using snake_case field names
      const existingItems = await blink.db.cartItems.list({
        where: { 
          user_id: user.id,
          product_id: product.id
        }
      })

      if (existingItems.length > 0) {
        const newQuantity = existingItems[0].quantity + 1
        
        // Check if new quantity would exceed stock
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
          quantity: 1
        })
      }

      toast({
        title: 'Added to Cart',
        description: `"${product.name}" has been added to your cart.`
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

  const categories = [
    'all', 'electronics', 'clothing', 'books', 'home-garden', 'sports', 
    'toys-games', 'automotive', 'health-beauty', 'jewelry', 'collectibles'
  ]

  const conditions = ['all', 'new', 'used', 'refurbished']

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="p-0">
                <Skeleton className="h-48 w-full" />
              </CardHeader>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2 mb-4" />
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          {searchQuery ? `Search Results for "${searchQuery}"` : 'Browse Products'}
        </h1>
        <p className="text-muted-foreground">
          {products.length} {products.length === 1 ? 'product' : 'products'} found
        </p>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex gap-4 flex-1">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category === 'all' ? 'All Categories' : 
                   category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCondition} onValueChange={setFilterCondition}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Condition" />
            </SelectTrigger>
            <SelectContent>
              {conditions.map((condition) => (
                <SelectItem key={condition} value={condition}>
                  {condition === 'all' ? 'All Conditions' : condition.charAt(0).toUpperCase() + condition.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="brand">Brand</SelectItem>
            <SelectItem value="price">Price</SelectItem>
            <SelectItem value="condition">Condition</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Products Grid/List */}
      {products.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No products found</h3>
          <p className="text-muted-foreground">
            {searchQuery 
              ? 'Try adjusting your search terms or filters.'
              : 'No products are available at the moment.'}
          </p>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
          : 'space-y-4'
        }>
          {products.map((product) => (
            <Card 
              key={product.id} 
              className={`overflow-hidden hover:shadow-lg transition-shadow cursor-pointer ${
                viewMode === 'list' ? 'flex flex-row' : ''
              }`}
              onClick={() => navigate(`/product/${product.id}`)}
            >
              <div className={viewMode === 'list' ? 'w-32 flex-shrink-0' : ''}>
                <div className={`bg-muted flex items-center justify-center ${
                  viewMode === 'list' ? 'h-full' : 'h-48'
                }`}>
                  {product.imageUrl ? (
                    <img 
                      src={product.imageUrl} 
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground text-center p-4">
                      <Package className="h-8 w-8 mx-auto mb-2" />
                      <div className="text-xs">No Image</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 flex flex-col">
                <CardHeader className={viewMode === 'list' ? 'pb-2' : ''}>
                  <h3 className="font-semibold line-clamp-2">{product.name}</h3>
                  {product.brand && (
                    <p className="text-sm text-muted-foreground">by {product.brand}</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {product.category && (
                      <Badge variant="secondary">
                        {product.category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </Badge>
                    )}
                    {product.condition && (
                      <Badge variant={product.condition === 'new' ? 'default' : 'outline'}>
                        {product.condition.charAt(0).toUpperCase() + product.condition.slice(1)}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className={`flex-1 ${viewMode === 'list' ? 'py-0' : ''}`}>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">
                      £{product.price.toFixed(2)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {product.stockQuantity > 0 ? `${product.stockQuantity} in stock` : 'Out of stock'}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className={viewMode === 'list' ? 'pt-2' : ''}>
                  <Button 
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation()
                      addToCart(product)
                    }}
                    disabled={product.stockQuantity === 0}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {product.stockQuantity === 0 ? 'Out of Stock' : 'Add to Cart'}
                  </Button>
                </CardFooter>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}