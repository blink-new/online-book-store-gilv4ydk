import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, Star, Package, Calendar, Hash } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { useToast } from '../hooks/use-toast'
import { blink } from '../blink/client'

interface Book {
  id: string
  title: string
  author: string
  description: string
  price: number
  stockQuantity: number
  category: string
  imageUrl: string
  isbn: string
  publishedDate: string
  userId: string
}

export function BookDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingToCart, setAddingToCart] = useState(false)
  const { toast } = useToast()

  const loadBook = useCallback(async (bookId: string) => {
    try {
      setLoading(true)
      const books = await blink.db.books.list({
        where: { id: bookId },
        limit: 1
      })
      
      if (books.length > 0) {
        setBook(books[0])
      } else {
        toast({
          title: 'Error',
          description: 'Book not found.',
          variant: 'destructive'
        })
        navigate('/')
      }
    } catch (error) {
      console.error('Error loading book:', error)
      toast({
        title: 'Error',
        description: 'Failed to load book details. Please try again.',
        variant: 'destructive'
      })
      navigate('/')
    } finally {
      setLoading(false)
    }
  }, [toast, navigate])

  useEffect(() => {
    if (id) {
      loadBook(id)
    }
  }, [id, loadBook])

  const addToCart = async () => {
    if (!book) return

    try {
      setAddingToCart(true)
      const user = await blink.auth.me()
      
      // Check if item already exists in cart
      const existingItems = await blink.db.cartItems.list({
        where: { 
          AND: [
            { userId: user.id },
            { bookId: book.id }
          ]
        }
      })

      if (existingItems.length > 0) {
        // Update quantity
        await blink.db.cartItems.update(existingItems[0].id, {
          quantity: existingItems[0].quantity + 1
        })
      } else {
        // Add new item
        await blink.db.cartItems.create({
          id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: user.id,
          bookId: book.id,
          quantity: 1
        })
      }

      toast({
        title: 'Added to Cart',
        description: `"${book.title}" has been added to your cart.`
      })
    } catch (error) {
      console.error('Error adding to cart:', error)
      toast({
        title: 'Error',
        description: 'Failed to add item to cart. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setAddingToCart(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="flex items-center mb-6">
            <div className="h-6 w-6 bg-muted rounded mr-2"></div>
            <div className="h-4 w-20 bg-muted rounded"></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="h-96 bg-muted rounded-lg"></div>
            <div className="space-y-4">
              <div className="h-8 w-3/4 bg-muted rounded"></div>
              <div className="h-4 w-1/2 bg-muted rounded"></div>
              <div className="h-6 w-1/4 bg-muted rounded"></div>
              <div className="h-20 w-full bg-muted rounded"></div>
              <div className="h-10 w-full bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Book not found</h1>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Books
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
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Books
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Book Image */}
        <div className="flex justify-center">
          <Card className="overflow-hidden max-w-md w-full">
            <div className="aspect-[3/4] bg-muted flex items-center justify-center">
              {book.imageUrl ? (
                <img 
                  src={book.imageUrl} 
                  alt={book.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground text-center p-8">
                  <div className="text-6xl mb-4">📚</div>
                  <div className="text-lg">No Image Available</div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Book Details */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{book.title}</h1>
            <p className="text-xl text-muted-foreground mb-4">by {book.author}</p>
            
            {book.category && (
              <Badge variant="secondary" className="mb-4">
                {book.category.charAt(0).toUpperCase() + book.category.slice(1)}
              </Badge>
            )}

            <div className="flex items-center space-x-4 mb-6">
              <span className="text-3xl font-bold text-primary">
                £{book.price.toFixed(2)}
              </span>
              <Badge variant={book.stockQuantity > 5 ? 'default' : book.stockQuantity > 0 ? 'secondary' : 'destructive'}>
                {book.stockQuantity > 5 ? 'In Stock' : book.stockQuantity > 0 ? 'Low Stock' : 'Out of Stock'}
              </Badge>
            </div>
          </div>

          {/* Description */}
          {book.description && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground leading-relaxed">
                {book.description}
              </p>
            </div>
          )}

          <Separator />

          {/* Book Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {book.isbn && (
              <div className="flex items-center space-x-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">ISBN</p>
                  <p className="text-sm text-muted-foreground">{book.isbn}</p>
                </div>
              </div>
            )}

            {book.publishedDate && (
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Published</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(book.publishedDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Stock</p>
                <p className="text-sm text-muted-foreground">
                  {book.stockQuantity} {book.stockQuantity === 1 ? 'copy' : 'copies'} available
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Add to Cart */}
          <div className="space-y-4">
            <Button 
              size="lg" 
              className="w-full"
              onClick={addToCart}
              disabled={book.stockQuantity === 0 || addingToCart}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              {addingToCart 
                ? 'Adding to Cart...' 
                : book.stockQuantity === 0 
                  ? 'Out of Stock' 
                  : 'Add to Cart'
              }
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              {book.stockQuantity > 0 && book.stockQuantity <= 5 && (
                <p className="text-amber-600">
                  Only {book.stockQuantity} {book.stockQuantity === 1 ? 'copy' : 'copies'} left in stock!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}