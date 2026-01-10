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
  summary_token?: string
  optimization_mode: boolean
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
  nitrox_training: boolean
  is_directeur_plongee: boolean
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
  nitrox_training: boolean
  is_directeur_plongee: boolean
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
  diving_level?: string
  diving_level_display?: string
  is_instructor: boolean
  preparing_level?: string
  group_id?: string
  group_name?: string
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

export interface ImpersonationInfo {
  user_id: string
  user_email: string
  user_name: string
}

export interface AuthResponseData {
  token: string
  email: string
  name: string
  is_admin: boolean
  can_validate_competencies: boolean
  impersonating?: ImpersonationInfo
  must_change_password?: boolean
}

export const authApi = {
  getConfig: () => api.get<{ client_id: string }>('/auth/config'),
  googleCallback: (code: string) =>
    api.post<AuthResponseData>('/auth/google/callback', { code }),
  // Google One Tap / ID token authentication (connexion rapide sur mobile)
  googleIdToken: (idToken: string) =>
    api.post<AuthResponseData>('/auth/google/id-token', { id_token: idToken }),
  impersonate: (userId: string) =>
    api.post<{ token: string; impersonating: ImpersonationInfo; can_validate_competencies: boolean }>('/auth/impersonate', { user_id: userId }),
  stopImpersonation: () =>
    api.post<AuthResponseData>('/auth/stop-impersonation'),
  // Email/Password authentication
  requestPassword: (email: string) =>
    api.post<{ success: boolean; message: string }>('/auth/request-password', { email }),
  login: (email: string, password: string) =>
    api.post<AuthResponseData>('/auth/login', { email, password }),
  changePassword: (newPassword: string) =>
    api.post<{ success: boolean; message: string }>('/auth/change-password', { new_password: newPassword }),
}

export interface ParticipantInfo {
  first_name: string
  last_name: string
  email: string
  magic_link: string
  submitted: boolean
  is_encadrant: boolean
  nitrox_training: boolean
  comes_from_issoire: boolean
  has_car: boolean
  car_seats?: number
  diving_level?: string
  preparing_level?: string
}

