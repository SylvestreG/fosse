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

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
