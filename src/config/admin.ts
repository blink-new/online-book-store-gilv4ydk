// Admin configuration
export const ADMIN_CONFIG = {
  // List of admin email addresses
  adminEmails: [
    'kai.jiabo.feng@gmail.com',
    'mustafayare2009@gmail.com'
  ],
  
  // Check if an email is an admin
  isAdmin: (email: string): boolean => {
    return ADMIN_CONFIG.adminEmails.includes(email.toLowerCase())
  }
}