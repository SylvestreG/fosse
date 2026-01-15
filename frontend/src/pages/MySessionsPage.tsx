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
  onUpdate: (questId: string, data: Partial<QuestionnaireDetail>) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    wants_regulator: registration.wants_regulator,
    wants_nitrox: registration.wants_nitrox,
    wants_2nd_reg: registration.wants_2nd_reg,
    wants_stab: registration.wants_stab,
    stab_size: registration.stab_size || 'M',
    nitrox_training: registration.nitrox_training,
    comes_from_issoire: registration.comes_from_issoire,
    has_car: registration.has_car,
    car_seats: registration.car_seats || 0,
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(registration.id, formData)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      wants_regulator: registration.wants_regulator,
      wants_nitrox: registration.wants_nitrox,
      wants_2nd_reg: registration.wants_2nd_reg,
      wants_stab: registration.wants_stab,
      stab_size: registration.stab_size || 'M',
      nitrox_training: registration.nitrox_training,
      comes_from_issoire: registration.comes_from_issoire,
      has_car: registration.has_car,
      car_seats: registration.car_seats || 0,
    })
    setEditing(false)
  }

  if (!editing) {
    // Mode affichage
    return (
      <div className="mt-4 p-4 bg-slate-700/30 rounded-lg border border-slate-600">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-sm font-medium text-slate-300">Mes préférences</h3>
          <button 
            onClick={() => setEditing(true)}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            ✏️ Modifier
          </button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Matériel */}
          <div>
            <p className="text-xs text-slate-500 mb-2">🎒 Matériel</p>
            <div className="flex flex-wrap gap-2">
              {registration.wants_regulator && (
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Détendeur</span>
              )}
              {registration.wants_stab && (
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                  Stab {registration.stab_size}
                </span>
              )}
              {isEncadrant && registration.wants_nitrox && (
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">Nitrox</span>
              )}
              {isEncadrant && registration.wants_2nd_reg && (
                <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">2ème détendeur</span>
              )}
              {!isEncadrant && registration.nitrox_training && (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-1 rounded">🎓 Formation Nitrox</span>
              )}
              {!registration.wants_regulator && !registration.wants_stab && !registration.wants_nitrox && !registration.wants_2nd_reg && !registration.nitrox_training && (
                <span className="text-xs text-slate-500">Aucun matériel demandé</span>
              )}
            </div>
          </div>
          
          {/* Transport */}
          <div>
            <p className="text-xs text-slate-500 mb-2">🚗 Transport</p>
            <div className="flex flex-wrap gap-2">
              <span className={`text-xs px-2 py-1 rounded ${
                registration.comes_from_issoire 
                  ? 'bg-orange-500/20 text-orange-400' 
                  : 'bg-slate-500/20 text-slate-400'
              }`}>
                {registration.comes_from_issoire ? '📍 Départ Issoire' : '📍 Départ Clermont'}
              </span>
              {registration.has_car && (
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
                  🚗 Voiture ({registration.car_seats} places)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Mode édition
  return (
    <div className="mt-4 p-4 bg-slate-700/50 rounded-lg border-2 border-cyan-500/50">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-sm font-medium text-white">✏️ Modifier mes préférences</h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Matériel */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-300">🎒 Matériel</p>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.wants_regulator}
              onChange={e => setFormData({ ...formData, wants_regulator: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-slate-300">Détendeur</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.wants_stab}
              onChange={e => setFormData({ ...formData, wants_stab: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-slate-300">Stab</span>
          </label>
          
          {formData.wants_stab && (
            <select
              value={formData.stab_size}
              onChange={e => setFormData({ ...formData, stab_size: e.target.value })}
              className="ml-6 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-sm"
            >
              <option value="XS">XS</option>
              <option value="S">S</option>
              <option value="M">M</option>
              <option value="L">L</option>
              <option value="XL">XL</option>
            </select>
          )}

          {isEncadrant && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.wants_nitrox}
                  onChange={e => setFormData({ ...formData, wants_nitrox: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-slate-300">Nitrox</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.wants_2nd_reg}
                  onChange={e => setFormData({ ...formData, wants_2nd_reg: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-slate-300">2ème détendeur</span>
              </label>
            </>
          )}

          {!isEncadrant && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.nitrox_training}
                onChange={e => setFormData({ ...formData, nitrox_training: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-slate-300">🎓 Formation Nitrox</span>
            </label>
          )}
        </div>

        {/* Transport */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-300">🚗 Transport</p>
          
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="transport"
                checked={formData.comes_from_issoire}
                onChange={() => setFormData({ ...formData, comes_from_issoire: true })}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-300">Départ Issoire</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="transport"
                checked={!formData.comes_from_issoire}
                onChange={() => setFormData({ ...formData, comes_from_issoire: false })}
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-300">Départ Clermont</span>
            </label>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.has_car}
              onChange={e => setFormData({ ...formData, has_car: e.target.checked, car_seats: e.target.checked ? 4 : 0 })}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-slate-300">J'ai une voiture</span>
          </label>

          {formData.has_car && (
            <div className="ml-6 flex items-center gap-2">
              <span className="text-sm text-slate-400">Places :</span>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.car_seats}
                onChange={e => setFormData({ ...formData, car_seats: parseInt(e.target.value) || 0 })}
                className="w-16 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-sm text-center"
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-600">
        <Button variant="secondary" size="sm" onClick={handleCancel} disabled={saving}>
          Annuler
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? '⏳ Enregistrement...' : '✅ Enregistrer'}
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
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())

  // Si on impersonnifie, utiliser l'email de la personne impersonnifiée
  const targetEmail = impersonating?.user_email || email

  const toggleSessionExpand = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev)
      if (next.has(sessionId)) {
        next.delete(sessionId)
      } else {
        next.add(sessionId)
      }
      return next
    })
  }

  const handleUpdateQuestionnaire = async (questId: string, data: Partial<QuestionnaireDetail>) => {
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
      })
      // Recharger les données pour mettre à jour l'affichage
      await loadData()
      setToast({ message: 'Préférences mises à jour !', type: 'success' })
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

            const isExpanded = expandedSessions.has(session.id)

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
                        <div className="flex gap-2">
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => toggleSessionExpand(session.id)}
                          >
                            {isExpanded ? '▲ Masquer' : '▼ Mes infos'}
                          </Button>
                          {isEncadrant && (
                            <Button 
                              variant="secondary" 
                              size="sm"
                              onClick={() => navigate(`/dashboard/palanquees/${session.id}`)}
                            >
                              🤿 Palanquées
                            </Button>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="inline-flex items-center px-4 py-2 bg-slate-500/20 text-slate-400 rounded-full font-medium border border-slate-500/30">
                        ❌ Non inscrit
                      </span>
                    )}
                  </div>
                </div>

                {/* Détails d'inscription */}
                {isRegistered && isExpanded && registration && (
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
