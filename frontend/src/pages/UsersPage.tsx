import { useEffect, useState } from 'react'
import { peopleApi, Person } from '@/lib/api'
import Button from '@/components/Button'
import Toast from '@/components/Toast'
import Modal from '@/components/Modal'

export default function UsersPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDivingLevelModal, setShowDivingLevelModal] = useState(false)
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

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

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return
    
    try {
      await peopleApi.delete(id)
      setToast({ message: 'Utilisateur supprimé', type: 'success' })
      loadPeople()
    } catch (error) {
      setToast({ message: 'Erreur lors de la suppression', type: 'error' })
    }
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Utilisateurs</h1>
        <Button onClick={() => { setEditingPerson(null); setShowModal(true) }}>
          ➕ Nouvel utilisateur
        </Button>
      </div>

      <div>
        <input
          type="text"
          placeholder="Rechercher par nom ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {people.map((person) => (
          <div key={person.id} className="bg-white p-4 rounded-lg shadow">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold">{person.first_name} {person.last_name}</h3>
              {person.is_instructor && (
                <span className="text-xs px-2 py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full font-semibold">
                  👨‍🏫 Encadrant
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600">{person.email}</p>
            {person.phone && <p className="text-sm text-gray-600">📞 {person.phone}</p>}
            
            {person.diving_level_display && (
              <div className="mt-2 space-y-1">
                <div>
                  <span className="text-sm font-medium text-blue-700">
                    🤿 Niveau: {person.diving_level_display}
                  </span>
                </div>
                {person.preparing_level && (
                  <div>
                    <span className="text-xs text-amber-700">
                      🎯 Prépare: <span className="font-medium">{person.preparing_level}</span>
                    </span>
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-3 flex flex-wrap gap-1">
              {person.default_is_encadrant && <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">Encadrant (défaut)</span>}
              {person.default_wants_nitrox && <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Nitrox</span>}
              {person.default_wants_stab && person.default_stab_size && <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">Stab {person.default_stab_size}</span>}
            </div>

            <div className="mt-4 flex space-x-2">
              <Button size="sm" variant="secondary" onClick={() => { setEditingPerson(person); setShowModal(true) }}>
                ✏️ Modifier
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setEditingPerson(person); setShowDivingLevelModal(true) }}>
                🤿 Niveau
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleDelete(person.id)}>
                🗑️
              </Button>
            </div>
          </div>
        ))}
      </div>

      {people.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Aucun utilisateur trouvé
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
  const [formData, setFormData] = useState({
    first_name: person?.first_name || '',
    last_name: person?.last_name || '',
    email: person?.email || '',
    phone: person?.phone || '',
    default_is_encadrant: person?.default_is_encadrant || false,
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
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold">{person ? 'Modifier' : 'Nouvel'} utilisateur</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Prénom *</label>
              <input type="text" required value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} className="w-full px-3 py-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nom *</label>
              <input type="text" required value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} className="w-full px-3 py-2 border rounded" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border rounded" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Téléphone</label>
            <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border rounded" />
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">Préférences par défaut</h3>
            
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center space-x-2">
                <input type="checkbox" checked={formData.default_is_encadrant} onChange={(e) => setFormData({ ...formData, default_is_encadrant: e.target.checked, default_wants_nitrox: e.target.checked ? formData.default_wants_nitrox : false, default_wants_2nd_reg: e.target.checked ? formData.default_wants_2nd_reg : false })} />
                <span>Encadrant</span>
              </label>
              <label className="flex items-center space-x-2">
                <input type="checkbox" checked={formData.default_wants_regulator} onChange={(e) => setFormData({ ...formData, default_wants_regulator: e.target.checked })} />
                <span>Détendeur</span>
              </label>
              {formData.default_is_encadrant && (
                <>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={formData.default_wants_nitrox} onChange={(e) => setFormData({ ...formData, default_wants_nitrox: e.target.checked })} />
                    <span>Nitrox</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={formData.default_wants_2nd_reg} onChange={(e) => setFormData({ ...formData, default_wants_2nd_reg: e.target.checked })} />
                    <span>2ème détendeur</span>
                  </label>
                </>
              )}
              <label className="flex items-center space-x-2">
                <input type="checkbox" checked={formData.default_wants_stab} onChange={(e) => setFormData({ ...formData, default_wants_stab: e.target.checked })} />
                <span>Stab</span>
              </label>
              {formData.default_wants_stab && (
                <div>
                  <select value={formData.default_stab_size} onChange={(e) => setFormData({ ...formData, default_stab_size: e.target.value })} className="w-full px-3 py-2 border rounded">
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

          <div className="flex justify-end space-x-3 pt-4 border-t">
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
    N4: currentLevels.includes('N4'),
    N5: currentLevels.includes('N5'),
    E2: currentLevels.includes('E2'),
    MF1: currentLevels.includes('MF1'),
    MF2: currentLevels.includes('MF2'),
  })
  
  const [competencies, setCompetencies] = useState({
    PE40: currentLevels.includes('PE40'),
    PA20: currentLevels.includes('PA20'),
    PA40: currentLevels.includes('PA40'),
    PE60: currentLevels.includes('PE60'),
    PA60: currentLevels.includes('PA60'),
  })

  const [preparingLevel, setPreparingLevel] = useState('')

  // Hiérarchie des niveaux
  const levelHierarchy = ['N1', 'N2', 'N3', 'N4', 'N5', 'E2', 'MF1', 'MF2']

  // Calculer le niveau le plus haut validé
  const getHighestLevel = () => {
    for (let i = levelHierarchy.length - 1; i >= 0; i--) {
      if (completeLevels[levelHierarchy[i] as keyof typeof completeLevels]) {
        return levelHierarchy[i]
      }
    }
    return null
  }

  // Obtenir les options de niveau préparé selon le niveau actuel
  const getPreparingOptions = () => {
    const highest = getHighestLevel()
    const options = [{ value: '', label: 'Aucun' }]
    
    if (!highest) {
      // Pas de niveau → peut préparer N1 ou N2
      options.push({ value: 'N1', label: 'N1' })
      options.push({ value: 'N2', label: 'N2 (avec compétences)' })
      return options
    }

    const currentIndex = levelHierarchy.indexOf(highest)
    
    // Ajouter le niveau suivant
    if (currentIndex < levelHierarchy.length - 1) {
      const nextLevel = levelHierarchy[currentIndex + 1]
      
      // Si le niveau suivant est N2, proposer les compétences N2
      if (nextLevel === 'N2') {
        options.push({ value: 'N2', label: 'N2 (PE40, PA20)' })
      }
      // Si le niveau suivant est N3, proposer les compétences N3
      else if (nextLevel === 'N3') {
        options.push({ value: 'N3', label: 'N3 (PA40, PE60, PA60)' })
      }
      else {
        options.push({ value: nextLevel, label: nextLevel })
      }
    }

    // Si on a N1, on peut préparer N2 avec compétences
    if (highest === 'N1') {
      // Déjà ajouté ci-dessus
    }
    // Si on a N2, on peut préparer N3 avec compétences
    else if (highest === 'N2') {
      // Déjà ajouté ci-dessus
    }
    
    return options
  }

  // Handler pour gérer la cascade de niveaux
  const handleLevelChange = (level: string, checked: boolean) => {
    const newLevels = { ...completeLevels }
    const newCompetencies = { ...competencies }
    
    if (checked) {
      // Si on coche un niveau, cocher tous les niveaux précédents
      const currentIndex = levelHierarchy.indexOf(level)
      for (let i = 0; i <= currentIndex; i++) {
        const prevLevel = levelHierarchy[i] as keyof typeof completeLevels
        newLevels[prevLevel] = true
      }
      
      // Décocher les compétences devenues obsolètes
      if (level === 'N2' || currentIndex >= levelHierarchy.indexOf('N2')) {
        newCompetencies.PE40 = false
        newCompetencies.PA20 = false
      }
      if (level === 'N3' || currentIndex >= levelHierarchy.indexOf('N3')) {
        newCompetencies.PA40 = false
        newCompetencies.PE60 = false
        newCompetencies.PA60 = false
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
    setCompetencies(newCompetencies)
  }

  // Handler pour gérer la cascade des compétences N2
  const handleN2CompetencyChange = (comp: 'PE40' | 'PA20', checked: boolean) => {
    const newCompetencies = { ...competencies }
    
    if (checked && comp === 'PA20') {
      // Si on coche PA20, cocher PE40
      newCompetencies.PE40 = true
    }
    
    newCompetencies[comp] = checked
    setCompetencies(newCompetencies)
  }

  // Handler pour gérer la cascade des compétences N3
  const handleN3CompetencyChange = (comp: 'PA40' | 'PE60' | 'PA60', checked: boolean) => {
    const newCompetencies = { ...competencies }
    
    if (checked) {
      if (comp === 'PA60') {
        // Si on coche PA60, cocher PA40 et PE60
        newCompetencies.PA40 = true
        newCompetencies.PE60 = true
      }
    }
    
    newCompetencies[comp] = checked
    setCompetencies(newCompetencies)
  }

  // Handler pour le changement de niveau préparé
  const handlePreparingLevelChange = (value: string) => {
    setPreparingLevel(value)
    
    // Si on sélectionne N2, suggérer de cocher les compétences N2
    if (value === 'N2') {
      // On ne force pas, on laisse l'utilisateur choisir
    }
    // Si on sélectionne N3, suggérer de cocher les compétences N3
    else if (value === 'N3') {
      // On ne force pas, on laisse l'utilisateur choisir
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Construire la chaîne diving_level
      const levels: string[] = []
      
      // Ajouter les niveaux complets validés
      Object.entries(completeLevels).forEach(([level, checked]) => {
        if (checked) levels.push(level)
      })
      
      // Ajouter les compétences validées UNIQUEMENT si le niveau n'est pas déjà validé
      const hasN2OrHigher = completeLevels.N2 || completeLevels.N3 || completeLevels.N4 || 
                            completeLevels.N5 || completeLevels.E2 || completeLevels.MF1 || completeLevels.MF2
      const hasN3OrHigher = completeLevels.N3 || completeLevels.N4 || completeLevels.N5 || 
                            completeLevels.E2 || completeLevels.MF1 || completeLevels.MF2
      
      // Compétences N2 uniquement si N2 pas encore validé
      if (!hasN2OrHigher) {
        if (competencies.PE40) levels.push('PE40')
        if (competencies.PA20) levels.push('PA20')
      }
      
      // Compétences N3 uniquement si N3 pas encore validé
      if (!hasN3OrHigher) {
        if (competencies.PA40) levels.push('PA40')
        if (competencies.PE60) levels.push('PE60')
        if (competencies.PA60) levels.push('PA60')
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
        {error && <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>}
        
        {/* Niveaux complets */}
        <div>
          <h3 className="font-semibold text-lg mb-3 text-gray-900">🎓 Niveaux validés</h3>
          <p className="text-sm text-gray-600 mb-3">
            💡 Cocher un niveau coche automatiquement tous les niveaux précédents
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {levelHierarchy.map((level) => (
              <label key={level} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={completeLevels[level as keyof typeof completeLevels]} 
                  onChange={(e) => handleLevelChange(level, e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="font-medium">{level}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Niveau préparé */}
        <div className="border-t pt-4">
          <h3 className="font-semibold text-lg mb-3 text-gray-900">🎯 Niveau en préparation</h3>
          <p className="text-sm text-gray-600 mb-3">
            Sélectionnez le niveau que cette personne prépare actuellement
          </p>
          <select
            value={preparingLevel}
            onChange={(e) => handlePreparingLevelChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {getPreparingOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {preparingLevel === 'N2' && (
            <p className="text-sm text-amber-600 mt-2">
              💡 Cochez les compétences N2 ci-dessous (PE40, PA20)
            </p>
          )}
          {preparingLevel === 'N3' && (
            <p className="text-sm text-amber-600 mt-2">
              💡 Cochez les compétences N3 ci-dessous (PA40, PE60, PA60)
            </p>
          )}
        </div>

        {/* Compétences N2 - Masquer si N2 ou supérieur est validé */}
        {!completeLevels.N2 && !completeLevels.N3 && !completeLevels.N4 && !completeLevels.N5 && !completeLevels.E2 && !completeLevels.MF1 && !completeLevels.MF2 && (
          <div>
            <h3 className="font-semibold text-lg mb-3 text-gray-900">📚 Compétences N2</h3>
            <p className="text-sm text-gray-600 mb-3">
              💡 Cocher PA20 coche automatiquement PE40
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={competencies.PE40} 
                  onChange={(e) => handleN2CompetencyChange('PE40', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="font-medium">PE40</span>
              </label>
              <label className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={competencies.PA20} 
                  onChange={(e) => handleN2CompetencyChange('PA20', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="font-medium">PA20</span>
              </label>
            </div>
          </div>
        )}

        {/* Compétences N3 - Masquer si N3 ou supérieur est validé */}
        {!completeLevels.N3 && !completeLevels.N4 && !completeLevels.N5 && !completeLevels.E2 && !completeLevels.MF1 && !completeLevels.MF2 && (
          <div>
            <h3 className="font-semibold text-lg mb-3 text-gray-900">📚 Compétences N3</h3>
            <p className="text-sm text-gray-600 mb-3">
              💡 Cocher PA60 coche automatiquement PA40 et PE60
            </p>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={competencies.PA40} 
                  onChange={(e) => handleN3CompetencyChange('PA40', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="font-medium">PA40</span>
              </label>
              <label className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={competencies.PE60} 
                  onChange={(e) => handleN3CompetencyChange('PE60', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="font-medium">PE60</span>
              </label>
              <label className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={competencies.PA60} 
                  onChange={(e) => handleN3CompetencyChange('PA60', e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="font-medium">PA60</span>
              </label>
            </div>
          </div>
        )}

        {/* Info calculée en temps réel */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-2">📊 Aperçu du résultat</h4>
          <p className="text-sm text-blue-800">
            <strong>Niveau affiché :</strong> 
            {(() => {
              const validatedLevels = Object.entries(completeLevels)
                .filter(([_, checked]) => checked)
                .map(([level, _]) => level)
              const validatedComps = Object.entries(competencies)
                .filter(([_, checked]) => checked)
                .map(([comp, _]) => comp)
              
              if (validatedLevels.length === 0 && validatedComps.length === 0) {
                return ' Aucun niveau'
              }
              
              // Si toutes les compétences N2 sont validées
              if (validatedComps.includes('PE40') && validatedComps.includes('PA20')) {
                return ' N2'
              }
              // Si toutes les compétences N3 sont validées
              if (validatedComps.includes('PA40') && validatedComps.includes('PE60') && validatedComps.includes('PA60')) {
                return ' N3'
              }
              // Sinon afficher les compétences en cours
              if (validatedComps.length > 0) {
                return ' ' + validatedComps.join(', ')
              }
              
              // Sinon le niveau le plus haut
              const highest = getHighestLevel()
              return highest ? ' ' + highest : ' Aucun niveau'
            })()}
          </p>
          {(() => {
            const validatedComps = Object.entries(competencies)
              .filter(([_, checked]) => checked)
              .map(([comp, _]) => comp)
            const hasN2Comps = validatedComps.some(c => ['PE40', 'PA20'].includes(c))
            const hasN3Comps = validatedComps.some(c => ['PA40', 'PE60', 'PA60'].includes(c))
            const isN2Complete = validatedComps.includes('PE40') && validatedComps.includes('PA20')
            const isN3Complete = validatedComps.includes('PA40') && validatedComps.includes('PE60') && validatedComps.includes('PA60')
            
            if (hasN2Comps && !isN2Complete) {
              return (
                <p className="text-sm text-amber-700 mt-1">
                  <strong>Prépare :</strong> N2
                </p>
              )
            }
            if (hasN3Comps && !isN3Complete) {
              return (
                <p className="text-sm text-amber-700 mt-1">
                  <strong>Prépare :</strong> N3
                </p>
              )
            }
            return null
          })()}
          {(() => {
            const highest = getHighestLevel()
            const isInstructor = highest && levelHierarchy.indexOf(highest) >= levelHierarchy.indexOf('E2')
            if (isInstructor) {
              return (
                <p className="text-sm text-green-700 mt-1">
                  ✅ <strong>Encadrant</strong> (E2 ou supérieur)
                </p>
              )
            }
            return null
          })()}
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
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

