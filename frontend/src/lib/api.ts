import axios from 'axios'

// Utilise toujours un chemin relatif pour l'API
// En dev avec Vite : proxy vers localhost:8080
// En prod : backend sert le frontend sur le même port
// Le base path est automatiquement ajouté selon l'environnement
const getBaseURL = () => {
  // En production avec Vite, import.meta.env.BASE_URL contient '/fosse/'
  // En dev, c'est '/'
  const basePath = import.meta.env.BASE_URL || '/'
  const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
  return `${cleanBasePath}/api/v1`
}

const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear all auth data
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth-storage')
      // Redirect to login with base path
      const basePath = import.meta.env.BASE_URL || '/'
      const cleanBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
      const loginPath = `${cleanBasePath}/login`
      if (!window.location.pathname.startsWith(loginPath)) {
        window.location.href = loginPath
      }
    }
    return Promise.reject(error)
  }
)

export interface Session {
  id: string
  name: string
  start_date: string
  end_date?: string
  location?: string
  description?: string
  created_at: string
  updated_at: string
}

export interface Questionnaire {
  id: string
  session_id: string
  person_id: string
  is_encadrant: boolean
  wants_regulator: boolean
  wants_nitrox: boolean
  wants_2nd_reg: boolean
  wants_stab: boolean
  stab_size?: string
  comes_from_issoire: boolean
  has_car: boolean
  car_seats?: number
  comments?: string
  submitted_at?: string
  created_at: string
  updated_at: string
}

export interface QuestionnaireDetail {
  id: string
  session_id: string
  person_id: string
  first_name: string
  last_name: string
  email: string
  is_encadrant: boolean
  wants_regulator: boolean
  wants_nitrox: boolean
  wants_2nd_reg: boolean
  wants_stab: boolean
  stab_size?: string
  comes_from_issoire: boolean
  has_car: boolean
  car_seats?: number
  comments?: string
  submitted_at?: string
  magic_link?: string
  email_status?: string
}

export interface Person {
  id: string
  first_name: string
  last_name: string
  email: string
  phone?: string
  default_is_encadrant: boolean
  default_wants_regulator: boolean
  default_wants_nitrox: boolean
  default_wants_2nd_reg: boolean
  default_wants_stab: boolean
  default_stab_size?: string
  created_at: string
  updated_at: string
}

export interface QuestionnaireTokenData {
  token: string
  person: Person
  session_id: string
  questionnaire?: Questionnaire
}

export interface ImportJob {
  id: string
  session_id: string
  filename: string
  status: string
  total_rows: number
  success_count: number
  error_count: number
  errors?: Array<{ row: number; message: string }>
  created_at: string
  updated_at: string
}

export const authApi = {
  getConfig: () => api.get<{ client_id: string }>('/auth/config'),
  googleCallback: (code: string) =>
    api.post<{ token: string; email: string; name: string }>('/auth/google/callback', { code }),
}

export interface ParticipantInfo {
  first_name: string
  last_name: string
  email: string
  magic_link: string
  submitted: boolean
}

export interface SessionSummary {
  total_questionnaires: number
  submitted_count: number
  encadrants_count: number
  total_bottles: number
  nitrox_bottles: number
  air_bottles: number
  regulators_count: number
  nitrox_count: number
  second_reg_count: number
  stab_count: number
  stab_sizes: Array<{ size: string; count: number }>
  vehicles_count: number
  total_car_seats: number
  participants: ParticipantInfo[]
}

export const sessionsApi = {
  create: (data: {
    name: string
    start_date: string
    end_date?: string
    location?: string
    description?: string
  }) => api.post<Session>('/sessions', data),
  list: () => api.get<Session[]>('/sessions'),
  get: (id: string) => api.get<Session>(`/sessions/${id}`),
  delete: (id: string) => api.delete(`/sessions/${id}`),
  getSummary: (id: string) => api.get<SessionSummary>(`/sessions/${id}/summary`),
}

export const questionnairesApi = {
  getByToken: (token: string) =>
    api.get<QuestionnaireTokenData>(`/questionnaires/by-token/${token}`),
  submit: (data: {
    token: string
    is_encadrant: boolean
    wants_regulator: boolean
    wants_nitrox: boolean
    wants_2nd_reg: boolean
    wants_stab: boolean
    stab_size?: string
    comes_from_issoire: boolean
    has_car: boolean
    car_seats?: number
    comments?: string
  }) => api.post<Questionnaire>('/questionnaires', data),
  list: (sessionId: string) =>
    api.get<Questionnaire[]>('/questionnaires', { params: { session_id: sessionId } }),
  listDetail: (sessionId: string) =>
    api.get<QuestionnaireDetail[]>('/questionnaires-detail', { params: { session_id: sessionId } }),
  update: (id: string, data: {
    is_encadrant: boolean
    wants_regulator: boolean
    wants_nitrox: boolean
    wants_2nd_reg: boolean
    wants_stab: boolean
    stab_size?: string
    has_car: boolean
    car_seats?: number
    comments?: string
  }) => api.put<Questionnaire>(`/questionnaires/${id}`, data),
  delete: (id: string) => api.delete(`/questionnaires/${id}`),
}

export const importApi = {
  importCsv: (sessionId: string, file: File) => {
    const formData = new FormData()
    formData.append('session_id', sessionId)
    formData.append('file', file)
    return api.post<ImportJob>('/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  get: (id: string) => api.get<ImportJob>(`/import/${id}`),
}

export interface EmailToSend {
  id: string
  to_email: string
  to_name: string
  subject: string
  body: string
  status: string
  sent_at: string | null
  expires_at: string
}

export const emailsApi = {
  getPending: () => api.get<EmailToSend[]>('/emails/pending'),
  getBySession: (sessionId: string) => api.get<EmailToSend[]>(`/emails/session/${sessionId}`),
  markAsSent: (id: string) => api.post(`/emails/${id}/sent`),
}

export const peopleApi = {
  list: (search?: string) => api.get<Person[]>('/people', { params: { search } }),
  get: (id: string) => api.get<Person>(`/people/${id}`),
  create: (data: Omit<Person, 'id' | 'created_at' | 'updated_at'>) => api.post<Person>('/people', data),
  update: (id: string, data: Partial<Omit<Person, 'id' | 'created_at' | 'updated_at'>>) => api.put<Person>(`/people/${id}`, data),
  delete: (id: string) => api.delete(`/people/${id}`),
}

export default api

