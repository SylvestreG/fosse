import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionsApi, questionnairesApi, peopleApi, palanqueesApi, sortiesApi, Session, Person, QuestionnaireDetail, PalanqueeMember, Sortie } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import Button from '@/components/Button'
import Toast from '@/components/Toast'

interface MyRegistration {
  questionnaire: QuestionnaireDetail
  isEncadrant: boolean
  sortie?: Sortie // Si c'est une plongée de sortie
}

// Composant pour afficher et éditer les infos d'inscription
function RegistrationDetails({ 
  registration, 
  isEncadrant,
  onUpdate 
}: { 
  registration: QuestionnaireDetail
  isEncadrant: boolean
  onUpdate: (questId: string, data: Partial<QuestionnaireDetail> & { mark_as_submitted?: boolean }) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    wants_regulator: registration.wants_regulator,
    wants_nitrox: registration.wants_nitrox,
    wants_2nd_reg: registration.wants_2nd_reg,
    wants_stab: registration.wants_stab,
    stab_size: registration.stab_size || 'M',
    comes_from_issoire: registration.comes_from_issoire,
    has_car: registration.has_car,
    car_seats: registration.car_seats || 0,
  })

  const isSubmitted = !!registration.submitted_at

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(registration.id, {
        ...formData,
        nitrox_training: registration.nitrox_training, // Garder la valeur actuelle
        mark_as_submitted: true, // Marquer comme soumis
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 p-4 theme-card">
      <h3 className="text-sm font-medium theme-text-secondary mb-4">Mes préférences</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Matériel */}
        <div className="space-y-3">
          <p className="text-xs theme-text-dimmed mb-2">🎒 Matériel</p>
          
          <label className="flex items-center gap-2 cursor-pointer theme-hover p-1.5 rounded -ml-1.5">
            <input
              type="checkbox"
              checked={formData.wants_regulator}
              onChange={e => setFormData({ ...formData, wants_regulator: e.target.checked })}
              className="w-4 h-4 rounded accent-cyan-500"
            />
            <span className="text-sm theme-text-secondary">Détendeur</span>
          </label>

          <div>
            <label className="flex items-center gap-2 cursor-pointer theme-hover p-1.5 rounded -ml-1.5">
              <input
                type="checkbox"
                checked={formData.wants_stab}
                onChange={e => setFormData({ ...formData, wants_stab: e.target.checked })}
                className="w-4 h-4 rounded accent-cyan-500"
              />
              <span className="text-sm theme-text-secondary">Stab</span>
              {formData.wants_stab && (
                <select
                  value={formData.stab_size}
                  onChange={e => setFormData({ ...formData, stab_size: e.target.value })}
                  className="ml-2 px-2 py-0.5 theme-select text-xs"
                  onClick={e => e.stopPropagation()}
                >
                  <option value="XS">XS</option>
                  <option value="S">S</option>
                  <option value="M">M</option>
                  <option value="L">L</option>
                  <option value="XL">XL</option>
                </select>
              )}
            </label>
          </div>

          {isEncadrant && (
            <>
              <label className="flex items-center gap-2 cursor-pointer theme-hover p-1.5 rounded -ml-1.5">
                <input
                  type="checkbox"
                  checked={formData.wants_nitrox}
                  onChange={e => setFormData({ ...formData, wants_nitrox: e.target.checked })}
                  className="w-4 h-4 rounded accent-cyan-500"
                />
                <span className="text-sm theme-text-secondary">Nitrox</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer theme-hover p-1.5 rounded -ml-1.5">
                <input
                  type="checkbox"
                  checked={formData.wants_2nd_reg}
                  onChange={e => setFormData({ ...formData, wants_2nd_reg: e.target.checked })}
                  className="w-4 h-4 rounded accent-cyan-500"
                />
                <span className="text-sm theme-text-secondary">2ème détendeur</span>
              </label>
            </>
          )}

          {/* Afficher formation nitrox si active (lecture seule) */}
          {!isEncadrant && registration.nitrox_training && (
            <div className="flex items-center gap-2 p-1.5 -ml-1.5">
              <span className="text-xs theme-badge-warning px-2 py-1 rounded">🎓 Formation Nitrox</span>
            </div>
          )}
        </div>

        {/* Transport */}
        <div className="space-y-3">
          <p className="text-xs theme-text-dimmed mb-2">🚗 Transport</p>
          
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <label className="flex items-center gap-2 cursor-pointer theme-hover p-1.5 rounded -ml-1.5">
              <input
                type="radio"
                name={`transport-${registration.id}`}
                checked={formData.comes_from_issoire}
                onChange={() => setFormData({ ...formData, comes_from_issoire: true })}
                className="w-4 h-4 accent-cyan-500"
              />
              <span className="text-sm theme-text-secondary">📍 Départ Issoire</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer theme-hover p-1.5 rounded -ml-1.5">
              <input
                type="radio"
                name={`transport-${registration.id}`}
                checked={!formData.comes_from_issoire}
                onChange={() => setFormData({ ...formData, comes_from_issoire: false })}
                className="w-4 h-4 accent-cyan-500"
              />
              <span className="text-sm theme-text-secondary">📍 Départ Clermont</span>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer theme-hover p-1.5 rounded -ml-1.5">
              <input
                type="checkbox"
                checked={formData.has_car}
                onChange={e => setFormData({ ...formData, has_car: e.target.checked, car_seats: e.target.checked ? 4 : 0 })}
                className="w-4 h-4 rounded accent-cyan-500"
              />
              <span className="text-sm theme-text-secondary">🚗 J'ai une voiture</span>
              {formData.has_car && (
                <span className="flex items-center gap-1 ml-2">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.car_seats}
                    onChange={e => setFormData({ ...formData, car_seats: parseInt(e.target.value) || 0 })}
                    onClick={e => e.stopPropagation()}
                    className="w-12 px-1 py-0.5 theme-bg-input rounded text-xs text-center"
                  />
                  <span className="text-xs theme-text-muted">places</span>
                </span>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* Bouton de validation */}
      <div className="flex justify-between items-center mt-4 pt-3 border-t theme-border">
        {isSubmitted ? (
          <span className="text-xs text-green-400">✅ Réponse validée</span>
        ) : (
          <span className="text-xs text-amber-400">⚠️ Réponse non validée</span>
        )}
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? '⏳ Enregistrement...' : '✅ Valider'}
        </Button>
      </div>
    </div>
  )
}