export interface SessionSummary {
  total_questionnaires: number
  submitted_count: number
  encadrants_count: number
  students_count: number
  from_issoire_count: number
  total_bottles: number
  nitrox_bottles: number
  air_bottles: number
  regulators_count: number
  nitrox_count: number
  nitrox_training_count: number
  second_reg_count: number
  stab_count: number
  stab_sizes: Array<{ size: string; count: number }>
  vehicles_count: number
  total_car_seats: number
  participants: ParticipantInfo[]
  optimization_mode: boolean
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
  update: (id: string, data: { optimization_mode?: boolean }) => api.put<Session>(`/sessions/${id}`, data),
  delete: (id: string) => api.delete(`/sessions/${id}`),
  getSummary: (id: string) => api.get<SessionSummary>(`/sessions/${id}/summary`),
  getSummaryByToken: (token: string) => api.get<SessionSummary>(`/sessions/summary/${token}`),
  generateMagicLinks: (id: string) => api.post<{ success: boolean; generated_count: number; message: string }>(`/sessions/${id}/generate-links`),
  setDirecteurPlongee: (sessionId: string, questionnaireId: string | null) => 
    api.post(`/sessions/${sessionId}/directeur-plongee`, { questionnaire_id: questionnaireId }),
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
    nitrox_training: boolean
    comes_from_issoire: boolean
    has_car: boolean
    car_seats?: number
    comments?: string
  }) => api.post<Questionnaire>('/questionnaires/submit', data),
  // Auto-inscription (pour utilisateurs connectés)
  register: (data: {
    session_id: string
    email: string
    first_name: string
    last_name: string
    is_encadrant: boolean
    wants_regulator: boolean
    wants_nitrox: boolean
    wants_2nd_reg: boolean
    wants_stab: boolean
    stab_size?: string
    nitrox_training: boolean
    comes_from_issoire: boolean
    has_car: boolean
    car_seats?: number
    comments?: string
  }) => api.post<Questionnaire>('/questionnaires/register', data),
  list: (sessionId: string) =>
    api.get<Questionnaire[]>('/questionnaires', { params: { session_id: sessionId } }),
  listDetail: (sessionId: string) =>
    api.get<QuestionnaireDetail[]>('/questionnaires-detail', { params: { session_id: sessionId } }),
  update: (id: string, data: {
    wants_regulator: boolean
    wants_nitrox: boolean
    wants_2nd_reg: boolean
    wants_stab: boolean
    stab_size?: string
    nitrox_training: boolean
    comes_from_issoire: boolean
    has_car: boolean
    car_seats?: number
    comments?: string
    mark_as_submitted?: boolean
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

export interface Competency {
  id: string
  level: string
  name: string
  description?: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PermissionInfo {
  key: string
  description: string
  category: string
}

export interface Group {
  id: string
  name: string
  group_type: string
  description?: string
  permissions: string[]
  created_at: string
  updated_at: string
}

export interface CompetenciesByLevel {
  level: string
  competencies: Competency[]
}

// ============================================================================
// NEW HIERARCHICAL COMPETENCY SYSTEM
// ============================================================================

export interface ValidationStage {
  id: string
  code: string
  name: string
  description?: string
  color: string
  icon: string
  sort_order: number
  is_final: boolean
}

export interface CompetencyDomain {
  id: string
  diving_level: string
  name: string
  sort_order: number
  modules?: CompetencyModule[]
}

export interface CompetencyModule {
  id: string
  domain_id: string
  name: string
  sort_order: number
  skills?: CompetencySkill[]
}

export interface CompetencySkill {
  id: string
  module_id: string
  name: string
  description?: string
  sort_order: number
  min_validator_level: string
}

export interface SkillValidation {
  id: string
  person_id: string
  person_name?: string
  skill_id: string
  skill_name?: string
  stage_id: string
  stage?: ValidationStage
  validated_at: string
  validated_by_id: string
  validated_by_name?: string
  notes?: string
}

export interface ProgressStats {
  total: number
  validated: number
  in_progress: number
  not_started: number
  percentage: number
}

export interface SkillValidationInfo {
  id: string
  stage_id: string
  stage_code: string
  stage_name: string
  stage_color: string
  stage_icon: string
  is_final: boolean
  validated_at: string
  validated_by_name: string
  notes?: string
}

export interface CompetencySkillWithValidation {
  id: string
  name: string
  description?: string
  sort_order: number
  min_validator_level: string
  validation?: SkillValidationInfo
}

export interface ValidationLogEntry {
  id: string
  validated_at: string
  student_name: string
  student_email: string
  instructor_name: string
  instructor_email: string
  skill_name: string
  module_name: string
  domain_name: string
  diving_level: string
  stage_name: string
  stage_color: string
  is_final: boolean
  notes?: string
}

export interface CompetencyModuleWithProgress {
  id: string
  name: string
  sort_order: number
  skills: CompetencySkillWithValidation[]
  progress: ProgressStats
}

export interface CompetencyDomainWithProgress {
  id: string
  name: string
  sort_order: number
  modules: CompetencyModuleWithProgress[]
  progress: ProgressStats
}

export interface CompetencyHierarchy {
  diving_level: string
  domains: CompetencyDomainWithProgress[]
}

export const validationStagesApi = {
  list: () => api.get<ValidationStage[]>('/validation-stages'),
  create: (data: { code: string; name: string; description?: string; color?: string; icon?: string; sort_order?: number; is_final?: boolean }) =>
    api.post<ValidationStage>('/validation-stages', data),
  update: (id: string, data: Partial<Omit<ValidationStage, 'id'>>) =>
    api.put<ValidationStage>(`/validation-stages/${id}`, data),
  delete: (id: string) => api.delete(`/validation-stages/${id}`),
}

export const competencyDomainsApi = {
  list: (divingLevel?: string, includeModules?: boolean) =>
    api.get<CompetencyDomain[]>('/competency-domains', { params: { diving_level: divingLevel, include_modules: includeModules } }),
  create: (data: { diving_level: string; name: string; sort_order?: number }) =>
    api.post<CompetencyDomain>('/competency-domains', data),
  update: (id: string, data: Partial<Omit<CompetencyDomain, 'id' | 'modules'>>) =>
    api.put<CompetencyDomain>(`/competency-domains/${id}`, data),
  delete: (id: string) => api.delete(`/competency-domains/${id}`),
}

export const competencyModulesApi = {
  list: (domainId?: string, includeSkills?: boolean) =>
    api.get<CompetencyModule[]>('/competency-modules', { params: { domain_id: domainId, include_skills: includeSkills } }),
  create: (data: { domain_id: string; name: string; sort_order?: number }) =>
    api.post<CompetencyModule>('/competency-modules', data),
  update: (id: string, data: Partial<Omit<CompetencyModule, 'id' | 'skills'>>) =>
    api.put<CompetencyModule>(`/competency-modules/${id}`, data),
  delete: (id: string) => api.delete(`/competency-modules/${id}`),
}

export const competencySkillsApi = {
  list: (moduleId?: string) =>
    api.get<CompetencySkill[]>('/competency-skills', { params: { module_id: moduleId } }),
  create: (data: { module_id: string; name: string; description?: string; sort_order?: number; min_validator_level?: string }) =>
    api.post<CompetencySkill>('/competency-skills', data),
  update: (id: string, data: Partial<Omit<CompetencySkill, 'id'>>) =>
    api.put<CompetencySkill>(`/competency-skills/${id}`, data),
  delete: (id: string) => api.delete(`/competency-skills/${id}`),
}

export const skillValidationsApi = {
  list: (personId?: string, skillId?: string) =>
    api.get<SkillValidation[]>('/skill-validations', { params: { person_id: personId, skill_id: skillId } }),
  create: (data: { person_id: string; skill_id: string; stage_id: string; validated_at?: string; notes?: string }) =>
    api.post<SkillValidation>('/skill-validations', data),
  update: (id: string, data: { stage_id?: string; validated_at?: string; notes?: string }) =>
    api.put<SkillValidation>(`/skill-validations/${id}`, data),
  delete: (id: string) => api.delete(`/skill-validations/${id}`),
  // Hierarchy views
  getMyCompetencies: (divingLevel: string) =>
    api.get<CompetencyHierarchy>('/my-competencies', { params: { diving_level: divingLevel } }),
  getPersonCompetencies: (personId: string, divingLevel: string) =>
    api.get<CompetencyHierarchy>(`/person-competencies/${personId}`, { params: { diving_level: divingLevel } }),
  // Admin logs
  getLogs: () => api.get<ValidationLogEntry[]>('/skill-validations/logs'),
}

export const competenciesApi = {
  list: (level?: string) => api.get<Competency[]>('/competencies', { params: { level } }),
  listByLevel: () => api.get<CompetenciesByLevel[]>('/competencies/by-level'),
  get: (id: string) => api.get<Competency>(`/competencies/${id}`),
  create: (data: { level: string; name: string; description?: string; sort_order?: number }) => 
    api.post<Competency>('/competencies', data),
  update: (id: string, data: { level?: string; name?: string; description?: string; sort_order?: number }) => 
    api.put<Competency>(`/competencies/${id}`, data),
  delete: (id: string) => api.delete(`/competencies/${id}`),
}

export const groupsApi = {
  listPermissions: () => api.get<PermissionInfo[]>('/permissions'),
  list: () => api.get<Group[]>('/groups'),
  get: (id: string) => api.get<Group>(`/groups/${id}`),
  updatePermissions: (id: string, permissions: string[]) => 
    api.put<Group>(`/groups/${id}`, { permissions }),
}

// Level Documents (PDF templates pour les compétences)
export interface LevelDocumentInfo {
  id: string
  level: string
  file_name: string
  page_count: number
  created_at: string
  updated_at: string
}

export interface SkillPosition {
  skill_id: string
  page: number
  x: number
  y: number
  width: number
  height: number
  font_size: number
}

export interface SkillPositionWithInfo extends SkillPosition {
  id: string
  skill_name: string
  skill_number: number
  module_name: string
  domain_name: string
}

export interface PageInfo {
  page: number
  width: number
  height: number
}

export const levelDocumentsApi = {
  list: () => api.get<LevelDocumentInfo[]>('/level-documents'),
  get: (level: string) => api.get<LevelDocumentInfo>(`/level-documents/${level}`),
  upload: (level: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<LevelDocumentInfo>(`/level-documents/${level}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  download: (level: string) => 
    api.get(`/level-documents/${level}/download`, { responseType: 'blob' }),
  delete: (level: string) => api.delete(`/level-documents/${level}`),
  getPageInfo: (level: string, page: number) => 
    api.get<PageInfo>(`/level-documents/${level}/page/${page}`),
  // Positions des acquis
  listPositions: (level: string) => 
    api.get<SkillPositionWithInfo[]>(`/level-documents/${level}/positions`),
  setPosition: (level: string, position: SkillPosition) => 
    api.post(`/level-documents/${level}/positions`, position),
  batchUpdatePositions: (level: string, positions: SkillPosition[]) => 
    api.put(`/level-documents/${level}/positions`, positions),
  deletePosition: (level: string, skillId: string) => 
    api.delete(`/level-documents/${level}/positions/${skillId}`),
  // Génération de PDF rempli
  generateFilled: (level: string, personId: string) => 
    api.get(`/level-documents/${level}/generate/${personId}`, { responseType: 'blob' }),
}

// ============ PALANQUEES ============

export interface PalanqueeMember {
  id: string
  palanquee_id: string
  questionnaire_id: string
  role: string // E, P, GP
  gas_type: string // Air, Nitrox, etc
  person_id: string
  first_name: string
  last_name: string
  diving_level?: string
  preparing_level?: string
  is_encadrant: boolean
}

export interface Palanquee {
  id: string
  rotation_id: string
  number: number
  call_sign?: string
  planned_departure_time?: string
  planned_time?: number
  planned_depth?: number
  actual_departure_time?: string
  actual_return_time?: string
  actual_time?: number
  actual_depth?: number
  members: PalanqueeMember[]
}

export interface Rotation {
  id: string
  session_id: string
  number: number
  palanquees: Palanquee[]
}

export interface UnassignedParticipant {
  questionnaire_id: string
  person_id: string
  first_name: string
  last_name: string
  diving_level?: string
  preparing_level?: string
  is_encadrant: boolean
  wants_nitrox: boolean
  nitrox_training: boolean
}

export interface SessionPalanquees {
  session_id: string
  rotations: Rotation[]
  unassigned_participants: UnassignedParticipant[]
}

export const palanqueesApi = {
  // Récupérer toutes les palanquées d'une session
  getSessionPalanquees: (sessionId: string) => 
    api.get<SessionPalanquees>(`/sessions/${sessionId}/palanquees`),
  
  // Rotations
  createRotation: (sessionId: string, number?: number) => 
    api.post<Rotation>('/rotations', { session_id: sessionId, number }),
  listRotations: (sessionId: string) => 
    api.get<Rotation[]>(`/sessions/${sessionId}/rotations`),
  deleteRotation: (id: string) => 
    api.delete(`/rotations/${id}`),
  
  // Palanquées
  createPalanquee: (rotationId: string, number?: number, callSign?: string) => 
    api.post<Palanquee>('/palanquees', { rotation_id: rotationId, number, call_sign: callSign }),
  updatePalanquee: (id: string, data: {
    call_sign?: string
    planned_departure_time?: string
    planned_time?: number
    planned_depth?: number
    actual_departure_time?: string
    actual_return_time?: string
    actual_time?: number
    actual_depth?: number
  }) => api.put<Palanquee>(`/palanquees/${id}`, data),
  deletePalanquee: (id: string) => 
    api.delete(`/palanquees/${id}`),
  
  // Membres
  addMember: (palanqueeId: string, questionnaireId: string, role: string, gasType?: string) => 
    api.post<PalanqueeMember>(`/palanquees/${palanqueeId}/members`, { 
      questionnaire_id: questionnaireId, 
      role,
      gas_type: gasType 
    }),
  updateMember: (id: string, role?: string, gasType?: string) => 
    api.put<PalanqueeMember>(`/palanquee-members/${id}`, { role, gas_type: gasType }),
  removeMember: (id: string) => 
    api.delete(`/palanquee-members/${id}`),
  
  // Fiche de sécurité PDF
  downloadFicheSecurite: (sessionId: string, options?: {
    date?: string
    club?: string
    site?: string
    position?: string
    securite_surface?: string
    observations?: string
  }) => {
    const params = new URLSearchParams()
    if (options?.date) params.append('date', options.date)
    if (options?.club) params.append('club', options.club)
    if (options?.site) params.append('site', options.site)
    if (options?.position) params.append('position', options.position)
    if (options?.securite_surface) params.append('securite_surface', options.securite_surface)
    if (options?.observations) params.append('observations', options.observations)
    
    const queryString = params.toString()
    const url = `/sessions/${sessionId}/fiche-securite${queryString ? '?' + queryString : ''}`
    return api.get(url, { responseType: 'blob' })
  },
}

export default api

