import { useAuthStore } from '@/lib/auth'
import { useNavigate } from 'react-router-dom'

export default function Header() {
  const { email, name, logout } = useAuthStore()
  const navigate = useNavigate()

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
              <a href="/dashboard" className="text-gray-700 hover:text-primary-600 transition-colors">
                Tableau de bord
              </a>
              <a href="/dashboard/sessions" className="text-gray-700 hover:text-primary-600 transition-colors">
                Sessions
              </a>
              <a href="/dashboard/users" className="text-gray-700 hover:text-primary-600 transition-colors">
                Utilisateurs
              </a>
              <a href="/dashboard/emails" className="text-gray-700 hover:text-primary-600 transition-colors">
                Emails
              </a>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <p className="font-medium text-gray-900">{name}</p>
              <p className="text-gray-500">{email}</p>
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

