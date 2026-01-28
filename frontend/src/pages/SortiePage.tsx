import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sortiesApi, sessionsApi, questionnairesApi, SortieWithDives, QuestionnaireDetail, Session, DiveDirector } from '@/lib/api'
import Button from '@/components/Button'
import Table from '@/components/Table'
import Toast from '@/components/Toast'
import AddSortieParticipantModal from '@/components/AddSortieParticipantModal'

export default function SortiePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sortie, setSortie] = useState<SortieWithDives | null>(null)
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireDetail[]>([])
  const [diveDirectors, setDiveDirectors] = useState<Record<string, DiveDirector[]>>({})
  const [loading, setLoading] = useState(true)
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false)
  const [showDPModal, setShowDPModal] = useState<string | null>(null) // session_id or null
  const [editingParticipant, setEditingParticipant] = useState<QuestionnaireDetail | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (id) {
      loadSortie()
      loadQuestionnaires()
    }
  }, [id])

  const loadSortie = async () => {
    try {
      const response = await sortiesApi.get(id!)
      setSortie(response.data)
      // Load dive directors for each dive
      const directors: Record<string, DiveDirector[]> = {}
      await Promise.all(response.data.dives.map(async (dive) => {
        const dpResponse = await sessionsApi.getDiveDirectors(dive.id)
        directors[dive.id] = dpResponse.data
      }))
      setDiveDirectors(directors)
    } catch (error) {
      setToast({ message: 'Erreur lors du chargement de la sortie', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const loadQuestionnaires = async () => {
    try {
      const response = await sortiesApi.getQuestionnaires(id!)
      setQuestionnaires(response.data)
    } catch (error) {
      console.error('Error loading questionnaires:', error)
    }
  }

  const handleAddDP = async (sessionId: string, questionnaireId: string) => {
    try {
      await sessionsApi.addDiveDirector(sessionId, questionnaireId)
      // Reload DPs for this dive
      const dpResponse = await sessionsApi.getDiveDirectors(sessionId)
      setDiveDirectors(prev => ({ ...prev, [sessionId]: dpResponse.data }))
      setShowDPModal(null)
      setToast({ message: 'DP ajouté', type: 'success' })
    } catch (error) {
      setToast({ message: 'Erreur lors de l\'ajout du DP', type: 'error' })
    }
  }

  const handleRemoveDP = async (sessionId: string, directorId: string) => {
    try {
      await sessionsApi.removeDiveDirector(sessionId, directorId)
      // Reload DPs for this dive
      const dpResponse = await sessionsApi.getDiveDirectors(sessionId)
      setDiveDirectors(prev => ({ ...prev, [sessionId]: dpResponse.data }))
      setToast({ message: 'DP retiré', type: 'success' })
    } catch (error) {
      setToast({ message: 'Erreur lors du retrait du DP', type: 'error' })
    }
  }

  // Get encadrants available as DP (not already DP for this dive)
  const getAvailableDPs = (sessionId: string) => {
    const currentDPIds = (diveDirectors[sessionId] || []).map(dp => dp.questionnaire_id)
    return questionnaires.filter(q => q.is_encadrant && !currentDPIds.includes(q.id))
  }

  // Get DP name from questionnaire_id
  const getDPName = (questionnaireId: string) => {
    const q = questionnaires.find(q => q.id === questionnaireId)
    return q ? `${q.first_name} ${q.last_name}` : 'Inconnu'
  }

  const handleUpdateParticipant = async (q: QuestionnaireDetail, updates: Partial<QuestionnaireDetail>) => {
    try {
      await questionnairesApi.update(q.id, {
        wants_regulator: updates.wants_regulator ?? q.wants_regulator,
        wants_nitrox: updates.wants_nitrox ?? q.wants_nitrox,
        wants_2nd_reg: updates.wants_2nd_reg ?? q.wants_2nd_reg,
        wants_stab: updates.wants_stab ?? q.wants_stab,
        stab_size: updates.stab_size ?? q.stab_size,
        nitrox_training: updates.nitrox_training ?? q.nitrox_training,
        nitrox_base_formation: updates.nitrox_base_formation ?? q.nitrox_base_formation,
        nitrox_confirmed_formation: updates.nitrox_confirmed_formation ?? q.nitrox_confirmed_formation,
        comes_from_issoire: q.comes_from_issoire,
        has_car: q.has_car,
        car_seats: q.car_seats,
        comments: q.comments,
      })
      await loadQuestionnaires()
      setEditingParticipant(null)
      setToast({ message: 'Participant mis à jour', type: 'success' })
    } catch (error) {
      setToast({ message: 'Erreur lors de la mise à jour', type: 'error' })
    }
  }

  const handleDeleteParticipant = async (questionnaireId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce participant ?')) return
    try {
      await questionnairesApi.delete(questionnaireId)
      await loadQuestionnaires()
      setToast({ message: 'Participant supprimé', type: 'success' })
    } catch (error) {
      setToast({ message: 'Erreur lors de la suppression', type: 'error' })
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!sortie) {
    return (
      <div className="text-center py-8">
        <p className="theme-text-secondary">Sortie non trouvée</p>
        <Button className="mt-4" onClick={() => navigate('/dashboard/sorties')}>
          Retour aux sorties
        </Button>
      </div>
    )
  }

  const divesColumns = [
    { key: 'dive_number', label: '#', render: (_: any, dive: Session) => dive.dive_number },
    { key: 'name', label: 'Nom' },
    { 
      key: 'start_date', 
      label: 'Date',
      render: (_: any, dive: Session) => new Date(dive.start_date).toLocaleDateString('fr-FR')
    },
    {
      key: 'dp',
      label: 'Directeur(s) de Plongée',
      render: (_: any, dive: Session) => {
        const dps = diveDirectors[dive.id] || []
        return (
          <div className="flex flex-wrap items-center gap-1">
            {dps.map(dp => (
              <span 
                key={dp.id} 
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs"
              >
                {getDPName(dp.questionnaire_id)}
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveDP(dive.id, dp.id) }}
                  className="hover:text-red-400 ml-1"
                  title="Retirer ce DP"
                >
                  ×
                </button>
              </span>
            ))}
            {dps.length < 4 && (
              <button
                onClick={() => setShowDPModal(dive.id)}
                className="px-2 py-0.5 text-xs theme-btn-secondary rounded"
                title="Ajouter un DP"
              >
                + DP
              </button>
            )}
          </div>
        )
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, dive: Session) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => navigate(`/dashboard/palanquees/${dive.id}`)}
          >
            Palanquées
          </Button>
        </div>
      )
    }
  ]

  const participantsColumns = [
    { 
      key: 'name', 
      label: 'Nom',
      render: (_: any, q: QuestionnaireDetail) => `${q.first_name} ${q.last_name}`
    },
    { key: 'email', label: 'Email' },
    {
      key: 'status',
      label: 'Statut',
      render: (_: any, q: QuestionnaireDetail) => (
        <span className={`px-2 py-1 rounded text-xs ${
          q.submitted_at ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'
        }`}>
          {q.submitted_at ? 'Inscrit' : 'En attente'}
        </span>
      )
    },
    {
      key: 'role',
      label: 'Rôle',
      render: (_: any, q: QuestionnaireDetail) => (
        <span className={q.is_encadrant ? 'text-blue-300' : 'theme-text-secondary'}>
          {q.is_encadrant ? 'Encadrant' : 'Plongeur'}
        </span>
      )
    },
    {
      key: 'nitrox',
      label: 'Formation Nitrox',
      render: (_: any, q: QuestionnaireDetail) => {
        if (!sortie.nitrox_compatible || sortie.sortie_type !== 'technique') return '-'
        const formations = []
        if (q.nitrox_base_formation) formations.push('Base')
        if (q.nitrox_confirmed_formation) formations.push('Confirmé')
        return formations.length > 0 ? formations.join(', ') : '-'
      }
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, q: QuestionnaireDetail) => (
        <div className="flex gap-2">
          <button
            onClick={() => setEditingParticipant(q)}
            className="text-blue-400 hover:text-blue-300 text-sm"
            title="Modifier"
          >
            ✏️
          </button>
          <button
            onClick={() => handleDeleteParticipant(q.id)}
            className="text-red-400 hover:text-red-300 text-sm"
            title="Supprimer"
          >
            🗑️
          </button>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <button
            onClick={() => navigate('/dashboard/sorties')}
            className="text-sm theme-text-secondary hover:theme-text mb-2 flex items-center gap-1"
          >
            ← Retour aux sorties
          </button>
          <h1 className="text-2xl font-bold theme-text">{sortie.name}</h1>
          <p className="theme-text-secondary mt-1">
            {sortie.location} • {new Date(sortie.start_date).toLocaleDateString('fr-FR')}
            {sortie.end_date !== sortie.start_date && (
              <> - {new Date(sortie.end_date).toLocaleDateString('fr-FR')}</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            sortie.sortie_type === 'technique'
              ? 'bg-purple-500/20 text-purple-300'
              : 'bg-blue-500/20 text-blue-300'
          }`}>
            {sortie.sortie_type === 'technique' ? 'Technique' : 'Exploration'}
          </span>
          {sortie.nitrox_compatible && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-300">
              Nitrox
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="theme-card p-4 rounded-lg">
          <p className="text-sm theme-text-secondary">Plongées</p>
          <p className="text-2xl font-bold theme-text">{sortie.dives.length}</p>
        </div>
        <div className="theme-card p-4 rounded-lg">
          <p className="text-sm theme-text-secondary">Participants</p>
          <p className="text-2xl font-bold theme-text">{questionnaires.length}</p>
        </div>
        <div className="theme-card p-4 rounded-lg">
          <p className="text-sm theme-text-secondary">Encadrants</p>
          <p className="text-2xl font-bold theme-text">
            {questionnaires.filter(q => q.is_encadrant).length}
          </p>
        </div>
        <div className="theme-card p-4 rounded-lg">
          <p className="text-sm theme-text-secondary">Inscrits</p>
          <p className="text-2xl font-bold theme-text">
            {questionnaires.filter(q => q.submitted_at).length}
          </p>
        </div>
      </div>

      {/* Plongées */}
      <div className="theme-card p-6 rounded-lg">
        <h2 className="text-lg font-semibold theme-text mb-4">Plongées ({sortie.dives.length})</h2>
        <Table data={sortie.dives} columns={divesColumns} />
      </div>

      {/* Participants */}
      <div className="theme-card p-6 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold theme-text">
            Participants inscrits ({questionnaires.length})
          </h2>
          <Button size="sm" onClick={() => setShowAddParticipantModal(true)}>
            + Ajouter un participant
          </Button>
        </div>
        {questionnaires.length === 0 ? (
          <div className="text-center py-8">
            <p className="theme-text-secondary mb-4">Aucun participant inscrit</p>
            <Button onClick={() => setShowAddParticipantModal(true)}>
              Ajouter le premier participant
            </Button>
          </div>
        ) : (
          <Table data={questionnaires} columns={participantsColumns} />
        )}
      </div>

      {/* Modal ajout participant */}
      {showAddParticipantModal && (
        <AddSortieParticipantModal
          sortieId={id!}
          sortieName={sortie.name}
          sortieType={sortie.sortie_type as 'exploration' | 'technique'}
          nitroxCompatible={sortie.nitrox_compatible}
          onClose={() => setShowAddParticipantModal(false)}
          onSuccess={() => loadQuestionnaires()}
        />
      )}

      {/* Modal sélection DP */}
      {showDPModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="theme-card p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold theme-text mb-4">
              Ajouter un Directeur de Plongée
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {getAvailableDPs(showDPModal).length === 0 ? (
                <p className="theme-text-secondary text-center py-4">
                  Aucun encadrant disponible
                </p>
              ) : (
                getAvailableDPs(showDPModal).map(q => (
                  <button
                    key={q.id}
                    onClick={() => handleAddDP(showDPModal, q.id)}
                    className="w-full text-left px-4 py-2 rounded theme-hover theme-text"
                  >
                    {q.first_name} {q.last_name}
                    <span className="text-sm theme-text-secondary ml-2">({q.email})</span>
                  </button>
                ))
              )}
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="secondary" onClick={() => setShowDPModal(null)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal édition participant */}
      {editingParticipant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="theme-card p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold theme-text mb-4">
              Modifier {editingParticipant.first_name} {editingParticipant.last_name}
            </h3>
            <div className="space-y-4">
              {/* Rôle (lecture seule basé sur niveau) */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-1">Rôle</label>
                <p className="theme-text">
                  {editingParticipant.is_encadrant ? 'Encadrant' : 'Plongeur'}
                  <span className="text-xs theme-text-secondary ml-2">(basé sur le niveau)</span>
                </p>
              </div>

              {/* Formation Nitrox (si sortie technique et nitrox compatible) */}
              {sortie.sortie_type === 'technique' && sortie.nitrox_compatible && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium theme-text-secondary">Formation Nitrox</label>
                  <label className="flex items-center gap-2 theme-text">
                    <input
                      type="checkbox"
                      checked={editingParticipant.nitrox_base_formation}
                      onChange={(e) => setEditingParticipant({
                        ...editingParticipant,
                        nitrox_base_formation: e.target.checked
                      })}
                      className="rounded"
                    />
                    Formation Nitrox Base
                  </label>
                  <label className="flex items-center gap-2 theme-text">
                    <input
                      type="checkbox"
                      checked={editingParticipant.nitrox_confirmed_formation}
                      onChange={(e) => setEditingParticipant({
                        ...editingParticipant,
                        nitrox_confirmed_formation: e.target.checked
                      })}
                      className="rounded"
                    />
                    Formation Nitrox Confirmé
                  </label>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setEditingParticipant(null)}>
                Annuler
              </Button>
              <Button onClick={() => handleUpdateParticipant(editingParticipant, {
                nitrox_base_formation: editingParticipant.nitrox_base_formation,
                nitrox_confirmed_formation: editingParticipant.nitrox_confirmed_formation,
              })}>
                Enregistrer
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
