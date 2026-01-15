import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionsApi, questionnairesApi, peopleApi, palanqueesApi, Session, Person, QuestionnaireDetail, PalanqueeMember } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import Button from '@/components/Button'
import Toast from '@/components/Toast'

interface MyRegistration {
  questionnaire: QuestionnaireDetail
  isEncadrant: boolean
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
    <div className="mt-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
      <h3 className="text-sm font-medium text-slate-300 mb-4">Mes préférences</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Matériel */}
        <div className="space-y-3">
          <p className="text-xs text-slate-500 mb-2">🎒 Matériel</p>
          
          <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-600/30 p-1.5 rounded -ml-1.5">
            <input
              type="checkbox"
              checked={formData.wants_regulator}
              onChange={e => setFormData({ ...formData, wants_regulator: e.target.checked })}
              className="w-4 h-4 rounded accent-cyan-500"
            />
            <span className="text-sm text-slate-300">Détendeur</span>
          </label>

          <div>
            <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-600/30 p-1.5 rounded -ml-1.5">
              <input
                type="checkbox"
                checked={formData.wants_stab}
                onChange={e => setFormData({ ...formData, wants_stab: e.target.checked })}
                className="w-4 h-4 rounded accent-cyan-500"
              />
              <span className="text-sm text-slate-300">Stab</span>
              {formData.wants_stab && (
                <select
                  value={formData.stab_size}
                  onChange={e => setFormData({ ...formData, stab_size: e.target.value })}
                  className="ml-2 px-2 py-0.5 bg-slate-600 border border-slate-500 rounded text-xs"
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
              <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-600/30 p-1.5 rounded -ml-1.5">
                <input
                  type="checkbox"
                  checked={formData.wants_nitrox}
                  onChange={e => setFormData({ ...formData, wants_nitrox: e.target.checked })}
                  className="w-4 h-4 rounded accent-cyan-500"
                />
                <span className="text-sm text-slate-300">Nitrox</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-600/30 p-1.5 rounded -ml-1.5">
                <input
                  type="checkbox"
                  checked={formData.wants_2nd_reg}
                  onChange={e => setFormData({ ...formData, wants_2nd_reg: e.target.checked })}
                  className="w-4 h-4 rounded accent-cyan-500"
                />
                <span className="text-sm text-slate-300">2ème détendeur</span>
              </label>
            </>
          )}

          {/* Afficher formation nitrox si active (lecture seule) */}
          {!isEncadrant && registration.nitrox_training && (
            <div className="flex items-center gap-2 p-1.5 -ml-1.5">
              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded">🎓 Formation Nitrox</span>
            </div>
          )}
        </div>

        {/* Transport */}
        <div className="space-y-3">
          <p className="text-xs text-slate-500 mb-2">🚗 Transport</p>
          
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
            <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-600/30 p-1.5 rounded -ml-1.5">
              <input
                type="radio"
                name={`transport-${registration.id}`}
                checked={formData.comes_from_issoire}
                onChange={() => setFormData({ ...formData, comes_from_issoire: true })}
                className="w-4 h-4 accent-cyan-500"
              />
              <span className="text-sm text-slate-300">📍 Départ Issoire</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-600/30 p-1.5 rounded -ml-1.5">
              <input
                type="radio"
                name={`transport-${registration.id}`}
                checked={!formData.comes_from_issoire}
                onChange={() => setFormData({ ...formData, comes_from_issoire: false })}
                className="w-4 h-4 accent-cyan-500"
              />
              <span className="text-sm text-slate-300">📍 Départ Clermont</span>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-600/30 p-1.5 rounded -ml-1.5">
              <input
                type="checkbox"
                checked={formData.has_car}
                onChange={e => setFormData({ ...formData, has_car: e.target.checked, car_seats: e.target.checked ? 4 : 0 })}
                className="w-4 h-4 rounded accent-cyan-500"
              />
              <span className="text-sm text-slate-300">🚗 J'ai une voiture</span>
              {formData.has_car && (
                <span className="flex items-center gap-1 ml-2">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.car_seats}
                    onChange={e => setFormData({ ...formData, car_seats: parseInt(e.target.value) || 0 })}
                    onClick={e => e.stopPropagation()}
                    className="w-12 px-1 py-0.5 bg-slate-600 border border-slate-500 rounded text-xs text-center"
                  />
                  <span className="text-xs text-slate-400">places</span>
                </span>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* Bouton de validation */}
      <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-600">
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
  myStudents: PalanqueeMember[] // Élèves que j'ai eus dans mes palanquées
}

