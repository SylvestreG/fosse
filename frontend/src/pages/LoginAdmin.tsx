import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore, initiateGoogleLogin } from '@/lib/auth'
import { authApi } from '@/lib/api'
import Button from '@/components/Button'
import Toast from '@/components/Toast'

export default function LoginAdmin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setAuth, isAuthenticated } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasProcessedCode, setHasProcessedCode] = useState(false)

  // Extract code from URL
  const code = searchParams.get('code')

  useEffect(() => {
    // If already authenticated, redirect immediately
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
      return
    }

    // Handle OAuth callback code (only once)
    if (code && !loading && !hasProcessedCode) {
      setHasProcessedCode(true)
      handleGoogleCallback(code)
    }
  }, [isAuthenticated, code, navigate])

  const handleGoogleCallback = async (code: string) => {
    setLoading(true)
    try {
      const response = await authApi.googleCallback(code)
      const { token, email, name, is_admin, impersonating } = response.data
      setAuth(token, email, name, is_admin, impersonating)
      // Clear the URL parameters and navigate
      window.history.replaceState({}, '', '/login')
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed')
      // Clear the code from URL on error
      window.history.replaceState({}, '', '/login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-600 mb-2">Fosse</h1>
          <p className="text-gray-600">Gestion de plongée</p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900 text-center">
            Connexion Admin
          </h2>

          <Button
            onClick={initiateGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>{loading ? 'Connexion...' : 'Se connecter avec Google'}</span>
          </Button>

          <p className="text-sm text-gray-500 text-center mt-4">
            Accès réservé aux administrateurs et utilisateurs enregistrés
          </p>
        </div>
      </div>

      {error && (
        <Toast
          message={error}
          type="error"
          onClose={() => setError(null)}
        />
      )}
    </div>
  )
}

