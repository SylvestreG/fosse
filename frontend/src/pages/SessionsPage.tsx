import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionsApi, questionnairesApi, importApi, Session, QuestionnaireDetail } from '@/lib/api'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Modal from '@/components/Modal'
import Table from '@/components/Table'
import Toast from '@/components/Toast'
import EditQuestionnaireModal from '@/components/EditQuestionnaireModal'
import AddParticipantModal from '@/components/AddParticipantModal'

export default function SessionsPage() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireDetail[]>([])
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<QuestionnaireDetail | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    location: 'Coubertin',
    description: '',
    csvFile: null as File | null,
  })

  // Générer automatiquement le nom : lieu - date
  useEffect(() => {
    if (formData.location && formData.start_date) {
      const date = new Date(formData.start_date)
      const formattedDate = date.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      })
      const generatedName = `${formData.location} - ${formattedDate}`
      setFormData(prev => ({ ...prev, name: generatedName }))
    }
  }, [formData.location, formData.start_date])

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      const response = await sessionsApi.list()
      // Trier par date décroissante (plus récentes en premier)
      const sortedSessions = response.data.sort((a, b) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      )
      setSessions(sortedSessions)
    } catch (error) {
      setToast({ message: 'Erreur lors du chargement des sessions', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const loadQuestionnaires = async (sessionId: string) => {
    try {
      const response = await questionnairesApi.listDetail(sessionId)
      setQuestionnaires(response.data)
    } catch (error) {
      setToast({ message: 'Erreur lors du chargement des questionnaires', type: 'error' })
    }
  }

  const handleEditQuestionnaire = (questionnaire: QuestionnaireDetail) => {
    setSelectedQuestionnaire(questionnaire)
    setShowEditModal(true)
  }

  const handleDeleteQuestionnaire = async (questionnaire: QuestionnaireDetail) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le participant "${questionnaire.first_name} ${questionnaire.last_name}" de cette session ?`)) {
      return
    }

    try {
      await questionnairesApi.delete(questionnaire.id)
      setToast({ message: 'Participant supprimé avec succès', type: 'success' })
      if (selectedSession) {
        await loadQuestionnaires(selectedSession.id)
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la suppression'
      setToast({ message: errorMessage, type: 'error' })
    }
  }

  const handleSaveQuestionnaire = async (id: string, data: any) => {
    try {
      await questionnairesApi.update(id, data)
      setToast({ message: 'Questionnaire modifié avec succès', type: 'success' })
      if (selectedSession) {
        await loadQuestionnaires(selectedSession.id)
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la modification'
      setToast({ message: errorMessage, type: 'error' })
      throw error
    }
  }

  const handleToggleStatus = async (questionnaire: QuestionnaireDetail) => {
    const newStatus = !questionnaire.submitted_at
    const statusText = newStatus ? 'soumis' : 'non soumis'
    
    if (!confirm(`Marquer ce questionnaire comme ${statusText} ?`)) {
      return
    }

    try {
      await questionnairesApi.update(questionnaire.id, {
        is_encadrant: questionnaire.is_encadrant,
        wants_regulator: questionnaire.wants_regulator,
        wants_nitrox: questionnaire.wants_nitrox,
        wants_2nd_reg: questionnaire.wants_2nd_reg,
        wants_stab: questionnaire.wants_stab,
        stab_size: questionnaire.stab_size,
        comes_from_issoire: questionnaire.comes_from_issoire,
        has_car: questionnaire.has_car,
        car_seats: questionnaire.car_seats,
        comments: questionnaire.comments,
        mark_as_submitted: newStatus,
      })
      setToast({ message: `Questionnaire marqué comme ${statusText}`, type: 'success' })
      if (selectedSession) {
        await loadQuestionnaires(selectedSession.id)
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la modification du statut'
      setToast({ message: errorMessage, type: 'error' })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setToast({ message: 'Lien copié !', type: 'success' })
  }

  const copySummaryLink = (session: Session) => {
    if (!session.summary_token) {
      setToast({ message: 'Aucun token de récapitulatif disponible', type: 'error' })
      return
    }
    const basePath = import.meta.env.MODE === 'production' ? '/fosse' : ''
    const summaryUrl = `${window.location.origin}${basePath}/s/${session.summary_token}`
    navigator.clipboard.writeText(summaryUrl)
    setToast({ message: 'Lien du récapitulatif copié !', type: 'success' })
  }

  const copyMaterialRequestEmail = () => {
    if (!selectedSession) return
    
    if (!selectedSession.summary_token) {
      setToast({ message: 'Aucun token de récapitulatif disponible', type: 'error' })
      return
    }
    
    const basePath = import.meta.env.MODE === 'production' ? '/fosse' : ''
    const summaryUrl = `${window.location.origin}${basePath}/s/${selectedSession.summary_token}`
    
    const date = new Date(selectedSession.start_date)
    const formattedDate = date.toLocaleDateString('fr-FR', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
    
    const emailContent = `Bonjour,

Je vous contacte pour une demande de matériel pour la session de fosse prévue le ${formattedDate} à ${selectedSession.location}.

Le matériel demandé peut se suivre ici : ${summaryUrl}

Cordialement,`
    
    navigator.clipboard.writeText(emailContent)
    setToast({ message: 'Email de demande de matériel copié !', type: 'success' })
  }

  const copyInvitationEmail = () => {
    if (!selectedSession) return
    
    const date = new Date(selectedSession.start_date)
    const formattedDate = date.toLocaleDateString('fr-FR', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })
    
    const lieu = selectedSession.location || 'Coubertin'
    
    const emailContent = `Bonjour,

Vous êtes inscrits à la fosse de ${lieu} ce ${formattedDate}.

Merci de me confirmer votre présence, de m'indiquer si vous serez au local ou directement à la piscine de ${lieu} et si vous avez une voiture à disposition ( et si oui combien de place) . Pour rappel : départ d'Issoire à 19h, rendez-vous à Coubertin aux alentours de 20h. 


Merci également de m'indiquer au plus vite si vous avez besoin de matériel ; si oui, précisez la taille du gilet et si vous avez besoin d'un détendeur.


Si besoin, voici mon numéro de téléphone : 06 63 90 35 21


Cordialement,`
    
    navigator.clipboard.writeText(emailContent)
    setToast({ message: 'Email d\'invitation copié !', type: 'success' })
  }

  const handleGenerateMagicLinks = async () => {
    if (!selectedSession) return
    
    if (!confirm('Générer les magic links pour tous les participants qui n\'en ont pas encore ?')) {
      return
    }

    try {
      const response = await sessionsApi.generateMagicLinks(selectedSession.id)
      setToast({ message: response.data.message, type: 'success' })
      // Reload questionnaires to show the new magic links
      await loadQuestionnaires(selectedSession.id)
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la génération des magic links'
      setToast({ message: errorMessage, type: 'error' })
    }
  }

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await sessionsApi.create({
        name: formData.name,
        start_date: formData.start_date,
        location: formData.location || undefined,
        description: formData.description || undefined,
      })
      
      // If CSV file is provided, import it immediately
      if (formData.csvFile) {
        await importApi.importCsv(response.data.id, formData.csvFile)
        setToast({ message: 'Session créée et CSV importé avec succès', type: 'success' })
      } else {
        setToast({ message: 'Session créée avec succès', type: 'success' })
      }
      
      setShowCreateModal(false)
      setFormData({ name: '', start_date: '', location: 'Coubertin', description: '', csvFile: null })
      loadSessions()
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la création de la session'
      setToast({ message: errorMessage, type: 'error' })
    }
  }

  const handleViewSession = async (session: Session) => {
    setSelectedSession(session)
    await loadQuestionnaires(session.id)
  }

  const handleDeleteSession = async (session: Session) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la session "${session.name}" ?\n\nToutes les données associées (questionnaires, emails) seront supprimées.`)) {
      return
    }
    
    try {
      await sessionsApi.delete(session.id)
      setToast({ message: 'Session supprimée avec succès', type: 'success' })
      loadSessions()
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la suppression'
      setToast({ message: errorMessage, type: 'error' })
    }
  }

  const sessionColumns = [
    { key: 'name', label: 'Nom' },
    { key: 'start_date', label: 'Date' },
    { key: 'location', label: 'Lieu' },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, row: Session) => (
        <div className="flex space-x-2">
          <Button size="sm" onClick={() => handleViewSession(row)}>
            Questionnaires
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate(`/dashboard/emails/session/${row.id}`)}>
            📧 Emails
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate(`/dashboard/summary/${row.id}`)}>
            📊 Récap
          </Button>
          <Button size="sm" variant="secondary" onClick={() => copySummaryLink(row)}>
            🔗 Copier lien
          </Button>
          <Button size="sm" variant="secondary" onClick={() => handleDeleteSession(row)}>
            🗑️ Supprimer
          </Button>
        </div>
      ),
    },
  ]

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Sessions</h1>
        <Button onClick={() => setShowCreateModal(true)}>Créer une session</Button>
      </div>

      {selectedSession ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="secondary" onClick={() => setSelectedSession(null)}>
                ← Retour
              </Button>
              <h2 className="text-2xl font-semibold text-gray-900">{selectedSession.name}</h2>
            </div>
            <div className="flex space-x-2 flex-wrap gap-2">
              <Button variant="secondary" onClick={handleGenerateMagicLinks}>
                🔗 Générer les liens
              </Button>
              <Button variant="secondary" onClick={copyInvitationEmail}>
                ✉️ Email invitation
              </Button>
              <Button variant="secondary" onClick={copyMaterialRequestEmail}>
                📧 Email matériel
              </Button>
              <Button onClick={() => setShowAddParticipantModal(true)}>
                ➕ Ajouter un participant
              </Button>
            </div>
          </div>
          {questionnaires.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">Aucun participant pour cette session.</p>
              <Button onClick={() => setShowAddParticipantModal(true)}>
                ➕ Ajouter le premier participant
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {questionnaires.map((q) => (
                <div key={q.id} className="bg-white p-6 rounded-lg shadow space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-lg font-medium">{q.first_name} {q.last_name}</p>
                      <p className="text-sm text-gray-600">{q.email}</p>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" onClick={() => handleEditQuestionnaire(q)}>
                        ✏️ Modifier
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleDeleteQuestionnaire(q)}>
                        🗑️ Supprimer
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p>Encadrant: {q.is_encadrant ? '✅' : '❌'}</p>
                    <p>Nitrox: {q.wants_nitrox ? '✅' : '❌'}</p>
                    <p>2ème détendeur: {q.wants_2nd_reg ? '✅' : '❌'}</p>
                    <p>Stab: {q.wants_stab ? `✅ (${q.stab_size || 'N/A'})` : '❌'}</p>
                    <p>Voiture: {q.has_car ? `✅ (${q.car_seats || 0} places)` : '❌'}</p>
                    <div className="col-span-2 flex items-center justify-between">
                      <p>Statut: {q.submitted_at ? '✅ Soumis' : '⏳ En attente'}</p>
                      <Button 
                        size="sm" 
                        variant={q.submitted_at ? 'secondary' : 'primary'}
                        onClick={() => handleToggleStatus(q)}
                      >
                        {q.submitted_at ? '↩️ Marquer non soumis' : '✅ Marquer soumis'}
                      </Button>
                    </div>
                  </div>

                  {q.comments && (
                    <p className="text-sm italic text-gray-600 border-t pt-2">"{q.comments}"</p>
                  )}

                  {q.magic_link && (
                    <div className="border-t pt-3 space-y-2">
                      <p className="text-sm font-medium text-gray-700">Magic Link:</p>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={q.magic_link}
                          readOnly
                          className="flex-1 text-sm px-3 py-2 border rounded-lg bg-gray-50 font-mono"
                        />
                        <Button size="sm" onClick={() => copyToClipboard(q.magic_link!)}>
                          📋 Copier
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500">
                        Statut email: <span className="font-medium">{q.email_status || 'N/A'}</span>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table data={sessions} columns={sessionColumns} />
        </div>
      )}

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Créer une session">
        <form onSubmit={handleCreateSession} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lieu
            </label>
            <select
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="Coubertin">Coubertin</option>
              <option value="Montluçon">Montluçon</option>
              <option value="Le Puy-en-Velay">Le Puy-en-Velay</option>
            </select>
          </div>
          <Input
            label="Date de début"
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            required
          />
          <Input
            label="Nom de la session (généré automatiquement)"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            disabled
            className="bg-gray-50"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Liste des participants (CSV)
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFormData({ ...formData, csvFile: e.target.files?.[0] || null })}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
            />
            <p className="mt-1 text-sm text-gray-500">
              Optionnel - Importez directement la liste des plongeurs
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
              Annuler
            </Button>
            <Button type="submit">Créer</Button>
          </div>
        </form>
      </Modal>

      <EditQuestionnaireModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedQuestionnaire(null)
        }}
        questionnaire={selectedQuestionnaire}
        onSave={handleSaveQuestionnaire}
      />

      {showAddParticipantModal && selectedSession && (
        <AddParticipantModal
          sessionId={selectedSession.id}
          sessionName={selectedSession.name}
          onClose={() => setShowAddParticipantModal(false)}
          onSuccess={() => {
            loadQuestionnaires(selectedSession.id)
            setToast({ message: 'Participant ajouté avec succès !', type: 'success' })
          }}
        />
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

