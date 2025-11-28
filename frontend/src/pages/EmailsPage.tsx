import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionsApi, emailsApi, Session, EmailToSend } from '@/lib/api'
import Button from '@/components/Button'
import Toast from '@/components/Toast'

interface SessionWithEmails extends Session {
  emails: EmailToSend[]
  pendingCount: number
  sentCount: number
}

export default function EmailsPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<SessionWithEmails[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadSessionsWithEmails()
  }, [])

  const loadSessionsWithEmails = async () => {
    try {
      // Load all sessions
      const sessionsResponse = await sessionsApi.list()
      const allSessions = sessionsResponse.data
      
      // Load emails for each session
      const sessionsWithEmails: SessionWithEmails[] = await Promise.all(
        allSessions.map(async (session) => {
          try {
            const emailsResponse = await emailsApi.getBySession(session.id)
            const emails = emailsResponse.data
            const pendingCount = emails.filter((e: EmailToSend) => e.status === 'generated').length
            const sentCount = emails.filter((e: EmailToSend) => e.status === 'sent').length
            
            return {
              ...session,
              emails,
              pendingCount,
              sentCount,
            }
          } catch (error) {
            return {
              ...session,
              emails: [],
              pendingCount: 0,
              sentCount: 0,
            }
          }
        })
      )
      
      // Sort by date (most recent first)
      sessionsWithEmails.sort((a, b) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      )
      
      setSessions(sessionsWithEmails)
    } catch (error) {
      setToast({ message: 'Erreur lors du chargement des sessions', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const getTotalStats = () => {
    const totalPending = sessions.reduce((sum, s) => sum + s.pendingCount, 0)
    const totalSent = sessions.reduce((sum, s) => sum + s.sentCount, 0)
    const totalEmails = totalPending + totalSent
    return { totalEmails, totalPending, totalSent }
  }

  const copyToClipboard = (text: string, label: string = 'Email') => {
    navigator.clipboard.writeText(text)
    setToast({ message: `${label} copié dans le presse-papier`, type: 'success' })
  }

  const copyAllPendingEmails = (sessionEmails: EmailToSend[]) => {
    const pendingEmails = sessionEmails
      .filter(e => e.status === 'generated')
      .map(e => e.to_email)
      .join(', ')
    
    if (pendingEmails) {
      copyToClipboard(pendingEmails, `${sessionEmails.filter(e => e.status === 'generated').length} emails`)
    } else {
      setToast({ message: 'Aucun email à copier', type: 'error' })
    }
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  const stats = getTotalStats()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">📧 Emails par Session</h1>
        <Button variant="secondary" onClick={loadSessionsWithEmails}>
          🔄 Actualiser
        </Button>
      </div>

      {/* Statistics */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-gray-50">
            <div className="text-3xl font-bold text-gray-900">{stats.totalEmails}</div>
            <div className="text-sm text-gray-600 font-medium">📧 Total emails</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-yellow-50 border-2 border-yellow-200">
            <div className="text-3xl font-bold text-yellow-700">{stats.totalPending}</div>
            <div className="text-sm text-yellow-800 font-semibold">⏳ À envoyer</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-green-50 border-2 border-green-200">
            <div className="text-3xl font-bold text-green-700">{stats.totalSent}</div>
            <div className="text-sm text-green-800 font-semibold">✅ Envoyés</div>
          </div>
        </div>
      </div>

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">Aucune session avec des emails</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div key={session.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Session Header */}
              <div className="bg-gradient-to-r from-primary-50 to-primary-100 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{session.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      📅 {new Date(session.start_date).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                      {session.location && ` • 📍 ${session.location}`}
                    </p>
                  </div>
                  <div className="flex items-center space-x-4">
                    {/* Stats badges */}
                    <div className="flex items-center space-x-2">
                      {session.pendingCount > 0 && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
                          ⏳ {session.pendingCount}
                        </span>
                      )}
                      {session.sentCount > 0 && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">
                          ✅ {session.sentCount}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/dashboard/emails/session/${session.id}`)}
                    >
                      📧 Gérer les emails
                    </Button>
                  </div>
                </div>
              </div>

              {/* Emails summary */}
              {session.emails.length > 0 ? (
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pending emails */}
                    {session.pendingCount > 0 && (
                      <div className="border-2 border-yellow-200 rounded-lg p-4 bg-yellow-50">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-yellow-900">
                            ⏳ À envoyer ({session.pendingCount})
                          </h4>
                          <button
                            onClick={() => copyAllPendingEmails(session.emails)}
                            className="text-xs px-2 py-1 bg-yellow-200 hover:bg-yellow-300 text-yellow-900 rounded transition-colors"
                            title="Copier tous les emails à envoyer"
                          >
                            📋 Copier tous
                          </button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {session.emails
                            .filter(e => e.status === 'generated')
                            .slice(0, 5)
                            .map((email) => (
                              <div key={email.id} className="text-sm text-gray-700 flex items-center justify-between group hover:bg-yellow-100 px-2 py-1 rounded transition-colors">
                                <span className="flex-1 truncate">
                                  👤 {email.to_name}
                                  <span className="text-gray-500 ml-2 text-xs">({email.to_email})</span>
                                </span>
                                <button
                                  onClick={() => copyToClipboard(email.to_email, 'Email')}
                                  className="ml-2 text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Copier l'email"
                                >
                                  📋
                                </button>
                              </div>
                            ))}
                          {session.pendingCount > 5 && (
                            <p className="text-xs text-gray-500 italic">
                              ... et {session.pendingCount - 5} autre(s)
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Sent emails */}
                    {session.sentCount > 0 && (
                      <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
                        <h4 className="font-semibold text-green-900 mb-3">
                          ✅ Envoyés ({session.sentCount})
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {session.emails
                            .filter(e => e.status === 'sent')
                            .slice(0, 5)
                            .map((email) => (
                              <div key={email.id} className="text-sm text-gray-700 flex items-center justify-between group hover:bg-green-100 px-2 py-1 rounded transition-colors">
                                <span className="flex-1 truncate">
                                  👤 {email.to_name}
                                  <span className="text-gray-500 ml-2 text-xs">({email.to_email})</span>
                                </span>
                                <div className="flex items-center space-x-2">
                                  {email.sent_at && (
                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                      {new Date(email.sent_at).toLocaleDateString('fr-FR')}
                                    </span>
                                  )}
                                  <button
                                    onClick={() => copyToClipboard(email.to_email, 'Email')}
                                    className="text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Copier l'email"
                                  >
                                    📋
                                  </button>
                                </div>
                              </div>
                            ))}
                          {session.sentCount > 5 && (
                            <p className="text-xs text-gray-500 italic">
                              ... et {session.sentCount - 5} autre(s)
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  Aucun email pour cette session
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
