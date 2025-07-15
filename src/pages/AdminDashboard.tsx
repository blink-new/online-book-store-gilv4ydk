import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit, Trash2, Package, DollarSign, Users, TrendingUp, Tag, Percent, Calendar, Wallet } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Switch } from '../components/ui/switch'
import { useToast } from '../hooks/use-toast'
import { blink } from '../blink/client'
import { SellerPayouts } from '../components/SellerPayouts'

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
  createdBy: string
  createdAt: string
}

export function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([])
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([])
  const [loading, setLoading] = useState(true)
  const [discountLoading, setDiscountLoading] = useState(true)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingDiscount, setEditingDiscount] = useState<DiscountCode | null>(null)
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false)
  const [isDiscountDialogOpen, setIsDiscountDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('products')
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalValue: 0,
    lowStock: 0,
    categories: 0
  })
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    description: '',
    price: '',
    stockQuantity: '',
    category: '',
    imageUrl: '',
    sku: '',
    condition: 'new',
    weight: '',
    dimensions: ''
  })

  const [discountFormData, setDiscountFormData] = useState({
    code: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '',
    minimumOrderAmount: '',
    maxUses: '',
    expiresAt: '',
    isActive: true
  })

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)
      const user = await blink.auth.me()
      const productsData = await blink.db.products.list({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' }
      })
      
      // Map database fields to expected interface
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
      calculateStats(mappedProducts)
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
  }, [toast])

  const loadDiscountCodes = useCallback(async () => {
    try {
      setDiscountLoading(true)
      const codes = await blink.db.discountCodes.list({
        orderBy: { created_at: 'desc' }
      })
      
      // Map database fields to expected interface
      const mappedCodes = codes.map(code => ({
        id: code.id,
        code: code.code,
        description: code.description || '',
        discountType: code.discount_type as 'percentage' | 'fixed',
        discountValue: code.discount_value,
        minimumOrderAmount: code.minimum_order_amount || 0,
        maxUses: code.max_uses || 0,
        currentUses: code.current_uses || 0,
        expiresAt: code.expires_at || '',
        isActive: Number(code.is_active) > 0,
        createdBy: code.created_by,
        createdAt: code.created_at
      }))
      
      setDiscountCodes(mappedCodes)
    } catch (error) {
      console.error('Error loading discount codes:', error)
      toast({
        title: 'Error',
        description: 'Failed to load discount codes. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setDiscountLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadProducts()
    loadDiscountCodes()
  }, [loadProducts, loadDiscountCodes])

  const calculateStats = (productsData: Product[]) => {
    const totalProducts = productsData.length
    const totalValue = productsData.reduce((sum, product) => sum + (product.price * product.stockQuantity), 0)
    const lowStock = productsData.filter(product => product.stockQuantity < 5).length
    const categories = new Set(productsData.map(product => product.category)).size

    setStats({ totalProducts, totalValue, lowStock, categories })
  }

  const resetForm = () => {
    setFormData({
      name: '',
      brand: '',
      description: '',
      price: '',
      stockQuantity: '',
      category: '',
      imageUrl: '',
      sku: '',
      condition: 'new',
      weight: '',
      dimensions: ''
    })
    setEditingProduct(null)
  }

  const resetDiscountForm = () => {
    setDiscountFormData({
      code: '',
      description: '',
      discountType: 'percentage',
      discountValue: '',
      minimumOrderAmount: '',
      maxUses: '',
      expiresAt: '',
      isActive: true
    })
    setEditingDiscount(null)
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      brand: product.brand || '',
      description: product.description,
      price: product.price.toString(),
      stockQuantity: product.stockQuantity.toString(),
      category: product.category,
      imageUrl: product.imageUrl,
      sku: product.sku || '',
      condition: product.condition || 'new',
      weight: product.weight?.toString() || '',
      dimensions: product.dimensions || ''
    })
    setIsProductDialogOpen(true)
  }

  const handleEditDiscount = (discount: DiscountCode) => {
    setEditingDiscount(discount)
    setDiscountFormData({
      code: discount.code,
      description: discount.description,
      discountType: discount.discountType,
      discountValue: discount.discountValue.toString(),
      minimumOrderAmount: discount.minimumOrderAmount.toString(),
      maxUses: discount.maxUses?.toString() || '',
      expiresAt: discount.expiresAt ? discount.expiresAt.split(' ')[0] : '',
      isActive: Number(discount.isActive) > 0
    })
    setIsDiscountDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.price) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      })
      return
    }

    try {
      const user = await blink.auth.me()
      const productData = {
        name: formData.name,
        brand: formData.brand,
        description: formData.description,
        price: parseFloat(formData.price),
        stock_quantity: parseInt(formData.stockQuantity) || 0,
        category: formData.category,
        image_url: formData.imageUrl,
        sku: formData.sku,
        condition: formData.condition,
        weight: parseFloat(formData.weight) || null,
        dimensions: formData.dimensions,
        user_id: user.id
      }

      if (editingProduct) {
        await blink.db.products.update(editingProduct.id, productData)
        toast({
          title: 'Success',
          description: 'Product updated successfully.'
        })
      } else {
        await blink.db.products.create({
          id: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ...productData
        })
        toast({
          title: 'Success',
          description: 'Product added successfully.'
        })
      }

      setIsProductDialogOpen(false)
      resetForm()
      loadProducts()
    } catch (error) {
      console.error('Error saving product:', error)
      toast({
        title: 'Error',
        description: 'Failed to save product. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const handleDiscountSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!discountFormData.code || !discountFormData.discountValue) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      })
      return
    }

    try {
      const user = await blink.auth.me()
      const discountData = {
        code: discountFormData.code.toUpperCase(),
        description: discountFormData.description,
        discount_type: discountFormData.discountType,
        discount_value: parseFloat(discountFormData.discountValue),
        minimum_order_amount: parseFloat(discountFormData.minimumOrderAmount) || 0,
        max_uses: parseInt(discountFormData.maxUses) || null,
        expires_at: discountFormData.expiresAt ? `${discountFormData.expiresAt} 23:59:59` : null,
        is_active: discountFormData.isActive ? 1 : 0,
        created_by: user.id
      }

      if (editingDiscount) {
        await blink.db.discountCodes.update(editingDiscount.id, discountData)
        toast({
          title: 'Success',
          description: 'Discount code updated successfully.'
        })
      } else {
        await blink.db.discountCodes.create({
          id: `disc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          current_uses: 0,
          ...discountData
        })
        toast({
          title: 'Success',
          description: 'Discount code created successfully.'
        })
      }

      setIsDiscountDialogOpen(false)
      resetDiscountForm()
      loadDiscountCodes()
    } catch (error) {
      console.error('Error saving discount code:', error)
      toast({
        title: 'Error',
        description: 'Failed to save discount code. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const handleDelete = async (product: Product) => {
    if (!confirm(`Are you sure you want to delete "${product.name}"?`)) {
      return
    }

    try {
      await blink.db.products.delete(product.id)
      toast({
        title: 'Success',
        description: 'Product deleted successfully.'
      })
      loadProducts()
    } catch (error) {
      console.error('Error deleting product:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete product. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteDiscount = async (discount: DiscountCode) => {
    if (!confirm(`Are you sure you want to delete discount code "${discount.code}"?`)) {
      return
    }

    try {
      await blink.db.discountCodes.delete(discount.id)
      toast({
        title: 'Success',
        description: 'Discount code deleted successfully.'
      })
      loadDiscountCodes()
    } catch (error) {
      console.error('Error deleting discount code:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete discount code. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const toggleDiscountStatus = async (discount: DiscountCode) => {
    try {
      const newStatus = Number(discount.isActive) > 0 ? 0 : 1
      await blink.db.discountCodes.update(discount.id, { is_active: newStatus })
      toast({
        title: 'Success',
        description: `Discount code ${newStatus ? 'activated' : 'deactivated'} successfully.`
      })
      loadDiscountCodes()
    } catch (error) {
      console.error('Error updating discount status:', error)
      toast({
        title: 'Error',
        description: 'Failed to update discount status. Please try again.',
        variant: 'destructive'
      })
    }
  }

  const categories = [
    'electronics', 'clothing', 'books', 'home-garden', 'sports', 
    'toys-games', 'automotive', 'health-beauty', 'jewelry', 'collectibles'
  ]

  const conditions = ['new', 'used', 'refurbished']

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage your products and discount codes</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="products" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Products
          </TabsTrigger>
          <TabsTrigger value="discounts" className="flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Discount Codes
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Payouts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Product Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="brand">Brand</Label>
                      <Input
                        id="brand"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="price">Price *</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="stockQuantity">Stock Quantity</Label>
                      <Input
                        id="stockQuantity"
                        type="number"
                        value={formData.stockQuantity}
                        onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="condition">Condition</Label>
                      <Select value={formData.condition} onValueChange={(value) => setFormData({ ...formData, condition: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                        <SelectContent>
                          {conditions.map((condition) => (
                            <SelectItem key={condition} value={condition}>
                              {condition.charAt(0).toUpperCase() + condition.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="sku">SKU</Label>
                      <Input
                        id="sku"
                        value={formData.sku}
                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="weight">Weight (kg)</Label>
                      <Input
                        id="weight"
                        type="number"
                        step="0.01"
                        value={formData.weight}
                        onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="dimensions">Dimensions (L x W x H)</Label>
                      <Input
                        id="dimensions"
                        value={formData.dimensions}
                        onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                        placeholder="e.g., 10cm x 5cm x 2cm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor="imageUrl">Image URL</Label>
                      <Input
                        id="imageUrl"
                        type="url"
                        value={formData.imageUrl}
                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsProductDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingProduct ? 'Update Product' : 'Add Product'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Products</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalProducts}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">£{stats.totalValue.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{stats.lowStock}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Categories</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.categories}</div>
              </CardContent>
            </Card>
          </div>

          {/* Products Table */}
          <Card>
            <CardHeader>
              <CardTitle>Product Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading products...</p>
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No products found</h3>
                  <p className="text-muted-foreground mb-4">Start by adding your first product to the inventory.</p>
                  <Button onClick={() => setIsProductDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Condition</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.brand || '-'}</TableCell>
                          <TableCell>
                            {product.category && (
                              <Badge variant="secondary">
                                {product.category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={product.condition === 'new' ? 'default' : 'outline'}>
                              {product.condition?.charAt(0).toUpperCase() + product.condition?.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>£{product.price.toFixed(2)}</TableCell>
                          <TableCell>{product.stockQuantity}</TableCell>
                          <TableCell>
                            <Badge variant={product.stockQuantity > 5 ? 'default' : product.stockQuantity > 0 ? 'secondary' : 'destructive'}>
                              {product.stockQuantity > 5 ? 'In Stock' : product.stockQuantity > 0 ? 'Low Stock' : 'Out of Stock'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(product)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(product)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discounts" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={isDiscountDialogOpen} onOpenChange={setIsDiscountDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetDiscountForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Discount Code
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {editingDiscount ? 'Edit Discount Code' : 'Create New Discount Code'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleDiscountSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="code">Discount Code *</Label>
                    <Input
                      id="code"
                      value={discountFormData.code}
                      onChange={(e) => setDiscountFormData({ ...discountFormData, code: e.target.value.toUpperCase() })}
                      placeholder="e.g., SAVE20"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={discountFormData.description}
                      onChange={(e) => setDiscountFormData({ ...discountFormData, description: e.target.value })}
                      placeholder="e.g., 20% off for new customers"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="discountType">Discount Type *</Label>
                      <Select value={discountFormData.discountType} onValueChange={(value: 'percentage' | 'fixed') => setDiscountFormData({ ...discountFormData, discountType: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage (%)</SelectItem>
                          <SelectItem value="fixed">Fixed Amount (£)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="discountValue">
                        {discountFormData.discountType === 'percentage' ? 'Percentage *' : 'Amount (£) *'}
                      </Label>
                      <Input
                        id="discountValue"
                        type="number"
                        step={discountFormData.discountType === 'percentage' ? '1' : '0.01'}
                        value={discountFormData.discountValue}
                        onChange={(e) => setDiscountFormData({ ...discountFormData, discountValue: e.target.value })}
                        placeholder={discountFormData.discountType === 'percentage' ? '10' : '20.00'}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="minimumOrderAmount">Minimum Order (£)</Label>
                      <Input
                        id="minimumOrderAmount"
                        type="number"
                        step="0.01"
                        value={discountFormData.minimumOrderAmount}
                        onChange={(e) => setDiscountFormData({ ...discountFormData, minimumOrderAmount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="maxUses">Max Uses</Label>
                      <Input
                        id="maxUses"
                        type="number"
                        value={discountFormData.maxUses}
                        onChange={(e) => setDiscountFormData({ ...discountFormData, maxUses: e.target.value })}
                        placeholder="Unlimited"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="expiresAt">Expiry Date</Label>
                    <Input
                      id="expiresAt"
                      type="date"
                      value={discountFormData.expiresAt}
                      onChange={(e) => setDiscountFormData({ ...discountFormData, expiresAt: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      checked={discountFormData.isActive}
                      onCheckedChange={(checked) => setDiscountFormData({ ...discountFormData, isActive: checked })}
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDiscountDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingDiscount ? 'Update Code' : 'Create Code'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Discount Codes Table */}
          <Card>
            <CardHeader>
              <CardTitle>Discount Codes</CardTitle>
            </CardHeader>
            <CardContent>
              {discountLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading discount codes...</p>
                </div>
              ) : discountCodes.length === 0 ? (
                <div className="text-center py-8">
                  <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No discount codes found</h3>
                  <p className="text-muted-foreground mb-4">Create your first discount code to start offering promotions.</p>
                  <Button onClick={() => setIsDiscountDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Discount Code
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Min. Order</TableHead>
                        <TableHead>Usage</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discountCodes.map((discount) => (
                        <TableRow key={discount.id}>
                          <TableCell className="font-mono font-medium">{discount.code}</TableCell>
                          <TableCell>{discount.description || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              {discount.discountType === 'percentage' ? (
                                <Percent className="h-3 w-3" />
                              ) : (
                                <DollarSign className="h-3 w-3" />
                              )}
                              {discount.discountType === 'percentage' ? 'Percentage' : 'Fixed'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {discount.discountType === 'percentage' 
                              ? `${discount.discountValue}%` 
                              : `£${discount.discountValue.toFixed(2)}`
                            }
                          </TableCell>
                          <TableCell>
                            {discount.minimumOrderAmount > 0 
                              ? `£${discount.minimumOrderAmount.toFixed(2)}` 
                              : 'None'
                            }
                          </TableCell>
                          <TableCell>
                            {discount.currentUses}
                            {discount.maxUses ? ` / ${discount.maxUses}` : ' / ∞'}
                          </TableCell>
                          <TableCell>
                            {discount.expiresAt ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(discount.expiresAt).toLocaleDateString()}
                              </div>
                            ) : (
                              'Never'
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant={Number(discount.isActive) > 0 ? 'default' : 'secondary'}>
                                {Number(discount.isActive) > 0 ? 'Active' : 'Inactive'}
                              </Badge>
                              <Switch
                                checked={Number(discount.isActive) > 0}
                                onCheckedChange={() => toggleDiscountStatus(discount)}
                                size="sm"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditDiscount(discount)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteDiscount(discount)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-6">
          <SellerPayouts />
        </TabsContent>
      </Tabs>
    </div>
  )
}