export default function MySessionsPage() {
  const navigate = useNavigate()
  const { email, impersonating } = useAuthStore()
  const [sessions, setSessions] = useState<Session[]>([])
  const [pastSessionsWithStudents, setPastSessionsWithStudents] = useState<PastSessionWithStudents[]>([])
  const [myPerson, setMyPerson] = useState<Person | null>(null)
  const [myRegistrations, setMyRegistrations] = useState<Map<string, MyRegistration>>(new Map())
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
      // Charger toutes les sessions
      const sessionsRes = await sessionsApi.list()
      
      // Filtrer pour ne garder que les sessions futures
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      const futureSessions = sessionsRes.data.filter(s => new Date(s.start_date) >= now)
      const pastSessions = sessionsRes.data.filter(s => new Date(s.start_date) < now)
        .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
      setSessions(futureSessions)
      
      // Charger mon profil
      if (targetEmail) {
        const peopleRes = await peopleApi.list(targetEmail)
        const me = peopleRes.data.find(p => p.email === targetEmail)
        setMyPerson(me || null)
        
        // Charger mes inscriptions pour chaque session future
        const registrations = new Map<string, MyRegistration>()
        for (const session of futureSessions) {
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
            // Ignorer les erreurs
          }
        }
        setMyRegistrations(registrations)

        // Si c'est un encadrant, charger les sessions passées avec les élèves
        if (me?.is_instructor) {
          const pastWithStudents: PastSessionWithStudents[] = []
          
          // Limiter aux 10 dernières sessions pour la performance
          for (const session of pastSessions.slice(0, 10)) {
            try {
              // Vérifier si j'étais inscrit à cette session
              const questRes = await questionnairesApi.listDetail(session.id)
              const myQuest = questRes.data.find(q => q.email === targetEmail)
              
              if (myQuest?.is_encadrant) {
                // Charger les palanquées
                const palanqueesRes = await palanqueesApi.getSessionPalanquees(session.id)
                
                // Trouver mes palanquées (où je suis GP)
                const myStudents: PalanqueeMember[] = []
                
                for (const rotation of palanqueesRes.data.rotations) {
                  for (const palanquee of rotation.palanquees) {
                    // Vérifier si je suis dans cette palanquée comme GP
                    const amIGP = palanquee.members.some(m => 
                      m.questionnaire_id === myQuest.id && (m.role === 'GP' || m.role === 'E')
                    )
                    
                    if (amIGP) {
                      // Ajouter les élèves de cette palanquée
                      const students = palanquee.members.filter(m => 
                        m.role === 'P' && m.questionnaire_id !== myQuest.id
                      )
                      myStudents.push(...students)
                    }
                  }
                }
                
                // Dédupliquer et garder seulement ceux qui préparent un niveau
                const uniqueStudents = myStudents
                  .filter((student, index, self) =>
                    index === self.findIndex(s => s.person_id === student.person_id)
                  )
                  .filter(student => student.preparing_level) // Seulement ceux en formation
                
                if (uniqueStudents.length > 0) {
                  pastWithStudents.push({
                    session,
                    myStudents: uniqueStudents
                  })
                }
              }
            } catch (e) {
              // Ignorer les erreurs
            }
          }
          
          setPastSessionsWithStudents(pastWithStudents)
        }
      }
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
        <h1 className="text-3xl font-bold text-white">📅 Sessions à venir</h1>
        <p className="text-slate-300 mt-1">Consultez les prochaines sessions de fosse</p>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-12 text-center">
          <p className="text-slate-400 text-lg">Aucune session à venir pour le moment.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => {
            const registration = myRegistrations.get(session.id)
            const isRegistered = !!registration
            const isEncadrant = registration?.isEncadrant || false
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
                className={`bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 border-l-4 ${
                  isRegistered ? 'border-green-500' : 'border-blue-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{session.name}</h2>
                    <p className="text-slate-300 mt-1">📍 {session.location || 'Lieu non précisé'}</p>
                    <p className="text-slate-300">📆 {formattedDate}</p>
                    {session.description && (
                      <p className="text-slate-400 mt-2 text-sm">{session.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {isRegistered ? (
                      <>
                        <span className="inline-flex items-center px-4 py-2 bg-green-500/20 text-green-400 rounded-full font-medium border border-green-500/30">
                          ✅ Inscrit {isEncadrant ? '(Encadrant)' : ''}
                        </span>
                        {isEncadrant && (
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => navigate(`/dashboard/palanquees/${session.id}`)}
                          >
                            🤿 Palanquées
                          </Button>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center px-4 py-2 bg-slate-500/20 text-slate-400 rounded-full font-medium border border-slate-500/30">
                        ❌ Non inscrit
                      </span>
                    )}
                  </div>
                </div>

                {/* Détails d'inscription - toujours visible */}
                {isRegistered && registration && (
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

      {/* Section Fosses passées pour les encadrants */}
      {myPerson?.is_instructor && pastSessionsWithStudents.length > 0 && (
        <div className="space-y-4">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowPastSessions(!showPastSessions)}
          >
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">📋 Mes fosses passées</h2>
              <p className="text-slate-300 text-sm mt-1">
                Validez les compétences des élèves en formation que vous avez encadrés
              </p>
            </div>
            <Button variant="secondary" size="sm">
              {showPastSessions ? '▲ Masquer' : '▼ Afficher'} ({pastSessionsWithStudents.length})
            </Button>
          </div>

          {showPastSessions && (
            <div className="space-y-4">
              {pastSessionsWithStudents.map(({ session, myStudents }) => {
                const sessionDate = new Date(session.start_date)
                const formattedDate = sessionDate.toLocaleDateString('fr-FR', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })

                return (
                  <div 
                    key={session.id}
                    className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-4 sm:p-6 border border-slate-700"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">{session.name}</h3>
                        <p className="text-sm text-slate-400">📆 {formattedDate} • 📍 {session.location}</p>
                      </div>
                      <span className="text-sm text-cyan-400 bg-cyan-500/20 px-3 py-1 rounded-full border border-cyan-500/30 self-start sm:self-auto">
                        {myStudents.length} élève{myStudents.length > 1 ? 's' : ''} en formation
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                      {myStudents.map((student) => (
                        <div
                          key={student.person_id}
                          onClick={() => navigate(`/dashboard/competences/student/${student.person_id}`)}
                          className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-slate-600 hover:border-cyan-500/50 hover:bg-slate-700/50 cursor-pointer transition-all group"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-white truncate group-hover:text-cyan-400 transition-colors">
                              {student.first_name} {student.last_name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              {student.diving_level && (
                                <span className="bg-slate-600/50 px-1.5 py-0.5 rounded">
                                  🤿 {student.diving_level}
                                </span>
                              )}
                              {student.preparing_level && (
                                <span className="bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                                  🎯 {student.preparing_level}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-cyan-400 group-hover:translate-x-1 transition-transform ml-2 flex-shrink-0">
                            →
                          </span>
                        </div>
                      ))}
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