interface PastSessionWithStudents {
  session: Session
  myStudents: PalanqueeMember[] // Élèves que j'ai eus dans mes palanquées (pour encadrants)
  myPalanquees: { rotationNumber: number; palanqueeNumber: number; members: PalanqueeMember[] }[] // Mes palanquées (pour tous)
}

export default function MySessionsPage() {
  const navigate = useNavigate()
  const { email, impersonating } = useAuthStore()
  const [sessions, setSessions] = useState<Session[]>([])
  const [pastSessionsWithStudents, setPastSessionsWithStudents] = useState<PastSessionWithStudents[]>([])
  const [myPerson, setMyPerson] = useState<Person | null>(null)
  const [myRegistrations, setMyRegistrations] = useState<Map<string, MyRegistration>>(new Map())
  const [sessionsWithPalanquees, setSessionsWithPalanquees] = useState<Set<string>>(new Set())
  const [sessionsWhereDP, setSessionsWhereDP] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showPastSessions, setShowPastSessions] = useState(false)

  // Si on impersonnifie, utiliser l'email de la personne impersonnifiée
  const targetEmail = impersonating?.user_email || email

  const handleUpdateQuestionnaire = async (questId: string, data: Partial<QuestionnaireDetail> & { mark_as_submitted?: boolean }) => {
    try {
      await questionnairesApi.update(questId, {
        wants_regulator: data.wants_regulator ?? false,
        wants_nitrox: data.wants_nitrox ?? false,
        wants_2nd_reg: data.wants_2nd_reg ?? false,
        wants_stab: data.wants_stab ?? false,
        stab_size: data.stab_size,
        nitrox_training: data.nitrox_training ?? false,
        nitrox_base_formation: data.nitrox_base_formation ?? false,
        nitrox_confirmed_formation: data.nitrox_confirmed_formation ?? false,
        comes_from_issoire: data.comes_from_issoire ?? false,
        has_car: data.has_car ?? false,
        car_seats: data.car_seats,
        mark_as_submitted: data.mark_as_submitted,
      })
      // Recharger les données pour mettre à jour l'affichage
      await loadData()
      setToast({ message: 'Réponse validée !', type: 'success' })
    } catch (error) {
      console.error('Error updating questionnaire:', error)
      setToast({ message: 'Erreur lors de la mise à jour', type: 'error' })
      throw error
    }
  }

  useEffect(() => {
    loadData()
  }, [targetEmail])

  const loadData = async () => {
    try {
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      
      // Charger toutes les sessions de fosse
      const sessionsRes = await sessionsApi.list()
      const futureFosseSessions = sessionsRes.data.filter(s => new Date(s.start_date) >= now)
      const pastFosseSessions = sessionsRes.data.filter(s => new Date(s.start_date) < now)
      
      // Charger mon profil
      let me: Person | null = null
      if (targetEmail) {
        const peopleRes = await peopleApi.list(targetEmail)
        me = peopleRes.data.find(p => p.email === targetEmail) || null
        setMyPerson(me)
      }
      
      // Charger les sorties et identifier celles où l'utilisateur est inscrit
      const sortiesRes = await sortiesApi.list()
      const sortiesMap = new Map<string, Sortie>()
      const mySortieRegistrations = new Map<string, QuestionnaireDetail>() // sortie_id -> questionnaire
      
      for (const sortie of sortiesRes.data) {
        sortiesMap.set(sortie.id, sortie)
        try {
          const questRes = await sortiesApi.getQuestionnaires(sortie.id)
          const myQuest = questRes.data.find(q => q.email === targetEmail)
          if (myQuest) {
            mySortieRegistrations.set(sortie.id, myQuest)
          }
        } catch (e) {
          // Ignorer
        }
      }
      
      // Pour chaque sortie où je suis inscrit, charger les plongées (dives)
      const allSortieDives: Session[] = []
      const pastSortieDives: Session[] = []
      for (const [sortieId, myQuest] of mySortieRegistrations) {
        try {
          const sortieDetail = await sortiesApi.get(sortieId)
          // Séparer les plongées futures et passées
          const futureDives = sortieDetail.data.dives
            .filter(d => new Date(d.start_date) >= now)
            .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
          const pastDives = sortieDetail.data.dives.filter(d => new Date(d.start_date) < now)
          
          // Vérifier si l'utilisateur est DP pour l'une des plongées
          let isDP = false
          for (const dive of futureDives) {
            try {
              const dpRes = await sessionsApi.getDiveDirectors(dive.id)
              if (dpRes.data.some(dp => dp.questionnaire_id === myQuest.id)) {
                isDP = true
                break
              }
            } catch (e) {
              // Ignorer
            }
          }
          
          // Si DP, afficher toutes les plongées à venir, sinon seulement la première
          if (isDP) {
            allSortieDives.push(...futureDives)
          } else if (futureDives.length > 0) {
            allSortieDives.push(futureDives[0])
          }
          pastSortieDives.push(...pastDives)
        } catch (e) {
          // Ignorer
        }
      }
      
      // Combiner et trier toutes les sessions futures
      const allFutureSessions = [...futureFosseSessions, ...allSortieDives]
        .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
      setSessions(allFutureSessions)
      
      // Charger mes inscriptions pour chaque session future
      const registrations = new Map<string, MyRegistration>()
      
      for (const session of allFutureSessions) {
        if (session.sortie_id) {
          // C'est une plongée de sortie
          const myQuest = mySortieRegistrations.get(session.sortie_id)
          if (myQuest) {
            registrations.set(session.id, {
              questionnaire: myQuest,
              isEncadrant: myQuest.is_encadrant,
              sortie: sortiesMap.get(session.sortie_id)
            })
          }
        } else {
          // C'est une fosse classique
          try {
            const questRes = await questionnairesApi.listDetail(session.id)
            const myQuest = questRes.data.find(q => q.email === targetEmail)
            if (myQuest) {
              registrations.set(session.id, {
                questionnaire: myQuest,
                isEncadrant: myQuest.is_encadrant
              })
            }
          } catch (e) {
            // Ignorer
          }
        }
      }
      setMyRegistrations(registrations)

      // Vérifier quelles sessions ont des palanquées créées et où l'utilisateur est DP
      const withPalanquees = new Set<string>()
      const whereDP = new Set<string>()
      for (const [sessionId, reg] of registrations) {
        try {
          const palanqueesRes = await palanqueesApi.getSessionPalanquees(sessionId)
          // Vérifier s'il y a au moins une palanquée avec des membres
          const hasPalanquees = palanqueesRes.data.rotations.some(r => 
            r.palanquees.some(p => p.members.length > 0)
          )
          if (hasPalanquees) {
            withPalanquees.add(sessionId)
          }
        } catch (e) {
          // Ignorer - l'utilisateur n'a peut-être pas accès
        }
        
        // Vérifier si l'utilisateur est DP pour cette session
        // Pour les fosses: via is_directeur_plongee
        if (reg.questionnaire.is_directeur_plongee) {
          whereDP.add(sessionId)
        }
        // Pour les sorties: via dive_directors
        try {
          const dpRes = await sessionsApi.getDiveDirectors(sessionId)
          if (dpRes.data.some(dp => dp.questionnaire_id === reg.questionnaire.id)) {
            whereDP.add(sessionId)
          }
        } catch (e) {
          // Ignorer
        }
      }
      setSessionsWithPalanquees(withPalanquees)
      setSessionsWhereDP(whereDP)

      // Charger les sessions passées (fosses + plongées de sorties)
      const allPastSessions = [...pastFosseSessions, ...pastSortieDives]
        .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
      
      const pastWithStudents: PastSessionWithStudents[] = []
      
      for (const session of allPastSessions) {
        try {
          let myQuest: QuestionnaireDetail | undefined
          
          if (session.sortie_id) {
            // Plongée de sortie - utiliser l'inscription de la sortie
            myQuest = mySortieRegistrations.get(session.sortie_id)
          } else {
            // Fosse classique
            const questRes = await questionnairesApi.listDetail(session.id)
            myQuest = questRes.data.find(q => q.email === targetEmail)
          }
          
          if (myQuest) {
            // Charger les palanquées
            const palanqueesRes = await palanqueesApi.getSessionPalanquees(session.id)
            
            // Trouver mes palanquées et les élèves
            const myStudents: PalanqueeMember[] = []
            const myPalanquees: { rotationNumber: number; palanqueeNumber: number; members: PalanqueeMember[] }[] = []
            
            for (const rotation of palanqueesRes.data.rotations) {
              for (const palanquee of rotation.palanquees) {
                const amIMember = palanquee.members.some(m => m.questionnaire_id === myQuest!.id)
                
                if (amIMember) {
                  myPalanquees.push({
                    rotationNumber: rotation.number,
                    palanqueeNumber: palanquee.number,
                    members: palanquee.members
                  })
                  
                  const amIGP = palanquee.members.some(m => 
                    m.questionnaire_id === myQuest!.id && (m.role === 'GP' || m.role === 'E')
                  )
                  
                  if (amIGP) {
                    const students = palanquee.members.filter(m => 
                      m.role === 'P' && m.questionnaire_id !== myQuest!.id
                    )
                    myStudents.push(...students)
                  }
                }
              }
            }
            
            const uniqueStudents = myStudents
              .filter((student, index, self) =>
                index === self.findIndex(s => s.person_id === student.person_id)
              )
            
            if (myPalanquees.length > 0) {
              pastWithStudents.push({
                session,
                myStudents: uniqueStudents,
                myPalanquees
              })
            }
          }
        } catch (e) {
          // Ignorer
        }
      }
      
      setPastSessionsWithStudents(pastWithStudents)
    } catch (error) {
      console.error('Error loading data:', error)
      setToast({ message: 'Erreur lors du chargement', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold theme-text">📅 Plongées à venir</h1>
        <p className="theme-text-secondary mt-1">Consultez vos prochaines fosses et sorties</p>
      </div>

      {sessions.length === 0 ? (
        <div className="theme-card shadow p-12 text-center">
          <p className="theme-text-muted text-lg">Aucune plongée à venir pour le moment.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => {
            const registration = myRegistrations.get(session.id)
            const isRegistered = !!registration
            const isEncadrant = registration?.isEncadrant || false
            const isSortieDive = !!session.sortie_id
            const sortie = registration?.sortie
            const sessionDate = new Date(session.start_date)
            const formattedDate = sessionDate.toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })

            return (
              <div 
                key={session.id} 
                className={`theme-card shadow p-6 border-l-4 ${
                  isSortieDive 
                    ? 'border-purple-500' 
                    : isRegistered ? 'border-green-500' : 'border-blue-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    {isSortieDive && sortie && (
                      <p className="text-purple-500 text-sm font-medium mb-1">
                        🏝️ {sortie.name}
                      </p>
                    )}
                    <h2 className="text-xl font-semibold theme-text">{session.name}</h2>
                    <p className="theme-text-secondary mt-1">📍 {session.location || 'Lieu non précisé'}</p>
                    <p className="theme-text-secondary">📆 {formattedDate}</p>
                    {session.description && (
                      <p className="theme-text-muted mt-2 text-sm">{session.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {isRegistered ? (
                      <>
                        <span className={`inline-flex items-center px-4 py-2 rounded-full font-medium border ${
                          isSortieDive 
                            ? 'theme-badge-purple' 
                            : 'theme-badge-success'
                        }`}>
                          ✅ Inscrit {isEncadrant ? '(Encadrant)' : ''}
                        </span>
                        {sessionsWithPalanquees.has(session.id) || sessionsWhereDP.has(session.id) ? (
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => navigate(`/dashboard/palanquees/${session.id}`)}
                          >
                            🤿 Palanquées {!sessionsWithPalanquees.has(session.id) && sessionsWhereDP.has(session.id) ? '(à définir)' : ''}
                          </Button>
                        ) : (
                          <span className="px-3 py-1.5 text-sm theme-badge rounded-lg cursor-not-allowed">
                            🤿 Palanquées (non définies)
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center px-4 py-2 theme-badge rounded-full font-medium border">
                        ❌ Non inscrit
                      </span>
                    )}
                  </div>
                </div>

                {/* Détails d'inscription - seulement pour les fosses (pas de gestion matériel pour les sorties) */}
                {isRegistered && registration && !isSortieDive && (
                  <RegistrationDetails
                    registration={registration.questionnaire}
                    isEncadrant={isEncadrant}
                    onUpdate={handleUpdateQuestionnaire}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Section plongées passées pour tous les utilisateurs */}
      {pastSessionsWithStudents.length > 0 && (
        <div className="space-y-4">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowPastSessions(!showPastSessions)}
          >
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">📋 Mes plongées passées</h2>
              <p className="text-slate-300 text-sm mt-1">
                {myPerson?.is_instructor 
                  ? 'Retrouvez les élèves que vous avez encadrés'
                  : 'Retrouvez vos palanquées passées'}
              </p>
            </div>
            <Button variant="secondary" size="sm">
              {showPastSessions ? '▲ Masquer' : '▼ Afficher'} ({pastSessionsWithStudents.length})
            </Button>
          </div>

          {showPastSessions && (
            <div className="space-y-4">
              {pastSessionsWithStudents.map(({ session, myStudents, myPalanquees }) => {
                const sessionDate = new Date(session.start_date)
                const formattedDate = sessionDate.toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })
                const studentsInTraining = myStudents.filter(s => s.preparing_level).length
                const isInstructor = myPerson?.is_instructor
                const isSortieDive = !!session.sortie_id

                return (
                  <div 
                    key={session.id}
                    className={`bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-4 sm:p-6 border ${
                      isSortieDive ? 'border-purple-500/50' : 'border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                      <div>
                        {isSortieDive && (
                          <span className="text-xs text-purple-400 font-medium">🏝️ Sortie</span>
                        )}
                        <h3 className="text-lg font-semibold text-white">{session.name}</h3>
                        <p className="text-sm text-slate-400">📆 {formattedDate} • 📍 {session.location}</p>
                      </div>
                      <div className="flex gap-2 self-start sm:self-auto">
                        <span className="text-sm text-slate-400 bg-slate-700/50 px-3 py-1 rounded-full border border-slate-600">
                          {myPalanquees.length} palanquée{myPalanquees.length > 1 ? 's' : ''}
                        </span>
                        {isInstructor && studentsInTraining > 0 && (
                          <span className="text-sm text-amber-400 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
                            🎯 {studentsInTraining} en formation
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Affichage des palanquées pour tous */}
                    <div className="space-y-3">
                      {myPalanquees.map((pal, idx) => {
                        const gps = pal.members.filter(m => m.role === 'GP' || m.role === 'E')
                        const students = pal.members.filter(m => m.role === 'P')
                        
                        return (
                          <div key={idx} className="bg-slate-700/30 rounded-lg p-3 border border-slate-600/50">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs text-slate-500">Rot. {pal.rotationNumber}</span>
                              <span className="bg-purple-600/30 text-purple-300 text-xs px-2 py-0.5 rounded font-medium">
                                Pal. {pal.palanqueeNumber}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {/* GPs */}
                              {gps.map(gp => (
                                <span 
                                  key={gp.id}
                                  className="text-sm bg-purple-500/20 text-purple-300 px-2 py-1 rounded border border-purple-500/30"
                                >
                                  🏅 {gp.first_name} {gp.last_name.charAt(0)}.
                                </span>
                              ))}
                              {/* Élèves */}
                              {students.map(student => {
                                const isInTraining = !!student.preparing_level
                                const canNavigate = isInstructor && isInTraining
                                
                                return (
                                  <span 
                                    key={student.id}
                                    onClick={() => canNavigate && navigate(`/dashboard/competences/student/${student.person_id}`)}
                                    className={`text-sm px-2 py-1 rounded border ${
                                      canNavigate 
                                        ? 'bg-slate-600/30 text-slate-300 border-slate-500/30 hover:border-cyan-500/50 hover:text-cyan-400 cursor-pointer'
                                        : 'bg-slate-600/20 text-slate-400 border-slate-600/30'
                                    }`}
                                  >
                                    {student.first_name} {student.last_name.charAt(0)}.
                                    {student.preparing_level && (
                                      <span className="ml-1 text-amber-400 text-xs">🎯{student.preparing_level}</span>
                                    )}
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
