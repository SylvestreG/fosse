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
  canValidateCompetencies: boolean
  impersonating: ImpersonationInfo | null
  // Getter: retourne true si admin ET pas en train d'impersonnifier
  isAdminView: () => boolean
  // Getter: retourne true si peut valider des compétences (encadrant ou admin)
  canValidate: () => boolean
  setAuth: (token: string, email: string, name: string, isAdmin: boolean, canValidateCompetencies: boolean, impersonating?: ImpersonationInfo | null) => void
  setImpersonation: (token: string, impersonating: ImpersonationInfo, canValidateCompetencies: boolean) => void
  stopImpersonation: (token: string, canValidateCompetencies: boolean) => void
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
      canValidateCompetencies: false,
      impersonating: null,
      // Quand on impersonnifie, on voit l'interface comme l'utilisateur (pas admin)
      isAdminView: () => {
        const state = get()
        return state.isAdmin && !state.impersonating
      },
      // Peut valider des compétences si encadrant ou admin
      // Quand on impersonnifie, canValidateCompetencies reflète les droits de l'utilisateur impersonnifié
      canValidate: () => {
        const state = get()
        return state.canValidateCompetencies
      },
      setAuth: (token, email, name, isAdmin, canValidateCompetencies, impersonating = null) => {
        localStorage.setItem('auth_token', token)
        set({ token, email, name, isAuthenticated: true, isAdmin, canValidateCompetencies, impersonating })
      },
      setImpersonation: (token, impersonating, canValidateCompetencies) => {
        localStorage.setItem('auth_token', token)
        set({ token, impersonating, canValidateCompetencies })
      },
      stopImpersonation: (token, canValidateCompetencies) => {
        localStorage.setItem('auth_token', token)
        set({ token, impersonating: null, canValidateCompetencies })
      },
      logout: () => {
        localStorage.removeItem('auth_token')
        set({ token: null, email: null, name: null, isAuthenticated: false, isAdmin: false, canValidateCompetencies: false, impersonating: null })
      },
    }),
    {
      name: 'auth-storage',
    }
  )
)

// Fonction pour initier la connexion Google (redirect flow - fallback)
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

// Types pour Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfig) => void
          prompt: (callback?: (notification: PromptMomentNotification) => void) => void
          renderButton: (parent: HTMLElement, options: GsiButtonConfig) => void
          cancel: () => void
        }
      }
    }
  }
}

interface GoogleIdConfig {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
  context?: 'signin' | 'signup' | 'use'
  itp_support?: boolean
}

interface GoogleCredentialResponse {
  credential: string // JWT ID token
  select_by: string
}

interface PromptMomentNotification {
  isDisplayed: () => boolean
  isNotDisplayed: () => boolean
  isSkippedMoment: () => boolean
  isDismissedMoment: () => boolean
  getNotDisplayedReason: () => string
  getSkippedReason: () => string
  getDismissedReason: () => string
}

interface GsiButtonConfig {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number
  locale?: string
}

// Charger le script Google Identity Services
export function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
}

// Initialiser Google One Tap
export async function initializeGoogleOneTap(
  clientId: string,
  onSuccess: (idToken: string) => void,
  onError?: (error: string) => void
): Promise<void> {
  try {
    await loadGoogleScript()
    
    if (!window.google?.accounts) {
      throw new Error('Google Identity Services not loaded')
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential) {
          onSuccess(response.credential)
        }
      },
      auto_select: true, // Auto-select si un seul compte
      cancel_on_tap_outside: true,
      itp_support: true, // Support Intelligent Tracking Prevention (Safari)
    })
  } catch (error) {
    console.error('Failed to initialize Google One Tap:', error)
    onError?.('Impossible d\'initialiser Google One Tap')
  }
}

// Afficher le prompt One Tap
export function showGoogleOneTap(onNotDisplayed?: () => void): void {
  if (!window.google?.accounts) {
    onNotDisplayed?.()
    return
  }

  window.google.accounts.id.prompt((notification) => {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      console.log('One Tap not displayed:', notification.getNotDisplayedReason?.() || notification.getSkippedReason?.())
      onNotDisplayed?.()
    }
  })
}

// Rendre le bouton Google Sign-In
export function renderGoogleButton(elementId: string): void {
  if (!window.google?.accounts) return
  
  const element = document.getElementById(elementId)
  if (!element) return

  window.google.accounts.id.renderButton(element, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'rectangular',
    width: 300,
  })
}
