import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { 
  useAuthStore, 
  initializeGoogleOneTap, 
  showGoogleOneTap,
  renderGoogleButton
} from '@/lib/auth'
import { authApi } from '@/lib/api'
import Toast from '@/components/Toast'

type AuthMode = 'login' | 'request-password' | 'forgot-password'

export default function LoginAdmin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setAuth, isAuthenticated, mustChangePassword } = useAuthStore()
  
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasProcessedCode, setHasProcessedCode] = useState(false)
  const googleButtonRef = useRef<HTMLDivElement>(null)

  const code = searchParams.get('code')

  // Handle Google ID token from One Tap
  const handleIdToken = useCallback(async (idToken: string) => {
    setLoading(true)
    try {
      const response = await authApi.googleIdToken(idToken)
      const { token, email, name, is_admin, can_validate_competencies, impersonating, must_change_password } = response.data
      setAuth(token, email, name, is_admin, can_validate_competencies, impersonating, must_change_password)
      navigate(must_change_password ? '/change-password' : '/dashboard', { replace: true })
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Authentification échouée')
    } finally {
      setLoading(false)
    }
  }, [navigate, setAuth])

  // Initialize Google One Tap
  useEffect(() => {
    if (isAuthenticated || code) return

    const initOneTap = async () => {
      try {
        const configRes = await authApi.getConfig()
        const clientId = configRes.data.client_id
        
        await initializeGoogleOneTap(clientId, handleIdToken)
        
        showGoogleOneTap(() => {
          if (googleButtonRef.current) {
            renderGoogleButton('google-signin-button')
          }
        })
      } catch (error) {
        console.error('Failed to init One Tap:', error)
      }
    }
    
    initOneTap()
  }, [isAuthenticated, code, handleIdToken])

  // Handle OAuth callback or redirect if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(mustChangePassword ? '/change-password' : '/dashboard', { replace: true })
      return
    }

    if (code && !loading && !hasProcessedCode) {
      setHasProcessedCode(true)
      handleGoogleCallback(code)
    }
  }, [isAuthenticated, code, navigate, loading, hasProcessedCode, mustChangePassword])

  const handleGoogleCallback = async (code: string) => {
    setLoading(true)
    try {
      const response = await authApi.googleCallback(code)
      const { token, email, name, is_admin, can_validate_competencies, impersonating, must_change_password } = response.data
      setAuth(token, email, name, is_admin, can_validate_competencies, impersonating, must_change_password)
      window.history.replaceState({}, '', '/login')
      navigate(must_change_password ? '/change-password' : '/dashboard', { replace: true })
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Authentification échouée')
      window.history.replaceState({}, '', '/login')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Veuillez remplir tous les champs')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await authApi.login(email, password)
      const { token, email: userEmail, name, is_admin, can_validate_competencies, impersonating, must_change_password } = response.data
      setAuth(token, userEmail, name, is_admin, can_validate_competencies, impersonating, must_change_password)
      navigate(must_change_password ? '/change-password' : '/dashboard', { replace: true })
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Email ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Veuillez entrer votre adresse email')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await authApi.requestPassword(email)
      setSuccess(response.data.message)
      setMode('login')
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl p-8 max-w-md w-full border border-slate-700/50">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            FOSSE
          </h1>
          <p className="text-slate-400 mt-1">Gestion de plongée</p>
        </div>

        {mode === 'login' && (
          <>
            <h2 className="text-xl font-semibold text-white text-center mb-6">
              Connexion
            </h2>

            {/* Email/Password Form */}
            <form onSubmit={handleEmailLogin} className="space-y-4 mb-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/25"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connexion...
                  </span>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>

            {/* Links */}
            <div className="flex justify-between text-sm mb-6">
              <button
                onClick={() => setMode('request-password')}
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Première connexion ?
              </button>
              <button
                onClick={() => setMode('forgot-password')}
                className="text-slate-400 hover:text-slate-300 transition-colors"
              >
                Mot de passe oublié ?
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-slate-800/50 text-slate-400">ou</span>
              </div>
            </div>

            {/* Google Sign-In */}
            <div 
              id="google-signin-button" 
              ref={googleButtonRef}
              className="flex justify-center"
            />
          </>
        )}

        {(mode === 'request-password' || mode === 'forgot-password') && (
          <>
            <h2 className="text-xl font-semibold text-white text-center mb-2">
              {mode === 'request-password' ? 'Première connexion' : 'Mot de passe oublié'}
            </h2>
            <p className="text-slate-400 text-center text-sm mb-6">
              Entrez votre email pour recevoir un mot de passe temporaire
            </p>

            <form onSubmit={handleRequestPassword} className="space-y-4 mb-6">
              <div>
                <label htmlFor="reset-email" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Email
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/25"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Envoi...
                  </span>
                ) : (
                  'Envoyer le mot de passe'
                )}
              </button>
            </form>

            <button
              onClick={() => setMode('login')}
              className="w-full text-center text-cyan-400 hover:text-cyan-300 transition-colors text-sm"
            >
              ← Retour à la connexion
            </button>
          </>
        )}

        {loading && mode === 'login' && code && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-500 border-t-transparent" />
          </div>
        )}
      </div>

      {error && (
        <Toast
          message={error}
          type="error"
          onClose={() => setError(null)}
        />
      )}

      {success && (
        <Toast
          message={success}
          type="success"
          onClose={() => setSuccess(null)}
        />
      )}
    </div>
  )
}
