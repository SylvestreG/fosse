import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { sessionsApi, questionnairesApi, Session, QuestionnaireDetail } from '@/lib/api'
import Button from '@/components/Button'
import Toast from '@/components/Toast'
import EditQuestionnaireModal from '@/components/EditQuestionnaireModal'
import AddParticipantModal from '@/components/AddParticipantModal'

/**
 * Gestion des questionnaires (participants) d’une session fosse pour un DP ou un admin.
 * Les non-admins n’ont pas accès à SessionsPage ; cette route leur donne l’équivalent ciblé.
 */
export default function FosseSessionParticipantsPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireDetail[]>([])
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<QuestionnaireDetail | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const [sessRes, qRes] = await Promise.all([
          sessionsApi.get(sessionId),
          questionnairesApi.listDetail(sessionId),
        ])
        if (cancelled) return
        if (sessRes.data.sortie_id) {
          setToast({
            message: 'Cette plongée est rattachée à une sortie : utilisez la page sortie pour les participants.',
            type: 'error',
          })
          setSession(null)
          return
        }
        setSession(sessRes.data)
        setQuestionnaires(qRes.data)
      } catch (error: unknown) {
        if (cancelled) return
        const msg =
          (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Impossible de charger cette session'
        setToast({ message: msg, type: 'error' })
        setSession(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const loadQuestionnaires = async () => {
    if (!sessionId) return
    try {
      const response = await questionnairesApi.listDetail(sessionId)
      setQuestionnaires(response.data)
    } catch {
      setToast({ message: 'Erreur lors du chargement des questionnaires', type: 'error' })
    }
  }

  const handleEditQuestionnaire = (q: QuestionnaireDetail) => {
    setSelectedQuestionnaire(q)
    setShowEditModal(true)
  }

  const handleDeleteQuestionnaire = async (q: QuestionnaireDetail) => {
    if (!confirm(`Supprimer « ${q.first_name} ${q.last_name} » de cette session ?`)) return
    try {
      await questionnairesApi.delete(q.id)
      setToast({ message: 'Participant supprimé', type: 'success' })
      await loadQuestionnaires()
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Erreur lors de la suppression'
      setToast({ message: msg, type: 'error' })
    }
  }

  const handleSaveQuestionnaire = async (id: string, data: Parameters<typeof questionnairesApi.update>[1]) => {
    try {
      await questionnairesApi.update(id, data)
      setToast({ message: 'Questionnaire modifié', type: 'success' })
      await loadQuestionnaires()
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Erreur lors de la modification'
      setToast({ message: msg, type: 'error' })
      throw error
    }
  }

  const handleToggleStatus = async (q: QuestionnaireDetail) => {
    const newStatus = !q.submitted_at
    const statusText = newStatus ? 'soumis' : 'non soumis'
    if (!confirm(`Marquer ce questionnaire comme ${statusText} ?`)) return
    try {
      await questionnairesApi.update(q.id, {
        wants_regulator: q.wants_regulator,
        wants_nitrox: q.wants_nitrox,
        wants_2nd_reg: q.wants_2nd_reg,
        wants_stab: q.wants_stab,
        stab_size: q.stab_size,
        nitrox_training: q.nitrox_training,
        nitrox_base_formation: q.nitrox_base_formation ?? false,
        nitrox_confirmed_formation: q.nitrox_confirmed_formation ?? false,
        comes_from_issoire: q.comes_from_issoire,
        has_car: q.has_car,
        car_seats: q.car_seats,
        comments: q.comments,
        mark_as_submitted: newStatus,
      })
      setToast({ message: `Questionnaire marqué comme ${statusText}`, type: 'success' })
      await loadQuestionnaires()
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Erreur lors de la modification du statut'
      setToast({ message: msg, type: 'error' })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setToast({ message: 'Lien copié', type: 'success' })
  }

  const handleSetDirecteurPlongee = async (questionnaireId: string | null) => {
    if (!sessionId) return
    try {
      await sessionsApi.setDirecteurPlongee(sessionId, questionnaireId)
      await loadQuestionnaires()
      setToast({
        message: questionnaireId ? 'Directeur de plongée défini' : 'Directeur de plongée retiré',
        type: 'success',
      })
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Erreur lors de la mise à jour du DP'
      setToast({ message: msg, type: 'error' })
    }
  }

  if (!sessionId) {
    return <div className="text-center py-12 theme-text">Session introuvable</div>
  }

  if (loading) {
    return <div className="text-center py-12 theme-text">Chargement...</div>
  }

  if (!session) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" onClick={() => navigate('/dashboard/sessions')}>
          ← Retour
        </Button>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="secondary" onClick={() => navigate('/dashboard/sessions')}>
            ← Retour
          </Button>
          <h1 className="text-2xl font-bold theme-text">Participants — {session.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 theme-card px-3 py-2">
            <span className="text-sm theme-text-secondary">DP:</span>
            <select
              value={questionnaires.find(q => q.is_directeur_plongee)?.id || ''}
              onChange={e => handleSetDirecteurPlongee(e.target.value || null)}
              className="theme-select px-2 py-1 text-sm"
            >
              <option value="">— Aucun —</option>
              {questionnaires.filter(q => q.is_encadrant).map(q => (
                <option key={q.id} value={q.id}>
                  {q.first_name} {q.last_name}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => setShowAddParticipantModal(true)}>➕ Ajouter un participant</Button>
        </div>
      </div>

      {questionnaires.length === 0 ? (
        <div className="text-center py-12 theme-card">
          <p className="theme-text-muted mb-4">Aucun participant.</p>
          <Button onClick={() => setShowAddParticipantModal(true)}>➕ Ajouter le premier participant</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {questionnaires.map(q => (
            <div key={q.id} className="theme-card p-6 shadow space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <p className="text-lg font-semibold theme-text">
                    {q.first_name} {q.last_name}
                    {q.is_directeur_plongee && (
                      <span className="ml-2 bg-purple-600 text-white text-xs px-2 py-0.5 rounded">DP</span>
                    )}
                  </p>
                  <p className="text-sm theme-text-muted">{q.email}</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button size="sm" onClick={() => handleEditQuestionnaire(q)}>
                    ✏️ Modifier
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDeleteQuestionnaire(q)}>
                    🗑️ Supprimer
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm theme-text-secondary">
                <p>Encadrant: {q.is_encadrant ? '✅' : '❌'}</p>
                <p>Nitrox: {q.wants_nitrox ? '✅' : '❌'}</p>
                <p>2ème détendeur: {q.wants_2nd_reg ? '✅' : '❌'}</p>
                <p>Stab: {q.wants_stab ? `✅ (${q.stab_size || 'N/A'})` : '❌'}</p>
                <p>Formation Nitrox: {q.nitrox_training ? '✅' : '❌'}</p>
                <p>Voiture: {q.has_car ? `✅ (${q.car_seats || 0} places)` : '❌'}</p>
                <div className="col-span-2 flex items-center justify-between flex-wrap gap-2">
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
                <p className="text-sm italic theme-text-secondary border-t theme-border pt-2">« {q.comments} »</p>
              )}

              {q.magic_link && (
                <div className="border-t theme-border pt-3 space-y-2">
                  <p className="text-sm font-medium theme-text-secondary">Magic link</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={q.magic_link}
                      readOnly
                      className="flex-1 text-sm px-3 py-2 theme-bg-input rounded-lg font-mono"
                    />
                    <Button size="sm" onClick={() => copyToClipboard(q.magic_link!)}>
                      📋 Copier
                    </Button>
                  </div>
                  <p className="text-xs theme-text-muted">
                    Email : <span className="font-medium">{q.email_status || 'N/A'}</span>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <EditQuestionnaireModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setSelectedQuestionnaire(null)
        }}
        questionnaire={selectedQuestionnaire}
        onSave={handleSaveQuestionnaire}
      />

      {showAddParticipantModal && (
        <AddParticipantModal
          sessionId={session.id}
          sessionName={session.name}
          onClose={() => setShowAddParticipantModal(false)}
          onSuccess={() => {
            loadQuestionnaires()
            setToast({ message: 'Participant ajouté', type: 'success' })
          }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
