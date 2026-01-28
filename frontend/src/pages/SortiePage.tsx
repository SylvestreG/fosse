import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sortiesApi, SortieWithDives, QuestionnaireDetail, Session } from '@/lib/api'
import Button from '@/components/Button'
import Table from '@/components/Table'
import Toast from '@/components/Toast'
import AddSortieParticipantModal from '@/components/AddSortieParticipantModal'

export default function SortiePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sortie, setSortie] = useState<SortieWithDives | null>(null)
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false)
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
