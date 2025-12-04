import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ImpersonationInfo {
  user_id: string
  user_email: string
  user_name: string
}

interface AuthState {
  token: string | null
  email: string | null
  name: string | null
  isAuthenticated: boolean
  isAdmin: boolean
  impersonating: ImpersonationInfo | null
  // Getter: retourne true si admin ET pas en train d'impersonnifier
  isAdminView: () => boolean
  setAuth: (token: string, email: string, name: string, isAdmin: boolean, impersonating?: ImpersonationInfo | null) => void
  setImpersonation: (token: string, impersonating: ImpersonationInfo) => void
  stopImpersonation: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      email: null,
      name: null,
      isAuthenticated: false,
      isAdmin: false,
      impersonating: null,
      // Quand on impersonnifie, on voit l'interface comme l'utilisateur (pas admin)
      isAdminView: () => {
        const state = get()
        return state.isAdmin && !state.impersonating
      },
      setAuth: (token, email, name, isAdmin, impersonating = null) => {
        localStorage.setItem('auth_token', token)
        set({ token, email, name, isAuthenticated: true, isAdmin, impersonating })
      },
      setImpersonation: (token, impersonating) => {
        localStorage.setItem('auth_token', token)
        set({ token, impersonating })
      },
      stopImpersonation: (token) => {
        localStorage.setItem('auth_token', token)
        set({ token, impersonating: null })
      },
      logout: () => {
        localStorage.removeItem('auth_token')
        set({ token: null, email: null, name: null, isAuthenticated: false, isAdmin: false, impersonating: null })
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
