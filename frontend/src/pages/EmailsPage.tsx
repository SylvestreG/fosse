import { useEffect, useState } from 'react'
import { sessionsApi, questionnairesApi, Session, QuestionnaireDetail } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import Button from '@/components/Button'
import Toast from '@/components/Toast'

export default function EmailsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [participants, setParticipants] = useState<QuestionnaireDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingParticipants, setLoadingParticipants] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  const { email: myEmail } = useAuthStore()

  useEffect(() => {
    loadSessions()
  }, [])

  useEffect(() => {
    if (selectedSession) {
      loadParticipants(selectedSession.id)
    } else {
      setParticipants([])
    }
  }, [selectedSession])

  const loadSessions = async () => {
    try {
      const response = await sessionsApi.list()
      // Trier par date décroissante (plus récentes en premier)
      const sortedSessions = response.data.sort((a, b) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      )
      setSessions(sortedSessions)
      
      // Sélectionner automatiquement la prochaine session (la plus proche dans le futur)
      const now = new Date()
      const futureSession = sortedSessions.find(s => new Date(s.start_date) >= now)
      if (futureSession) {
        setSelectedSession(futureSession)
      } else if (sortedSessions.length > 0) {
        setSelectedSession(sortedSessions[0])
      }
    } catch (error) {
      setToast({ message: 'Erreur lors du chargement des sessions', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const loadParticipants = async (sessionId: string) => {
    setLoadingParticipants(true)
    try {
      const response = await questionnairesApi.listDetail(sessionId)
      setParticipants(response.data)
    } catch (error) {
      setParticipants([])
    } finally {
      setLoadingParticipants(false)
    }
  }

  // Filtrer les participants en excluant mon email
  const filteredParticipants = participants.filter(p => 
    p.email.toLowerCase() !== myEmail?.toLowerCase()
  )

  const generateSubject = (session: Session): string => {
    const date = new Date(session.start_date)
    const formattedDate = date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
    const lieu = session.location || 'Coubertin'
    return `Fosse ${lieu} - ${formattedDate}`
  }

  const generateInvitationEmail = (session: Session): string => {
    const date = new Date(session.start_date)
    const formattedDate = date.toLocaleDateString('fr-FR', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
    
    const lieu = session.location || 'Coubertin'
    
    return `Bonjour,

Vous êtes inscrits à la fosse de ${lieu} ce ${formattedDate}.

Merci de me confirmer votre présence, de m'indiquer si vous serez au local ou directement à la piscine de ${lieu} et si vous avez une voiture à disposition ( et si oui combien de place) . Pour rappel : départ d'Issoire à 19h, rendez-vous à Coubertin aux alentours de 20h. 


Merci également de m'indiquer au plus vite si vous avez besoin de matériel ; si oui, précisez la taille du gilet et si vous avez besoin d'un détendeur.


Si besoin, voici mon numéro de téléphone : 06 63 90 35 21


Cordialement,`
  }

  const generateMaterialEmail = (session: Session): string => {
    const date = new Date(session.start_date)
    const formattedDate = date.toLocaleDateString('fr-FR', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
    
    const lieu = session.location || 'Coubertin'
    const basePath = import.meta.env.MODE === 'production' ? '/fosse' : ''
    const summaryUrl = session.summary_token 
      ? `${window.location.origin}${basePath}/s/${session.summary_token}`
      : '[Lien non disponible - générer les liens d\'abord]'
    
    return `Bonjour,

Je vous contacte pour une demande de matériel pour la session de fosse prévue le ${formattedDate} à ${lieu}.

Le matériel demandé peut se suivre ici : ${summaryUrl}

Cordialement,`
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setToast({ message: `${label} copié !`, type: 'success' })
  }

  const copyAllEmails = () => {
    const emails = filteredParticipants.map(p => p.email).join(', ')
    copyToClipboard(emails, `${filteredParticipants.length} email(s)`)
  }

  if (loading) {
    return <div className="text-center py-12 theme-text">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold theme-text">📧 Emails</h1>
        <p className="theme-text-secondary mt-1">Sélectionnez une fosse et copiez l'email à envoyer</p>
      </div>

      {/* Sélecteur de session */}
      <div className="theme-card p-6 shadow">
        <label className="block text-sm font-medium theme-text-secondary mb-2">
          🏊 Sélectionner une fosse
        </label>
        <select
          value={selectedSession?.id || ''}
          onChange={(e) => {
            const session = sessions.find(s => s.id === e.target.value)
            setSelectedSession(session || null)
          }}
          className="w-full px-4 py-3 theme-select rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
        >
          <option value="">-- Choisir une fosse --</option>
          {sessions.map(session => {
            const date = new Date(session.start_date)
            const formattedDate = date.toLocaleDateString('fr-FR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })
            const isPast = date < new Date()
            return (
              <option key={session.id} value={session.id}>
                {isPast ? '⏳ ' : '📅 '}{session.name} - {formattedDate}
              </option>
            )
          })}
        </select>
      </div>

      {selectedSession && (
        <>
          {/* Info session */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <h2 className="text-xl font-bold text-blue-900 mb-2">
              📍 {selectedSession.name}
            </h2>
            <p className="text-blue-800">
              📅 {new Date(selectedSession.start_date).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
              {selectedSession.location && ` • 🏊 ${selectedSession.location}`}
            </p>
          </div>

          {/* Liste des destinataires */}
          <div className="theme-card shadow overflow-hidden">
            <div className="bg-purple-500/10 px-6 py-4 border-b border-purple-500/30 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-purple-400">👥 Destinataires</h3>
                <p className="text-sm text-purple-300">
                  {filteredParticipants.length} participant(s) 
                  {myEmail && <span className="text-purple-400/70"> (vous exclu)</span>}
                </p>
              </div>
              <Button 
                onClick={copyAllEmails} 
                disabled={filteredParticipants.length === 0}
                className="bg-purple-600 hover:bg-purple-700"
              >
                📋 Copier tous les emails
              </Button>
            </div>
            <div className="p-6">
              {loadingParticipants ? (
                <p className="text-center theme-text-muted">Chargement des participants...</p>
              ) : filteredParticipants.length === 0 ? (
                <p className="text-center theme-text-muted">Aucun participant pour cette session</p>
              ) : (
                <>
                  {/* Emails copiables en une ligne */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium theme-text-secondary mb-2">
                      📧 Emails (à coller dans "À:")
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={filteredParticipants.map(p => p.email).join(', ')}
                        className="flex-1 px-4 py-2 theme-bg-input rounded-lg text-sm font-mono"
                      />
                      <Button variant="secondary" onClick={copyAllEmails}>
                        📋
                      </Button>
                    </div>
                  </div>
                  
                  {/* Liste détaillée */}
                  <div className="border theme-border rounded-lg divide-y theme-border max-h-48 overflow-y-auto">
                    {filteredParticipants.map(p => (
                      <div key={p.id} className="px-4 py-2 flex items-center justify-between theme-hover">
                        <div>
                          <span className="font-medium theme-text">{p.first_name} {p.last_name}</span>
                          {p.is_encadrant && (
                            <span className="ml-2 text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                              Encadrant
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm theme-text-muted">{p.email}</span>
                          <button
                            onClick={() => copyToClipboard(p.email, 'Email')}
                            className="theme-text-muted hover:theme-text-secondary"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Objet du mail */}
          <div className="theme-card shadow overflow-hidden">
            <div className="bg-blue-500/10 px-6 py-4 border-b border-blue-500/30 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-blue-400">📝 Objet du mail</h3>
              </div>
              <Button 
                onClick={() => copyToClipboard(generateSubject(selectedSession), 'Objet')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                📋 Copier l'objet
              </Button>
            </div>
            <div className="p-6">
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={generateSubject(selectedSession)}
                  className="flex-1 px-4 py-3 theme-bg-input rounded-lg text-lg font-medium"
                />
                <Button variant="secondary" onClick={() => copyToClipboard(generateSubject(selectedSession), 'Objet')}>
                  📋
                </Button>
              </div>
            </div>
          </div>

          {/* Email d'invitation */}
          <div className="theme-card shadow overflow-hidden">
            <div className="bg-green-500/10 px-6 py-4 border-b border-green-500/30 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-green-400">✉️ Corps du mail - Invitation</h3>
                <p className="text-sm text-green-300">Pour inviter les participants à la fosse</p>
              </div>
              <Button 
                onClick={() => copyToClipboard(generateInvitationEmail(selectedSession), 'Email d\'invitation')} 
                className="bg-green-600 hover:bg-green-700"
              >
                📋 Copier le contenu
              </Button>
            </div>
            <div className="p-6">
              <pre className="whitespace-pre-wrap text-sm theme-text-secondary theme-bg-card p-4 rounded-lg border theme-border font-sans leading-relaxed">
                {generateInvitationEmail(selectedSession)}
              </pre>
            </div>
          </div>

          {/* Email de demande de matériel */}
          <div className="theme-card shadow overflow-hidden">
            <div className="bg-amber-500/10 px-6 py-4 border-b border-amber-500/30 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-amber-400">🎒 Corps du mail - Demande de matériel</h3>
                <p className="text-sm text-amber-300">Pour demander le matériel au club</p>
              </div>
              <Button 
                onClick={() => copyToClipboard(generateMaterialEmail(selectedSession), 'Email matériel')} 
                className="bg-amber-600 hover:bg-amber-700"
              >
                📋 Copier le contenu
              </Button>
            </div>
            <div className="p-6">
              <pre className="whitespace-pre-wrap text-sm theme-text-secondary theme-bg-card p-4 rounded-lg border theme-border font-sans leading-relaxed">
                {generateMaterialEmail(selectedSession)}
              </pre>
            </div>
          </div>
        </>
      )}

      {!selectedSession && sessions.length > 0 && (
        <div className="theme-card p-12 text-center shadow">
          <p className="theme-text-muted text-lg">👆 Sélectionnez une fosse ci-dessus pour voir les emails</p>
        </div>
      )}

      {sessions.length === 0 && (
        <div className="theme-card p-12 text-center shadow">
          <p className="theme-text-muted">Aucune session disponible</p>
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
