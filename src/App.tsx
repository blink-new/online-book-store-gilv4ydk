import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { blink } from './blink/client'
import { ADMIN_CONFIG } from './config/admin'
import { Toaster } from './components/ui/toaster'
import { Header } from './components/Header'
import { HomePage } from './pages/HomePage'
import { AdminDashboard } from './pages/AdminDashboard'
import { ProductDetails } from './pages/ProductDetails'
import { Cart } from './pages/Cart'
import { Checkout } from './pages/Checkout'

interface User {
  id: string
  email: string
  displayName?: string
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(state.isLoading)
      
      // Check if user is admin using configuration
      if (state.user?.email) {
        setIsAdmin(ADMIN_CONFIG.isAdmin(state.user.email))
      }
    })
    return unsubscribe
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <h1 className="text-3xl font-bold mb-4">Welcome to Universal Marketplace</h1>
          <p className="text-muted-foreground mb-6">
            Your one-stop shop for everything. Buy and sell anything from electronics to books, clothing to home goods.
          </p>
          <button
            onClick={() => blink.auth.login()}
            className="bg-primary text-primary-foreground px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Sign In to Start Shopping
          </button>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <div className="min-h-screen bg-background">
        <Header user={user} isAdmin={isAdmin} />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/product/:id" element={<ProductDetails />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            {isAdmin && (
              <Route path="/admin" element={<AdminDashboard />} />
            )}
          </Routes>
        </main>
        <Toaster />
      </div>
    </Router>
  )
}

export default App