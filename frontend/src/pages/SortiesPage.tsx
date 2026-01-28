import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { sortiesApi, Sortie, SortieType } from '@/lib/api'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Modal from '@/components/Modal'
import Table from '@/components/Table'
import Toast from '@/components/Toast'

export default function SortiesPage() {
  const navigate = useNavigate()
  const [sorties, setSorties] = useState<Sortie[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    location: '',
    sortie_type: 'exploration' as SortieType,
    days_count: 2,
    dives_per_day: 2,
    nitrox_compatible: false,
    start_date: '',
    description: '',
  })

  useEffect(() => {
    loadSorties()
  }, [])

  // Auto-générer le nom basé sur lieu et date
  useEffect(() => {
    if (formData.location && formData.start_date) {
      const date = new Date(formData.start_date)
      const formattedDate = date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
      const typeLabel = formData.sortie_type === 'technique' ? 'Technique' : 'Exploration'
      setFormData(prev => ({ ...prev, name: `Sortie ${typeLabel} - ${formData.location} - ${formattedDate}` }))
    }
  }, [formData.location, formData.start_date, formData.sortie_type])

  const loadSorties = async () => {
    try {
      const response = await sortiesApi.list()
      setSorties(response.data)
    } catch (error) {
      setToast({ message: 'Erreur lors du chargement des sorties', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSortie = async () => {
    if (!formData.name || !formData.location || !formData.start_date) {
      setToast({ message: 'Veuillez remplir tous les champs obligatoires', type: 'error' })
      return
    }

    setCreating(true)
    try {
      const response = await sortiesApi.create({
        name: formData.name,
        location: formData.location,
        sortie_type: formData.sortie_type,
        days_count: formData.days_count,
        dives_per_day: formData.dives_per_day,
        nitrox_compatible: formData.nitrox_compatible,
        start_date: formData.start_date,
        description: formData.description || undefined,
      })
      
      setToast({ message: `Sortie créée avec ${response.data.dives.length} plongées`, type: 'success' })
      setShowCreateModal(false)
      resetForm()
      await loadSorties()
      
      // Navigate to the new sortie
      navigate(`/dashboard/sorties/${response.data.id}`)
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la création'
      setToast({ message: errorMessage, type: 'error' })
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteSortie = async (sortie: Sortie) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la sortie "${sortie.name}" et toutes ses plongées ?`)) {
      return
    }

    try {
      await sortiesApi.delete(sortie.id)
      setToast({ message: 'Sortie supprimée avec succès', type: 'success' })
      await loadSorties()
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la suppression'
      setToast({ message: errorMessage, type: 'error' })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      location: '',
      sortie_type: 'exploration',
      days_count: 2,
      dives_per_day: 2,
      nitrox_compatible: false,
      start_date: '',
      description: '',
    })
  }

  const columns = [
    { key: 'name', label: 'Nom' },
    { 
      key: 'type_info', 
      label: 'Type',
      render: (sortie: Sortie) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          sortie.sortie_type === 'technique' 
            ? 'bg-purple-500/20 text-purple-300' 
            : 'bg-blue-500/20 text-blue-300'
        }`}>
          {sortie.sortie_type === 'technique' ? 'Technique' : 'Exploration'}
        </span>
      )
    },
    { key: 'location', label: 'Lieu' },
    {
      key: 'dates',
      label: 'Dates',
      render: (sortie: Sortie) => (
        <span>
          {new Date(sortie.start_date).toLocaleDateString('fr-FR')}
          {sortie.end_date && sortie.end_date !== sortie.start_date && (
            <> - {new Date(sortie.end_date).toLocaleDateString('fr-FR')}</>
          )}
        </span>
      )
    },
    {
      key: 'dives_info',
      label: 'Plongées',
      render: (sortie: Sortie) => (
        <span>{sortie.days_count} jours × {sortie.dives_per_day} plongées = {sortie.days_count * sortie.dives_per_day}</span>
      )
    },
    {
      key: 'nitrox',
      label: 'Nitrox',
      render: (sortie: Sortie) => (
        sortie.sortie_type === 'technique' && sortie.nitrox_compatible ? (
          <span className="text-green-400">Oui</span>
        ) : (
          <span className="text-gray-500">-</span>
        )
      )
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (sortie: Sortie) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => navigate(`/dashboard/sorties/${sortie.id}`)}
          >
            Gérer
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDeleteSortie(sortie)}
          >
            Supprimer
          </Button>
        </div>
      )
    }
  ]

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold theme-text">Sorties</h1>
        <Button onClick={() => setShowCreateModal(true)}>
          Nouvelle sortie
        </Button>
      </div>

      {sorties.length === 0 ? (
        <div className="theme-card rounded-lg p-8 text-center">
          <p className="theme-text-secondary">Aucune sortie pour le moment</p>
          <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
            Créer une sortie
          </Button>
        </div>
      ) : (
        <Table data={sorties} columns={columns} />
      )}

      {/* Modal de création */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); resetForm() }}
        title="Nouvelle sortie"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium theme-text-secondary mb-1">
              Type de sortie
            </label>
            <select
              value={formData.sortie_type}
              onChange={e => setFormData({ ...formData, sortie_type: e.target.value as SortieType })}
              className="w-full theme-select"
            >
              <option value="exploration">Exploration</option>
              <option value="technique">Technique</option>
            </select>
          </div>

          <Input
            label="Lieu"
            value={formData.location}
            onChange={e => setFormData({ ...formData, location: e.target.value })}
            placeholder="Ex: Port-Cros, Marseille..."
            required
          />

          <Input
            label="Date de début"
            type="date"
            value={formData.start_date}
            onChange={e => setFormData({ ...formData, start_date: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium theme-text-secondary mb-1">
                Nombre de jours
              </label>
              <select
                value={formData.days_count}
                onChange={e => setFormData({ ...formData, days_count: parseInt(e.target.value) })}
                className="w-full theme-select"
              >
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <option key={n} value={n}>{n} jour{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium theme-text-secondary mb-1">
                Plongées par jour
              </label>
              <select
                value={formData.dives_per_day}
                onChange={e => setFormData({ ...formData, dives_per_day: parseInt(e.target.value) })}
                className="w-full theme-select"
              >
                {[1, 2, 3, 4].map(n => (
                  <option key={n} value={n}>{n} plongée{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="theme-card-secondary p-3 rounded-lg">
            <p className="text-sm theme-text-secondary">
              Total: <strong className="theme-text">{formData.days_count * formData.dives_per_day} plongées</strong> seront créées
            </p>
          </div>

          {formData.sortie_type === 'technique' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="nitrox_compatible"
                checked={formData.nitrox_compatible}
                onChange={e => setFormData({ ...formData, nitrox_compatible: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="nitrox_compatible" className="text-sm theme-text">
                Sortie compatible Nitrox (formations possibles)
              </label>
            </div>
          )}

          <Input
            label="Nom (auto-généré)"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            disabled
          />

          <Input
            label="Description (optionnel)"
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            placeholder="Notes, informations pratiques..."
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => { setShowCreateModal(false); resetForm() }}>
              Annuler
            </Button>
            <Button onClick={handleCreateSortie} disabled={creating}>
              {creating ? 'Création...' : 'Créer la sortie'}
            </Button>
          </div>
        </div>
      </Modal>

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
