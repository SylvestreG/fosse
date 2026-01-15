import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionsApi, questionnairesApi, peopleApi, palanqueesApi, Session, Person, QuestionnaireDetail, PalanqueeMember } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import Toast from '@/components/Toast'

interface MyRegistration {
  questionnaire: QuestionnaireDetail
  isEncadrant: boolean
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
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [showPastSessions, setShowPastSessions] = useState(false)

  // Si on impersonnifie, utiliser l'email de la personne impersonnifiée
  const targetEmail = impersonating?.user_email || email

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
                
                // Dédupliquer les élèves (un élève peut être dans plusieurs rotations)
                const uniqueStudents = myStudents.filter((student, index, self) =>
                  index === self.findIndex(s => s.person_id === student.person_id)
                )
                
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

  const handleOpenRegister = (session: Session) => {
    setSelectedSession(session)
    setShowRegisterModal(true)
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">📅 Sessions à venir</h1>
        <p className="text-slate-300 mt-1">Inscrivez-vous aux prochaines sessions de fosse</p>
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
                        <span className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full font-medium">
                          ✅ Inscrit
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
                      <Button onClick={() => handleOpenRegister(session)}>
                        📝 S'inscrire
                      </Button>
                    )}
                  </div>
                </div>
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
                Validez les compétences des élèves que vous avez encadrés
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
                        {myStudents.length} élève{myStudents.length > 1 ? 's' : ''} encadré{myStudents.length > 1 ? 's' : ''}
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

      {showRegisterModal && selectedSession && myPerson && (
        <RegisterModal
          session={selectedSession}
          person={myPerson}
          onClose={() => {
            setShowRegisterModal(false)
            setSelectedSession(null)
          }}
          onSuccess={() => {
            setShowRegisterModal(false)
            setSelectedSession(null)
            loadData()
            setToast({ message: 'Inscription réussie !', type: 'success' })
          }}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}

// Modal d'inscription
interface RegisterModalProps {
  session: Session
  person: Person
  onClose: () => void
  onSuccess: () => void
}

function RegisterModal({ session, person, onClose, onSuccess }: RegisterModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Pré-remplir avec les préférences de l'utilisateur
  const [formData, setFormData] = useState({
    is_encadrant: person.is_instructor,
    wants_regulator: person.default_wants_regulator,
    wants_nitrox: person.is_instructor && person.default_wants_nitrox,
    wants_2nd_reg: person.is_instructor && person.default_wants_2nd_reg,
    wants_stab: person.default_wants_stab,
    stab_size: person.default_stab_size || 'M',
    nitrox_training: false,
    comes_from_issoire: true,
    has_car: false,
    car_seats: 0,
    comments: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Créer le questionnaire via l'API
      await questionnairesApi.register({
        session_id: session.id,
        email: person.email,
        first_name: person.first_name,
        last_name: person.last_name,
        ...formData,
        stab_size: formData.wants_stab ? formData.stab_size : undefined,
        car_seats: formData.has_car ? formData.car_seats : undefined,
      })
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de l\'inscription')
    } finally {
      setLoading(false)
    }
  }

  const sessionDate = new Date(session.start_date)
  const formattedDate = sessionDate.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  return (
    <Modal isOpen={true} onClose={onClose} title={`Inscription - ${session.name}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>
        )}

        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="font-medium text-blue-900">📅 {formattedDate}</p>
          <p className="text-blue-800">📍 {session.location}</p>
        </div>

        <div className="bg-slate-700/30 p-4 rounded-lg">
          <p className="font-medium">Participant</p>
          <p className="text-slate-300">{person.first_name} {person.last_name}</p>
          <p className="text-slate-400 text-sm">{person.email}</p>
        </div>

        {/* Encadrant - seulement si la personne est instructeur */}
        {person.is_instructor && (
          <div className="border rounded-lg p-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={formData.is_encadrant}
                onChange={(e) => setFormData({ ...formData, is_encadrant: e.target.checked })}
                className="w-5 h-5"
              />
              <div>
                <span className="font-medium">👨‍🏫 Je serai encadrant</span>
                <p className="text-sm text-slate-400">Je participe en tant qu'encadrant pour cette session</p>
              </div>
            </label>
          </div>
        )}

        {/* Matériel */}
        <div className="space-y-4">
          <h3 className="font-semibold">Matériel demandé</h3>

          <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-700/30">
            <input
              type="checkbox"
              checked={formData.wants_regulator}
              onChange={(e) => setFormData({ ...formData, wants_regulator: e.target.checked })}
              className="w-5 h-5"
            />
            <span>Détendeur</span>
          </label>

          {person.is_instructor && formData.is_encadrant && (
            <>
              <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-700/30">
                <input
                  type="checkbox"
                  checked={formData.wants_nitrox}
                  onChange={(e) => setFormData({ ...formData, wants_nitrox: e.target.checked })}
                  className="w-5 h-5"
                />
                <span>Nitrox</span>
              </label>

              <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-700/30">
                <input
                  type="checkbox"
                  checked={formData.wants_2nd_reg}
                  onChange={(e) => setFormData({ ...formData, wants_2nd_reg: e.target.checked })}
                  className="w-5 h-5"
                />
                <span>2ème détendeur (encadrement)</span>
              </label>
            </>
          )}

          {!formData.is_encadrant && (
            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-700/30">
              <input
                type="checkbox"
                checked={formData.nitrox_training}
                onChange={(e) => setFormData({ ...formData, nitrox_training: e.target.checked })}
                className="w-5 h-5"
              />
              <div>
                <span>🎓 Formation Nitrox</span>
                <p className="text-sm text-slate-400">Je participe à la formation nitrox (bloc nitrox)</p>
              </div>
            </label>
          )}

          <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-700/30">
            <input
              type="checkbox"
              checked={formData.wants_stab}
              onChange={(e) => setFormData({ ...formData, wants_stab: e.target.checked })}
              className="w-5 h-5"
            />
            <span>Stab</span>
          </label>

          {formData.wants_stab && (
            <div className="ml-8">
              <label className="block text-sm font-medium mb-1">Taille de stab</label>
              <select
                value={formData.stab_size}
                onChange={(e) => setFormData({ ...formData, stab_size: e.target.value })}
                className="w-full px-3 py-2 border border-slate-600 rounded-lg"
              >
                <option value="XS">XS</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
              </select>
            </div>
          )}
        </div>

        {/* Transport */}
        <div className="space-y-4">
          <h3 className="font-semibold">Transport</h3>

          <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-700/30">
            <input
              type="checkbox"
              checked={formData.comes_from_issoire}
              onChange={(e) => setFormData({ ...formData, comes_from_issoire: e.target.checked })}
              className="w-5 h-5"
            />
            <span>Je pars d'Issoire</span>
          </label>

          <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-700/30">
            <input
              type="checkbox"
              checked={formData.has_car}
              onChange={(e) => setFormData({ ...formData, has_car: e.target.checked, car_seats: e.target.checked ? 4 : 0 })}
              className="w-5 h-5"
            />
            <span>J'ai une voiture</span>
          </label>

          {formData.has_car && (
            <div className="ml-8">
              <label className="block text-sm font-medium mb-1">Nombre de places disponibles</label>
              <input
                type="number"
                min="0"
                max="10"
                value={formData.car_seats}
                onChange={(e) => setFormData({ ...formData, car_seats: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-600 rounded-lg"
              />
            </div>
          )}
        </div>

        {/* Commentaires */}
        <div>
          <label className="block text-sm font-medium mb-1">Commentaires (optionnel)</label>
          <textarea
            value={formData.comments}
            onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
            className="w-full px-3 py-2 border border-slate-600 rounded-lg"
            rows={3}
            placeholder="Informations supplémentaires..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Inscription...' : '✅ Confirmer mon inscription'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

