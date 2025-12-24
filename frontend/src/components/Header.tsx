import { useState } from 'react'
import { useAuthStore } from '@/lib/auth'
import { useNavigate, Link, useLocation } from 'react-router-dom'

export default function Header() {
  const { email, name, logout, isAdminView, canValidate } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = isAdminView()
  const canValidateCompetencies = canValidate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const closeMobileMenu = () => setMobileMenuOpen(false)

  // Check if a link is active
  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard'
    }
    return location.pathname.startsWith(path)
  }

  const navLinkClass = (path: string) => 
    `transition-colors ${isActive(path) 
      ? 'text-primary-600 font-semibold' 
      : 'text-gray-700 hover:text-primary-600'}`

  const mobileNavLinkClass = (path: string) => 
    `block px-4 py-3 text-base transition-colors ${isActive(path)
      ? 'text-primary-600 font-semibold bg-primary-50'
      : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'}`

  return (
    <header className="bg-white shadow relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
            
            <Link to="/dashboard" className="flex items-center gap-2">
              <img src="/logo.png" alt="USI" className="w-10 h-10 object-contain" />
              <span className="text-2xl font-bold text-primary-600 hidden sm:inline">USI</span>
            </Link>
            
            {/* Desktop navigation */}
            <nav className="hidden md:flex space-x-4">
              <Link to="/dashboard" className={navLinkClass('/dashboard')}>
                Tableau de bord
              </Link>
              <Link to="/dashboard/sessions" className={navLinkClass('/dashboard/sessions')}>
                Sessions
              </Link>
              {isAdmin ? (
                <Link to="/dashboard/users" className={navLinkClass('/dashboard/users')}>
                  Utilisateurs
                </Link>
              ) : (
                <Link to="/dashboard/profile" className={navLinkClass('/dashboard/profile')}>
                  Mon Profil
                </Link>
              )}
              <Link to="/dashboard/competences" className={navLinkClass('/dashboard/competences')}>
                Compétences
              </Link>
              {isAdmin && (
                <>
                  <Link to="/dashboard/groups" className={navLinkClass('/dashboard/groups')}>
                    Groupes
                  </Link>
                  <Link to="/dashboard/emails" className={navLinkClass('/dashboard/emails')}>
                    Emails
                  </Link>
                </>
              )}
            </nav>
          </div>
          
          {/* User info - desktop */}
          <div className="hidden sm:flex items-center space-x-4">
            <div className="text-sm text-right">
              <p className="font-medium text-gray-900">{name}</p>
              <p className="text-gray-500 text-xs">{email}</p>
              {isAdmin ? (
                <p className="text-xs text-red-600">Admin</p>
              ) : canValidateCompetencies ? (
                <p className="text-xs text-orange-600">Encadrant</p>
              ) : (
                <p className="text-xs text-blue-600">Membre</p>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-red-600 transition-colors"
            >
              Déconnexion
            </button>
          </div>
          
          {/* Mobile: just logout button */}
          <button
            onClick={handleLogout}
            className="sm:hidden p-2 text-gray-600 hover:text-red-600"
            aria-label="Déconnexion"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Mobile navigation menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-white shadow-lg border-t">
          {/* User info */}
          <div className="px-4 py-3 bg-gray-50 border-b">
            <p className="font-medium text-gray-900">{name}</p>
            <p className="text-gray-500 text-sm">{email}</p>
            {isAdmin ? (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">Admin</span>
            ) : canValidateCompetencies ? (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">Encadrant</span>
            ) : (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">Membre</span>
            )}
          </div>
          
          {/* Navigation links */}
          <nav className="py-2">
            <Link 
              to="/dashboard" 
              className={mobileNavLinkClass('/dashboard')}
              onClick={closeMobileMenu}
            >
              🏠 Tableau de bord
            </Link>
            <Link 
              to="/dashboard/sessions" 
              className={mobileNavLinkClass('/dashboard/sessions')}
              onClick={closeMobileMenu}
            >
              📅 Sessions
            </Link>
            {isAdmin ? (
              <Link 
                to="/dashboard/users" 
                className={mobileNavLinkClass('/dashboard/users')}
                onClick={closeMobileMenu}
              >
                👥 Utilisateurs
              </Link>
            ) : (
              <Link 
                to="/dashboard/profile" 
                className={mobileNavLinkClass('/dashboard/profile')}
                onClick={closeMobileMenu}
              >
                👤 Mon Profil
              </Link>
            )}
            <Link 
              to="/dashboard/competences" 
              className={mobileNavLinkClass('/dashboard/competences')}
              onClick={closeMobileMenu}
            >
              🎯 Compétences
            </Link>
            {isAdmin && (
              <>
                <Link 
                  to="/dashboard/groups" 
                  className={mobileNavLinkClass('/dashboard/groups')}
                  onClick={closeMobileMenu}
                >
                  📁 Groupes
                </Link>
                <Link 
                  to="/dashboard/emails" 
                  className={mobileNavLinkClass('/dashboard/emails')}
                  onClick={closeMobileMenu}
                >
                  ✉️ Emails
                </Link>
              </>
            )}
          </nav>
          
          {/* Logout button in mobile menu */}
          <div className="border-t px-4 py-3">
            <button
              onClick={() => {
                closeMobileMenu()
                handleLogout()
              }}
              className="w-full text-left text-red-600 hover:text-red-700 font-medium"
            >
              🚪 Déconnexion
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
