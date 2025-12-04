import { useAuthStore } from '@/lib/auth'
import { useNavigate, Link } from 'react-router-dom'

export default function Header() {
  const { email, name, logout, isAdminView } = useAuthStore()
  const navigate = useNavigate()
  const isAdmin = isAdminView()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-primary-600">Fosse</h1>
            <nav className="hidden md:flex space-x-4">
              <Link to="/dashboard" className="text-gray-700 hover:text-primary-600 transition-colors">
                Tableau de bord
              </Link>
              <Link to="/dashboard/sessions" className="text-gray-700 hover:text-primary-600 transition-colors">
                Sessions
              </Link>
              {isAdmin ? (
                <Link to="/dashboard/users" className="text-gray-700 hover:text-primary-600 transition-colors">
                  Utilisateurs
                </Link>
              ) : (
                <Link to="/dashboard/profile" className="text-gray-700 hover:text-primary-600 transition-colors">
                  Mon Profil
                </Link>
              )}
              <Link to="/dashboard/competences" className="text-gray-700 hover:text-primary-600 transition-colors">
                Compétences
              </Link>
              {isAdmin && (
                <>
                  <Link to="/dashboard/groups" className="text-gray-700 hover:text-primary-600 transition-colors">
                    Groupes
                  </Link>
                  <Link to="/dashboard/emails" className="text-gray-700 hover:text-primary-600 transition-colors">
                    Emails
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <p className="font-medium text-gray-900">{name}</p>
              <p className="text-gray-500">{email}</p>
              {!isAdmin && (
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
        </div>
      </div>
    </header>
  )
}
