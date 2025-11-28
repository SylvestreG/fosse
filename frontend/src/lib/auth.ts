import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  email: string | null
  name: string | null
  isAuthenticated: boolean
  setAuth: (token: string, email: string, name: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      email: null,
      name: null,
      isAuthenticated: false,
      setAuth: (token, email, name) => {
        localStorage.setItem('auth_token', token)
        set({ token, email, name, isAuthenticated: true })
      },
      logout: () => {
        localStorage.removeItem('auth_token')
        set({ token: null, email: null, name: null, isAuthenticated: false })
      },
    }),
    {
      name: 'auth-storage',
    }
  )
)

// Fonction pour initier la connexion Google
// Le client_id est récupéré depuis le backend pour éviter de le hardcoder
export async function initiateGoogleLogin() {
  try {
    // Récupérer la config OAuth depuis le backend
    const { authApi } = await import('./api')
    const response = await authApi.getConfig()
    const clientId = response.data.client_id
    
    // Construire le redirect URI en incluant le base path
    // En dev: http://localhost:5173/login
    // En prod: https://www.dive-manager.com/fosse/login
    const basePath = import.meta.env.BASE_URL || '/'
    const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
    const redirectUri = `${window.location.origin}${cleanBasePath}/login`
    const scope = 'email profile'
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(scope)}`
    
    console.log('OAuth config:', { clientId, redirectUri })
    window.location.href = authUrl
  } catch (error) {
    console.error('Failed to get OAuth config:', error)
    alert('Erreur lors de la récupération de la configuration OAuth')
  }
}

