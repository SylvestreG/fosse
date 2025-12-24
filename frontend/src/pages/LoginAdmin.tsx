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

  // Initialize Google One Tap and always render button
  useEffect(() => {
    if (isAuthenticated || code) return

    const initOneTap = async () => {
      try {
        const configRes = await authApi.getConfig()
        const clientId = configRes.data.client_id
        
        await initializeGoogleOneTap(clientId, handleIdToken)
        
        // Always render the button (in addition to One Tap popup)
        if (googleButtonRef.current) {
          renderGoogleButton('google-signin-button')
        }
        
        // Also show One Tap prompt
        showGoogleOneTap()
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

  // Fallback: redirect to Google OAuth URL
  const handleGoogleFallback = async () => {
    try {
      const configRes = await authApi.getConfig()
      const clientId = configRes.data.client_id
      const redirectUri = `${window.location.origin}/fosse/login`
      const scope = 'openid email profile'
      
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scope)}` +
        `&access_type=offline` +
        `&prompt=select_account`
      
      window.location.href = googleAuthUrl
    } catch (err) {
      console.error('Failed to build Google auth URL:', err)
      setError('Impossible de se connecter avec Google')
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
          <img 
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="USI Plongée" 
            className="w-24 h-24 mx-auto mb-4 object-contain"
          />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            USI - Commission Technique
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
            <div className="relative my-4">
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
              className="hidden"
            />
            
            {/* Google button */}
            <button
              type="button"
              onClick={handleGoogleFallback}
              className="w-full py-3 px-4 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-3 shadow-md"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Se connecter avec Google
            </button>
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
