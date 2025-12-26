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
      ? 'text-cyan-400 font-semibold' 
      : 'text-slate-300 hover:text-cyan-400'}`

  const mobileNavLinkClass = (path: string) => 
    `block px-4 py-3 text-base transition-colors ${isActive(path)
      ? 'text-cyan-400 font-semibold bg-slate-700/50'
      : 'text-slate-300 hover:text-cyan-400 hover:bg-slate-700/30'}`

  return (
    <header className="bg-slate-800/50 backdrop-blur-xl border-b border-slate-700/50 relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="USI" className="w-10 h-10 object-contain" />
              <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent hidden sm:inline">USI</span>
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
                  <Link to="/dashboard/level-documents" className={navLinkClass('/dashboard/level-documents')}>
                    Documents
                  </Link>
                  <Link to="/dashboard/validation-logs" className={navLinkClass('/dashboard/validation-logs')}>
                    Logs
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
              <p className="font-medium text-white">{name}</p>
              <p className="text-slate-400 text-xs">{email}</p>
              {isAdmin ? (
                <p className="text-xs text-red-400">Admin</p>
              ) : canValidateCompetencies ? (
                <p className="text-xs text-orange-400">Encadrant</p>
              ) : (
                <p className="text-xs text-cyan-400">Membre</p>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-red-400 transition-colors"
            >
              Déconnexion
            </button>
          </div>
          
          {/* Mobile: just logout button */}
          <button
            onClick={handleLogout}
            className="sm:hidden p-2 text-slate-400 hover:text-red-400"
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
        <div className="md:hidden absolute top-full left-0 right-0 bg-slate-800/95 backdrop-blur-xl shadow-lg border-t border-slate-700/50">
          {/* User info */}
          <div className="px-4 py-3 bg-slate-700/30 border-b border-slate-700/50">
            <p className="font-medium text-white">{name}</p>
            <p className="text-slate-400 text-sm">{email}</p>
            {isAdmin ? (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">Admin</span>
            ) : canValidateCompetencies ? (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded-full">Encadrant</span>
            ) : (
              <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 rounded-full">Membre</span>
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
                  to="/dashboard/level-documents" 
                  className={mobileNavLinkClass('/dashboard/level-documents')}
                  onClick={closeMobileMenu}
                >
                  📄 Documents
                </Link>
                <Link 
                  to="/dashboard/validation-logs" 
                  className={mobileNavLinkClass('/dashboard/validation-logs')}
                  onClick={closeMobileMenu}
                >
                  📋 Logs
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
          <div className="border-t border-slate-700/50 px-4 py-3">
            <button
              onClick={() => {
                closeMobileMenu()
                handleLogout()
              }}
              className="w-full text-left text-red-400 hover:text-red-300 font-medium"
            >
              🚪 Déconnexion
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
