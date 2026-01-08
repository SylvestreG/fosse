import { useEffect, useState } from 'react'
import { peopleApi, authApi, Person } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import Button from '@/components/Button'
import Toast from '@/components/Toast'
import Modal from '@/components/Modal'

// Constantes pour les filtres
const ALL_LEVELS = ['N1', 'N2', 'N3', 'E1', 'N4', 'N5', 'E2', 'E3', 'E4']
const PREPARING_LEVELS = ['N1', 'N2', 'N3', 'E1', 'N4', 'N5', 'E2']

export default function UsersPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState<string>('')
  const [filterPreparingLevel, setFilterPreparingLevel] = useState<string>('')
  const [filterEncadrant, setFilterEncadrant] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDivingLevelModal, setShowDivingLevelModal] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'impersonate'; person: Person } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const { isAdmin, setImpersonation } = useAuthStore()
  // Note: ici on garde isAdmin (pas isAdminView) car cette page n'est accessible qu'aux vrais admins

  // Filtrer les utilisateurs
  const filteredPeople = people.filter(person => {
    // Filtre par niveau actuel
    if (filterLevel) {
      const levels = person.diving_level?.split(',').map(l => l.trim()) || []
      if (!levels.includes(filterLevel)) return false
    }
    
    // Filtre par niveau en préparation
    if (filterPreparingLevel) {
      if (person.preparing_level !== filterPreparingLevel) return false
    }
    
    // Filtre par encadrant
    if (filterEncadrant === 'encadrant' && !person.is_instructor) return false
    if (filterEncadrant === 'eleve' && person.is_instructor) return false
    
    return true
  })

  useEffect(() => {
    loadPeople()
  }, [search])

  const loadPeople = async () => {
    try {
      const response = await peopleApi.list(search || undefined)
      setPeople(response.data)
    } catch (error) {
      console.error('Error loading people:', error)
      setToast({ message: 'Erreur lors du chargement des utilisateurs', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (person: Person) => {
    setConfirmAction({ type: 'delete', person })
  }

  const handleImpersonate = async (person: Person) => {
    setConfirmAction({ type: 'impersonate', person })
  }

  const executeConfirmAction = async () => {
    if (!confirmAction) return
    
    const { type, person } = confirmAction
    setConfirmAction(null)
    
    if (type === 'delete') {
      try {
        await peopleApi.delete(person.id)
        setToast({ message: 'Utilisateur supprimé', type: 'success' })
        loadPeople()
      } catch (error) {
        setToast({ message: 'Erreur lors de la suppression', type: 'error' })
      }
    } else if (type === 'impersonate') {
      try {
        const response = await authApi.impersonate(person.id)
        console.log('Impersonation response:', response.data)
        console.log('can_validate_competencies:', response.data.can_validate_competencies)
        setImpersonation(response.data.token, response.data.impersonating, response.data.can_validate_competencies)
        setToast({ message: `Vous êtes maintenant ${person.first_name} ${person.last_name}`, type: 'success' })
      } catch (error) {
        setToast({ message: 'Erreur lors de l\'impersonification', type: 'error' })
      }
    }
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-xl sm:text-3xl font-bold text-white">Utilisateurs</h1>
        <Button onClick={() => { setEditingPerson(null); setShowModal(true) }} className="text-sm sm:text-base">
          ➕ <span className="hidden sm:inline">Nouvel </span>utilisateur
        </Button>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 sm:px-4 py-2 bg-slate-800/50 backdrop-blur-xl border border-slate-600 rounded-lg text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {/* Filtre par niveau actuel */}
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="px-3 py-2 border border-slate-600 rounded-lg text-sm bg-slate-800/50 backdrop-blur-xl text-white"
          >
            <option value="">🤿 Tous niveaux</option>
            {ALL_LEVELS.map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>

          {/* Filtre par niveau en préparation */}
          <select
            value={filterPreparingLevel}
            onChange={(e) => setFilterPreparingLevel(e.target.value)}
            className="px-3 py-2 border border-slate-600 rounded-lg text-sm bg-slate-800/50 backdrop-blur-xl text-white"
          >
            <option value="">🎯 Préparation: tous</option>
            {PREPARING_LEVELS.map(level => (
              <option key={level} value={level}>Prépare {level}</option>
            ))}
          </select>

          {/* Filtre encadrant/élève */}
          <select
            value={filterEncadrant}
            onChange={(e) => setFilterEncadrant(e.target.value)}
            className="px-3 py-2 border border-slate-600 rounded-lg text-sm bg-slate-800/50 backdrop-blur-xl text-white"
          >
            <option value="">👥 Tous</option>
            <option value="encadrant">👨‍🏫 Encadrants</option>
            <option value="eleve">👨‍🎓 Élèves</option>
          </select>

          {/* Bouton reset filtres */}
          {(filterLevel || filterPreparingLevel || filterEncadrant) && (
            <button
              onClick={() => {
                setFilterLevel('')
                setFilterPreparingLevel('')
                setFilterEncadrant('')
              }}
              className="px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg border border-red-500/50"
            >
              ✕ Reset filtres
            </button>
          )}
        </div>

        {/* Compteur de résultats */}
        <p className="text-sm text-slate-400">
          {filteredPeople.length} utilisateur{filteredPeople.length > 1 ? 's' : ''} 
          {filteredPeople.length !== people.length && ` sur ${people.length}`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredPeople.map((person) => (
          <div key={person.id} className="bg-slate-800/50 backdrop-blur-xl p-3 sm:p-4 rounded-lg shadow">
            <div className="flex justify-between items-start mb-2 gap-2">
              <h3 className="text-sm sm:text-lg font-semibold text-white">{person.first_name} {person.last_name}</h3>
              {person.is_instructor && (
                <span className="text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full font-semibold flex-shrink-0">
                  👨‍🏫<span className="hidden sm:inline"> Encadrant</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-300 truncate">{person.email}</p>
            {person.phone && <p className="text-xs sm:text-sm text-slate-300">📞 {person.phone}</p>}
            
            {person.diving_level_display && (
              <div className="mt-2 space-y-1">
                <div>
                  <span className="text-xs sm:text-sm font-medium text-cyan-400">
                    🤿 {person.diving_level_display}
                  </span>
                </div>
                {person.preparing_level && (
                  <div>
                    <span className="text-xs text-amber-400">
                      🎯 Prépare: <span className="font-medium">{person.preparing_level}</span>
                    </span>
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-2 sm:mt-3 flex flex-wrap gap-1">
              {person.is_instructor && <span className="text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-purple-500/30 text-purple-300 border border-purple-500/50 rounded">Encadrant</span>}
              {person.default_wants_nitrox && <span className="text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-yellow-500/30 text-yellow-300 border border-yellow-500/50 rounded">Nitrox</span>}
              {person.default_wants_stab && person.default_stab_size && <span className="text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 rounded">Stab {person.default_stab_size}</span>}
            </div>

            <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5 sm:gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setEditingPerson(person); setShowModal(true) }} className="text-xs sm:text-sm px-2 sm:px-3">
                ✏️<span className="hidden sm:inline"> Modifier</span>
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setEditingPerson(person); setShowDivingLevelModal(true) }} className="text-xs sm:text-sm px-2 sm:px-3">
                🤿<span className="hidden sm:inline"> Niveau</span>
              </Button>
              {isAdmin && (
                <Button size="sm" variant="secondary" onClick={() => handleImpersonate(person)} className="text-xs sm:text-sm px-2 sm:px-3">
                  👤<span className="hidden sm:inline"> Impersonnifier</span>
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => handleDelete(person)} className="text-xs sm:text-sm px-2 sm:px-3">
                🗑️
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filteredPeople.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          {people.length === 0 ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur ne correspond aux filtres'}
        </div>
      )}

      {showModal && (
        <UserModal
          person={editingPerson}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false)
            loadPeople()
            setToast({ message: editingPerson ? 'Utilisateur modifié' : 'Utilisateur créé', type: 'success' })
          }}
        />
      )}

      {showDivingLevelModal && editingPerson && (
        <DivingLevelModal
          person={editingPerson}
          onClose={() => setShowDivingLevelModal(false)}
          onSuccess={() => {
            setShowDivingLevelModal(false)
            loadPeople()
            setToast({ message: 'Niveau de plongée mis à jour', type: 'success' })
          }}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Modal de confirmation */}
      {confirmAction && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmAction(null)}
          title={confirmAction.type === 'delete' ? '🗑️ Supprimer l\'utilisateur' : '👤 Impersonnifier'}
        >
          <div className="space-y-4">
            <p className="text-slate-200">
              {confirmAction.type === 'delete' ? (
                <>Êtes-vous sûr de vouloir supprimer <strong>{confirmAction.person.first_name} {confirmAction.person.last_name}</strong> ?</>
              ) : (
                <>Voulez-vous impersonnifier <strong>{confirmAction.person.first_name} {confirmAction.person.last_name}</strong> ?</>
              )}
            </p>
            {confirmAction.type === 'impersonate' && (
              <p className="text-sm text-slate-400">
                Vous verrez l'application comme cet utilisateur.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="secondary" onClick={() => setConfirmAction(null)}>
                Annuler
              </Button>
              <Button 
                onClick={executeConfirmAction}
                className={confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''}
              >
                {confirmAction.type === 'delete' ? 'Supprimer' : 'Impersonnifier'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// Modal composant (inline pour simplicité)
interface UserModalProps {
  person: Person | null
  onClose: () => void
  onSuccess: () => void
}

function UserModal({ person, onClose, onSuccess }: UserModalProps) {
  const isInstructor = person?.is_instructor || false
  const [formData, setFormData] = useState({
    first_name: person?.first_name || '',
    last_name: person?.last_name || '',
    email: person?.email || '',
    phone: person?.phone || '',
    default_wants_regulator: person?.default_wants_regulator !== undefined ? person.default_wants_regulator : true,
    default_wants_nitrox: person?.default_wants_nitrox || false,
    default_wants_2nd_reg: person?.default_wants_2nd_reg || false,
    default_wants_stab: person?.default_wants_stab !== undefined ? person.default_wants_stab : true,
    default_stab_size: person?.default_stab_size || 'M',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (person) {
        await peopleApi.update(person.id, formData)
      } else {
        await peopleApi.create(formData as any)
      }
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-800/50 backdrop-blur-xl border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">{person ? 'Modifier' : 'Nouvel'} utilisateur</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-slate-300 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-500/20 text-red-400 border border-red-500/50 p-3 rounded">{error}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Prénom *</label>
              <input type="text" required value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Nom *</label>
              <input type="text" required value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email *</label>
            <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Téléphone</label>
            <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          </div>

          <div className="border-t border-slate-700 pt-4">
            <h3 className="font-semibold mb-3 text-white">Préférences par défaut</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center space-x-2 text-slate-300">
                <input type="checkbox" checked={formData.default_wants_regulator} onChange={(e) => setFormData({ ...formData, default_wants_regulator: e.target.checked })} className="w-4 h-4 accent-cyan-500" />
                <span>Détendeur</span>
              </label>
              {isInstructor && (
                <>
                  <label className="flex items-center space-x-2 text-slate-300">
                    <input type="checkbox" checked={formData.default_wants_nitrox} onChange={(e) => setFormData({ ...formData, default_wants_nitrox: e.target.checked })} className="w-4 h-4 accent-cyan-500" />
                    <span>Nitrox</span>
                  </label>
                  <label className="flex items-center space-x-2 text-slate-300">
                    <input type="checkbox" checked={formData.default_wants_2nd_reg} onChange={(e) => setFormData({ ...formData, default_wants_2nd_reg: e.target.checked })} className="w-4 h-4 accent-cyan-500" />
                    <span>2ème détendeur</span>
                  </label>
                </>
              )}
              <label className="flex items-center space-x-2 text-slate-300">
                <input type="checkbox" checked={formData.default_wants_stab} onChange={(e) => setFormData({ ...formData, default_wants_stab: e.target.checked })} className="w-4 h-4 accent-cyan-500" />
                <span>Stab</span>
              </label>
              {formData.default_wants_stab && (
                <div>
                  <select value={formData.default_stab_size} onChange={(e) => setFormData({ ...formData, default_stab_size: e.target.value })} className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
            <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={loading}>{loading ? 'En cours...' : person ? 'Modifier' : 'Créer'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal pour gérer les niveaux de plongée
interface DivingLevelModalProps {
  person: Person
  onClose: () => void
  onSuccess: () => void
}

function DivingLevelModal({ person, onClose, onSuccess }: DivingLevelModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Parse le niveau actuel
  const currentLevels = person.diving_level ? person.diving_level.split(',').map(l => l.trim()) : []
  
  const [completeLevels, setCompleteLevels] = useState({
    N1: currentLevels.includes('N1'),
    N2: currentLevels.includes('N2'),
    N3: currentLevels.includes('N3'),
    E1: currentLevels.includes('E1'),
    N4: currentLevels.includes('N4'),
    N5: currentLevels.includes('N5'),
    E2: currentLevels.includes('E2'),
    E3: currentLevels.includes('E3'),
    E4: currentLevels.includes('E4'),
  })

  const [preparingLevel, setPreparingLevel] = useState(person.preparing_level || '')

  // Hiérarchie des niveaux
  const levelHierarchy = ['N1', 'N2', 'N3', 'E1', 'N4', 'N5', 'E2', 'E3', 'E4']

  // Calculer le niveau le plus haut validé
  const getHighestLevel = () => {
    for (let i = levelHierarchy.length - 1; i >= 0; i--) {
      if (completeLevels[levelHierarchy[i] as keyof typeof completeLevels]) {
        return levelHierarchy[i]
      }
    }
    return null
  }

  // Handler pour gérer la cascade de niveaux
  const handleLevelChange = (level: string, checked: boolean) => {
    const newLevels = { ...completeLevels }
    
    if (checked) {
      // Si on coche un niveau, cocher tous les niveaux précédents
      const currentIndex = levelHierarchy.indexOf(level)
      for (let i = 0; i <= currentIndex; i++) {
        const prevLevel = levelHierarchy[i] as keyof typeof completeLevels
        newLevels[prevLevel] = true
      }
    } else {
      // Si on décoche un niveau, décocher tous les niveaux suivants
      const currentIndex = levelHierarchy.indexOf(level)
      for (let i = currentIndex; i < levelHierarchy.length; i++) {
        const nextLevel = levelHierarchy[i] as keyof typeof completeLevels
        newLevels[nextLevel] = false
      }
    }
    
    setCompleteLevels(newLevels)
  }

  // Obtenir les options de niveau préparé selon le niveau actuel
  const getPreparingOptions = () => {
    const highest = getHighestLevel()
    const options = [{ value: '', label: 'Aucun' }]
    
    if (!highest) {
      // Pas de niveau → peut préparer N1 ou N2
      options.push({ value: 'N1', label: 'N1' })
      options.push({ value: 'N2', label: 'N2' })
      return options
    }

    const currentIndex = levelHierarchy.indexOf(highest)
    
    // Ajouter le niveau suivant s'il existe
    if (currentIndex < levelHierarchy.length - 1) {
      const nextLevel = levelHierarchy[currentIndex + 1]
      options.push({ value: nextLevel, label: nextLevel })
    }
    
    return options
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Construire la chaîne diving_level avec les niveaux validés
      const levels: string[] = []
      Object.entries(completeLevels).forEach(([level, checked]) => {
        if (checked) levels.push(level)
      })
      
      // Ajouter le niveau préparé s'il y en a un
      if (preparingLevel) {
        levels.push(`preparing_${preparingLevel}`)
      }
      
      const diving_level = levels.length > 0 ? levels.join(',') : undefined
      
      await peopleApi.update(person.id, { diving_level })
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={`Niveau de plongée - ${person.first_name} ${person.last_name}`}>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-500/20 text-red-400 border border-red-500/50 p-3 rounded">{error}</div>}
        
        {/* Niveaux complets */}
        <div>
          <h3 className="font-semibold text-lg mb-3 text-white">🎓 Niveaux validés</h3>
          <p className="text-sm text-slate-300 mb-3">
            💡 Cocher un niveau coche automatiquement tous les niveaux précédents
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {levelHierarchy.map((level) => (
              <label key={level} className="flex items-center space-x-2 p-3 border border-slate-600 rounded-lg hover:bg-slate-700/30 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={completeLevels[level as keyof typeof completeLevels]} 
                  onChange={(e) => handleLevelChange(level, e.target.checked)}
                  className="w-4 h-4 accent-cyan-500"
                />
                <span className="font-medium text-white">{level}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Niveau en préparation */}
        <div className="border-t border-slate-700 pt-4">
          <h3 className="font-semibold text-lg mb-3 text-white">🎯 Niveau en préparation (optionnel)</h3>
          <p className="text-sm text-slate-300 mb-3">
            Sélectionnez le niveau que cette personne prépare actuellement
          </p>
          <select
            value={preparingLevel}
            onChange={(e) => setPreparingLevel(e.target.value)}
            className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {getPreparingOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Aperçu du résultat */}
        <div className="bg-cyan-500/10 p-4 rounded-lg border border-cyan-500/30">
          <h4 className="font-semibold text-cyan-300 mb-2">📊 Aperçu du résultat</h4>
          <p className="text-sm text-slate-200">
            <strong>Niveau validé :</strong> {getHighestLevel() || 'Aucun'}
          </p>
          {preparingLevel && (
            <p className="text-sm text-amber-400 mt-1">
              <strong>🎯 Prépare :</strong> {preparingLevel}
            </p>
          )}
          {(() => {
            const highest = getHighestLevel()
            const isInstructor = highest && levelHierarchy.indexOf(highest) >= levelHierarchy.indexOf('E2')
            if (isInstructor) {
              return (
                <p className="text-sm text-green-400 mt-1">
                  ✅ <strong>Encadrant</strong> (E2 ou supérieur)
                </p>
              )
            }
            return null
          })()}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'En cours...' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

