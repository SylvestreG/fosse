import { useEffect, useState } from 'react'
import { peopleApi, competenciesApi, Person, Competency, CompetenciesByLevel } from '@/lib/api'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import Toast from '@/components/Toast'

// Ordre des niveaux
const LEVEL_ORDER = ['N1', 'N2', 'N3', 'E1', 'N4', 'N5', 'E2', 'E3', 'E4']

// Noms complets des niveaux
const LEVEL_NAMES: Record<string, string> = {
  N1: 'Niveau 1 - Plongeur Encadré',
  N2: 'Niveau 2 - Plongeur Autonome 20m',
  N3: 'Niveau 3 - Plongeur Autonome 60m',
  N4: 'Niveau 4 - Guide de Palanquée',
  N5: 'Niveau 5 - Directeur de Plongée',
  E2: 'E2 - Encadrant Niveau 2',
  E3: 'E3 - Encadrant niveau 3',
  E4: 'E4 - Encadrant niveau 4',
}

export default function CompetencesPage() {
  const [activeTab, setActiveTab] = useState('N1')
  const [people, setPeople] = useState<Person[]>([])
  const [competenciesByLevel, setCompetenciesByLevel] = useState<CompetenciesByLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showStudentsModal, setShowStudentsModal] = useState(false)
  const [showCompetencyModal, setShowCompetencyModal] = useState(false)
  const [editingCompetency, setEditingCompetency] = useState<Competency | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [peopleRes, competenciesRes] = await Promise.all([
        peopleApi.list(),
        competenciesApi.listByLevel()
      ])
      setPeople(peopleRes.data)
      setCompetenciesByLevel(competenciesRes.data)
    } catch (error) {
      console.error('Error loading data:', error)
      setToast({ message: 'Erreur lors du chargement des données', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Filtrer les élèves qui préparent un niveau donné
  const getStudentsPreparingLevel = (level: string) => {
    return people.filter(p => p.preparing_level === level)
  }

  // Nombre d'élèves qui préparent chaque niveau
  const getStudentCountByLevel = (level: string) => {
    return getStudentsPreparingLevel(level).length
  }

  // Récupérer les compétences pour un niveau
  const getCompetenciesForLevel = (level: string): Competency[] => {
    const levelData = competenciesByLevel.find(l => l.level === level)
    return levelData?.competencies || []
  }

  const handleDeleteCompetency = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette compétence ?')) return
    
    try {
      await competenciesApi.delete(id)
      setToast({ message: 'Compétence supprimée', type: 'success' })
      loadData()
    } catch (error) {
      setToast({ message: 'Erreur lors de la suppression', type: 'error' })
    }
  }

  const handleEditCompetency = (competency: Competency) => {
    setEditingCompetency(competency)
    setShowCompetencyModal(true)
  }

  const handleAddCompetency = () => {
    setEditingCompetency(null)
    setShowCompetencyModal(true)
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  const currentLevelCompetencies = getCompetenciesForLevel(activeTab)
  const studentsForCurrentLevel = getStudentsPreparingLevel(activeTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">🎯 Compétences</h1>
          <p className="text-slate-300 mt-1">Gestion des compétences par niveau de plongée</p>
        </div>
        <Button onClick={handleAddCompetency}>
          ➕ Nouvelle compétence
        </Button>
      </div>

      {/* Tabs pour les niveaux */}
      <div className="border-b border-slate-600">
        <nav className="-mb-px flex space-x-1 overflow-x-auto pb-px">
          {LEVEL_ORDER.map((level) => {
            const studentCount = getStudentCountByLevel(level)
            const competencyCount = getCompetenciesForLevel(level).length
            return (
              <button
                key={level}
                onClick={() => setActiveTab(level)}
                className={`
                  whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors
                  flex items-center gap-2
                  ${activeTab === level
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }
                `}
              >
                {level}
                <span className={`
                  px-1.5 py-0.5 text-xs rounded
                  ${activeTab === level ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-slate-300'}
                `}>
                  {competencyCount}
                </span>
                {studentCount > 0 && (
                  <span className={`
                    px-1.5 py-0.5 text-xs rounded-full
                    ${activeTab === level ? 'bg-amber-200 text-amber-800' : 'bg-amber-100 text-amber-600'}
                  `}>
                    👨‍🎓 {studentCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Contenu du niveau sélectionné */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne gauche : Compétences du niveau */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{LEVEL_NAMES[activeTab] || activeTab}</h2>
                <p className="text-sm text-slate-400 mt-1">
                  {currentLevelCompetencies.length} compétence{currentLevelCompetencies.length > 1 ? 's' : ''} à valider
                </p>
              </div>
              <span className="px-3 py-1 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold rounded-full">
                {activeTab}
              </span>
            </div>

            {currentLevelCompetencies.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="mb-4">Aucune compétence définie pour ce niveau</p>
                <Button size="sm" onClick={handleAddCompetency}>
                  ➕ Ajouter une compétence
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {currentLevelCompetencies.map((competency, index) => (
                  <div
                    key={competency.id}
                    className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors group"
                  >
                    <div className="flex items-center flex-1">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold mr-3">
                        {index + 1}
                      </span>
                      <div>
                        <span className="text-slate-200 font-medium">{competency.name}</span>
                        {competency.description && (
                          <p className="text-sm text-slate-400 mt-0.5">{competency.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditCompetency(competency)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Modifier"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteCompetency(competency.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite : Élèves préparant ce niveau */}
        <div className="space-y-4">
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">
                👨‍🎓 Élèves préparant {activeTab}
              </h3>
              <span className="px-2 py-1 bg-amber-100 text-amber-700 text-sm font-semibold rounded">
                {studentsForCurrentLevel.length}
              </span>
            </div>

            {studentsForCurrentLevel.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">
                Aucun élève ne prépare ce niveau actuellement
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {studentsForCurrentLevel.map((student) => (
                  <div
                    key={student.id}
                    className="p-3 bg-slate-700/30 rounded-lg border border-gray-100 hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="font-medium text-white">
                      {student.first_name} {student.last_name}
                    </div>
                    <div className="text-sm text-slate-400">{student.email}</div>
                    {student.diving_level_display && (
                      <div className="text-xs text-blue-600 mt-1">
                        🤿 Niveau actuel: {student.diving_level_display}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {studentsForCurrentLevel.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowStudentsModal(true)}
                className="w-full mt-4"
              >
                📋 Voir la liste complète
              </Button>
            )}
          </div>

          {/* Statistiques globales */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow p-6 text-white">
            <h3 className="text-lg font-bold mb-4">📊 Statistiques</h3>
            <div className="space-y-3">
              {LEVEL_ORDER.map((level) => {
                const count = getStudentCountByLevel(level)
                return (
                  <div key={level} className="flex justify-between items-center">
                    <span className="text-white/80">{level}</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 bg-slate-800/50 backdrop-blur-xl/30 rounded-full"
                        style={{ width: `${Math.max(count * 20, 4)}px` }}
                      />
                      <span className="font-semibold min-w-[20px] text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-white/20">
              <div className="flex justify-between items-center">
                <span>Total élèves en formation</span>
                <span className="font-bold text-xl">
                  {LEVEL_ORDER.reduce((sum, level) => sum + getStudentCountByLevel(level), 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal liste des élèves */}
      {showStudentsModal && (
        <StudentsListModal
          level={activeTab}
          students={studentsForCurrentLevel}
          onClose={() => setShowStudentsModal(false)}
        />
      )}

      {/* Modal création/édition compétence */}
      {showCompetencyModal && (
        <CompetencyModal
          competency={editingCompetency}
          defaultLevel={activeTab}
          onClose={() => setShowCompetencyModal(false)}
          onSuccess={() => {
            setShowCompetencyModal(false)
            loadData()
            setToast({ 
              message: editingCompetency ? 'Compétence modifiée' : 'Compétence créée', 
              type: 'success' 
            })
          }}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}

// Modal pour afficher la liste complète des élèves
interface StudentsListModalProps {
  level: string
  students: Person[]
  onClose: () => void
}

function StudentsListModal({ level, students, onClose }: StudentsListModalProps) {
  return (
    <Modal isOpen={true} onClose={onClose} title={`Élèves préparant ${level}`}>
      <div className="space-y-4">
        <p className="text-slate-300">
          {students.length} élève{students.length > 1 ? 's' : ''} prépare{students.length > 1 ? 'nt' : ''} actuellement le niveau {level}
        </p>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-700/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Niveau actuel
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Téléphone
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-800/50 backdrop-blur-xl divide-y divide-gray-200">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-slate-700/30">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="font-medium text-white">
                      {student.first_name} {student.last_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-400">
                    {student.email}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                      {student.diving_level_display || 'Aucun'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-400">
                    {student.phone || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </Modal>
  )
}

// Modal pour créer/éditer une compétence
interface CompetencyModalProps {
  competency: Competency | null
  defaultLevel: string
  onClose: () => void
  onSuccess: () => void
}

function CompetencyModal({ competency, defaultLevel, onClose, onSuccess }: CompetencyModalProps) {
  const [formData, setFormData] = useState({
    level: competency?.level || defaultLevel,
    name: competency?.name || '',
    description: competency?.description || '',
    sort_order: competency?.sort_order ?? undefined,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const data = {
        level: formData.level,
        name: formData.name,
        description: formData.description || undefined,
        sort_order: formData.sort_order,
      }

      if (competency) {
        await competenciesApi.update(competency.id, data)
      } else {
        await competenciesApi.create(data)
      }
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal 
      isOpen={true} 
      onClose={onClose} 
      title={competency ? 'Modifier la compétence' : 'Nouvelle compétence'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>}
        
        <div>
          <label className="block text-sm font-medium mb-1">Niveau *</label>
          <select
            value={formData.level}
            onChange={(e) => setFormData({ ...formData, level: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            {LEVEL_ORDER.map((level) => (
              <option key={level} value={level}>
                {level} - {LEVEL_NAMES[level]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nom de la compétence *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Maîtriser la ventilation"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description (optionnel)</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Description détaillée de la compétence..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Ordre d'affichage (optionnel)</label>
          <input
            type="number"
            value={formData.sort_order ?? ''}
            onChange={(e) => setFormData({ ...formData, sort_order: e.target.value ? parseInt(e.target.value) : undefined })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Laissez vide pour ajouter à la fin"
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'En cours...' : competency ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
