import { useState } from 'react'
import { useAuthStore } from '@/lib/auth'
import { useThemeStore } from '@/lib/theme'
import { useNavigate, Link, useLocation } from 'react-router-dom'

export default function Header() {
  const { email, name, logout, isAdminView, canValidate } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
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
      : theme === 'dark' ? 'text-slate-300 hover:text-cyan-400' : 'text-gray-600 hover:text-cyan-600'}`

  const mobileNavLinkClass = (path: string) => 
    `block px-4 py-3 text-base transition-colors ${isActive(path)
      ? 'text-cyan-400 font-semibold ' + (theme === 'dark' ? 'bg-slate-700/50' : 'bg-cyan-50')
      : (theme === 'dark' ? 'text-slate-300 hover:text-cyan-400 hover:bg-slate-700/30' : 'text-gray-600 hover:text-cyan-600 hover:bg-gray-100')}`

  return (
    <header className={`backdrop-blur-xl border-b relative z-50 ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white/80 border-gray-200'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`md:hidden p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 ${theme === 'dark' ? 'text-slate-400 hover:bg-slate-700/50' : 'text-gray-500 hover:bg-gray-100'}`}
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
              {isAdmin && (
                <Link to="/dashboard/sorties" className={navLinkClass('/dashboard/sorties')}>
                  Sorties
                </Link>
              )}
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
            {/* Theme toggle button */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-yellow-400 hover:bg-slate-700/50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
              title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            
            <div className="text-sm text-right">
              <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{name}</p>
              <p className={`text-xs ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{email}</p>
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
              className={`px-4 py-2 text-sm font-medium transition-colors ${theme === 'dark' ? 'text-slate-300 hover:text-red-400' : 'text-gray-600 hover:text-red-500'}`}
            >
              Déconnexion
            </button>
          </div>
          
          {/* Mobile: theme toggle + logout button */}
          <div className="sm:hidden flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-yellow-400' : 'text-gray-500 hover:text-gray-700'}`}
              aria-label={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button
              onClick={handleLogout}
              className={`p-2 ${theme === 'dark' ? 'text-slate-400 hover:text-red-400' : 'text-gray-500 hover:text-red-500'}`}
              aria-label="Déconnexion"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile navigation menu */}
      {mobileMenuOpen && (
        <div className={`md:hidden absolute top-full left-0 right-0 backdrop-blur-xl shadow-lg border-t ${theme === 'dark' ? 'bg-slate-800/95 border-slate-700/50' : 'bg-white/95 border-gray-200'}`}>
          {/* User info */}
          <div className={`px-4 py-3 border-b ${theme === 'dark' ? 'bg-slate-700/30 border-slate-700/50' : 'bg-gray-50 border-gray-200'}`}>
            <p className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{name}</p>
            <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>{email}</p>
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
            {isAdmin && (
              <Link 
                to="/dashboard/sorties" 
                className={mobileNavLinkClass('/dashboard/sorties')}
                onClick={closeMobileMenu}
              >
                🌊 Sorties
              </Link>
            )}
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
          <div className={`border-t px-4 py-3 ${theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200'}`}>
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
