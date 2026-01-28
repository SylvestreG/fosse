import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sessionsApi, emailsApi, Session } from '@/lib/api'
import Button from '@/components/Button'
import Toast from '@/components/Toast'

interface EmailToSend {
  id: string
  to_email: string
  to_name: string
  subject: string
  body: string
  status: string
  sent_at: string | null
  expires_at: string
}

export default function SessionEmailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [emails, setEmails] = useState<EmailToSend[]>([])
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [previewEmail, setPreviewEmail] = useState<EmailToSend | null>(null)

  useEffect(() => {
    if (id) {
      loadData(id)
    }
  }, [id])

  const loadData = async (sessionId: string) => {
    try {
      const [sessionRes, emailsRes] = await Promise.all([
        sessionsApi.get(sessionId),
        emailsApi.getBySession(sessionId),
      ])
      setSession(sessionRes.data)
      setEmails(emailsRes.data)
    } catch (error: any) {
      setToast({ message: 'Erreur lors du chargement', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAll = () => {
    if (selectedEmails.size === pendingEmails.length) {
      setSelectedEmails(new Set())
    } else {
      setSelectedEmails(new Set(pendingEmails.map((e) => e.id)))
    }
  }

  const handleToggleEmail = (emailId: string) => {
    const newSelected = new Set(selectedEmails)
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId)
    } else {
      newSelected.add(emailId)
    }
    setSelectedEmails(newSelected)
  }

  const handleMarkAsSent = async () => {
    if (selectedEmails.size === 0) {
      setToast({ message: 'Aucun email sélectionné', type: 'error' })
      return
    }

    try {
      await Promise.all(
        Array.from(selectedEmails).map((emailId) => emailsApi.markAsSent(emailId))
      )
      setToast({ message: `${selectedEmails.size} email(s) marqué(s) comme envoyé(s)`, type: 'success' })
      setSelectedEmails(new Set())
      if (id) loadData(id)
    } catch (error) {
      setToast({ message: 'Erreur lors de la mise à jour', type: 'error' })
    }
  }

  const handleCopyEmail = (email: EmailToSend) => {
    navigator.clipboard.writeText(email.to_email)
    setToast({ message: `Email copié : ${email.to_email}`, type: 'success' })
  }

  const handleCopyEmailBody = (email: EmailToSend) => {
    navigator.clipboard.writeText(email.body)
    setToast({ message: 'Contenu HTML de l\'email copié ! Collez-le dans Gmail.', type: 'success' })
  }

  const handleCopyAllEmails = () => {
    const allEmails = emails.map((e) => e.to_email).join(', ')
    navigator.clipboard.writeText(allEmails)
    setToast({ message: `${emails.length} emails copiés`, type: 'success' })
  }

  const handleExportCSV = () => {
    const csv = [
      ['Nom', 'Email'].join(','),
      ...emails.map((e) => [e.to_name, e.to_email].join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `emails_${session?.name || 'session'}.csv`
    a.click()
  }

  if (loading) {
    return <div className="text-center py-12 theme-text">Chargement...</div>
  }

  if (!session) {
    return <div className="text-center py-12 theme-text">Session introuvable</div>
  }

  const pendingEmails = emails.filter((e) => e.status === 'generated')
  const sentEmails = emails.filter((e) => e.status === 'sent')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="secondary" onClick={() => navigate('/dashboard/sessions')}>
            ← Retour aux sessions
          </Button>
          <h1 className="text-3xl font-bold theme-text mt-4">📧 Emails - {session.name}</h1>
          <p className="theme-text-secondary">
            {pendingEmails.length} email(s) à envoyer • {sentEmails.length} envoyé(s)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleCopyAllEmails} disabled={pendingEmails.length === 0}>
            📋 Copier tous les emails
          </Button>
          <Button variant="secondary" onClick={handleExportCSV} disabled={pendingEmails.length === 0}>
            📥 Exporter CSV
          </Button>
        </div>
      </div>

      {pendingEmails.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
          <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900">Instructions</h3>
            <ol className="text-sm text-blue-800 mt-2 space-y-1 list-decimal list-inside">
              <li>Sélectionnez les emails que vous souhaitez envoyer</li>
              <li>Cliquez sur "Aperçu" pour voir le contenu de l'email</li>
              <li>Copiez les adresses et envoyez les emails via votre client mail</li>
              <li>Une fois envoyés, cochez les emails et cliquez sur "Marquer comme envoyés"</li>
            </ol>
          </div>
        </div>
      )}

      {selectedEmails.size > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-4 flex items-center justify-between">
          <p className="text-slate-200">
            <strong>{selectedEmails.size}</strong> email(s) sélectionné(s)
          </p>
          <Button onClick={handleMarkAsSent}>
            ✅ Marquer comme envoyés
          </Button>
        </div>
      )}

      <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-slate-700/30">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedEmails.size === pendingEmails.length && pendingEmails.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-primary-600 rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Nom</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Statut</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-slate-800/50 backdrop-blur-xl divide-y divide-gray-200">
            {emails.map((email) => (
              <tr key={email.id} className={email.status === 'sent' ? 'bg-green-50' : ''}>
                <td className="px-6 py-4">
                  {email.status === 'generated' && (
                    <input
                      type="checkbox"
                      checked={selectedEmails.has(email.id)}
                      onChange={() => handleToggleEmail(email.id)}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                  )}
                  {email.status === 'sent' && (
                    <span className="text-green-600 text-xl">✅</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-white">
                    {email.to_name}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-white">{email.to_email}</span>
                    <button
                      onClick={() => handleCopyEmail(email)}
                      className="text-gray-400 hover:text-slate-300"
                      title="Copier l'email"
                    >
                      📋
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {email.status === 'generated' ? (
                    <>
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        ⏳ À envoyer
                      </span>
                      <div className="text-xs text-slate-400 mt-1">
                        Expire le {new Date(email.expires_at).toLocaleDateString('fr-FR')}
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        ✅ Envoyé
                      </span>
                      {email.sent_at && (
                        <div className="text-xs text-slate-400 mt-1">
                          {new Date(email.sent_at).toLocaleString('fr-FR')}
                        </div>
                      )}
                    </>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex space-x-2">
                    <Button
                      variant="secondary"
                      onClick={() => setPreviewEmail(email)}
                      className="text-xs"
                    >
                      👁️ Aperçu
                    </Button>
                    {email.status === 'generated' && (
                      <Button
                        variant="primary"
                        onClick={async () => {
                          try {
                            await emailsApi.markAsSent(email.id)
                            setToast({ message: 'Email marqué comme envoyé', type: 'success' })
                            if (id) loadData(id)
                          } catch (error) {
                            setToast({ message: 'Erreur lors de la mise à jour', type: 'error' })
                          }
                        }}
                        className="text-xs bg-green-600 hover:bg-green-700"
                      >
                        ✓ Envoyé
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de prévisualisation */}
      {previewEmail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-600">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">Aperçu Email</h2>
                  <p className="text-sm text-slate-300 mt-1">
                    Destinataire : {previewEmail.to_name} ({previewEmail.to_email})
                  </p>
                </div>
                <button
                  onClick={() => setPreviewEmail(null)}
                  className="text-gray-400 hover:text-slate-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Action buttons */}
              <div className="flex space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopyEmail(previewEmail)}
                >
                  📧 Copier l'adresse : {previewEmail.to_email}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleCopyEmailBody(previewEmail)}
                >
                  📋 Copier tout le contenu (bouton)
                </Button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4 p-3 bg-slate-700/30 rounded">
                <p className="text-sm text-slate-200">
                  <strong>Sujet :</strong> {previewEmail.subject}
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-900">
                  💡 <strong>Pour envoyer via Gmail :</strong>
                </p>
                <ol className="text-sm text-blue-800 mt-2 ml-4 list-decimal space-y-1">
                  <li>Sélectionnez le contenu ci-dessous (Ctrl+A ou Cmd+A)</li>
                  <li>Copiez-le (Ctrl+C ou Cmd+C)</li>
                  <li>Ouvrez Gmail et créez un nouveau message</li>
                  <li>Collez le contenu (Ctrl+V ou Cmd+V)</li>
                  <li>Le formatage sera automatiquement conservé ✨</li>
                </ol>
              </div>
              
              <div className="border-2 border-primary-300 rounded-lg p-4 bg-slate-800/50 backdrop-blur-xl max-h-[500px] overflow-y-auto">
                <div 
                  className="prose max-w-none select-text"
                  dangerouslySetInnerHTML={{ __html: previewEmail.body }}
                  style={{ userSelect: 'text', WebkitUserSelect: 'text', MozUserSelect: 'text' }}
                />
              </div>
              
              <p className="text-xs text-slate-400 mt-2 italic">
                ℹ️ Le contenu ci-dessus est entièrement sélectionnable. Utilisez Ctrl+A (ou Cmd+A) pour tout sélectionner.
              </p>
            </div>
            <div className="p-6 border-t border-slate-600 flex justify-end">
              <Button variant="secondary" onClick={() => setPreviewEmail(null)}>
                Fermer
              </Button>
            </div>
          </div>
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

