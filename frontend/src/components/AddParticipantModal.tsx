import { useState, useEffect } from 'react'
import Button from './Button'
import Toast from './Toast'
import { peopleApi, Person, importApi } from '@/lib/api'

interface AddParticipantModalProps {
  sessionId: string
  sessionName: string
  onClose: () => void
  onSuccess: () => void
}

export default function AddParticipantModal({
  sessionId,
  sessionName,
  onClose,
  onSuccess,
}: AddParticipantModalProps) {
  const [mode, setMode] = useState<'select' | 'create'>('select')
  const [searchTerm, setSearchTerm] = useState('')
  const [people, setPeople] = useState<Person[]>([])
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  })
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  useEffect(() => {
    if (mode === 'select' && searchTerm.length > 1) {
      loadPeople()
    }
  }, [searchTerm, mode])

  const loadPeople = async () => {
    try {
      const response = await peopleApi.list(searchTerm)
      setPeople(response.data)
    } catch (error) {
      console.error('Error loading people:', error)
    }
  }

  const handleSelectPerson = async (person: Person) => {
    setLoading(true)
    try {
      const csvContent = `first_name,last_name,email,phone
${person.first_name},${person.last_name},${person.email},${person.phone || ''}`
      
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const file = new File([blob], 'participant.csv', { type: 'text/csv' })
      
      await importApi.importCsv(sessionId, file)

      setToast({ message: 'Participant ajouté !', type: 'success' })
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1500)
    } catch (error: any) {
      setToast({ message: error.message || 'Erreur', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.email.trim()) {
      setToast({ message: 'Tous les champs obligatoires doivent être remplis', type: 'error' })
      return
    }
    if (!formData.email.includes('@')) {
      setToast({ message: "L'email n'est pas valide", type: 'error' })
      return
    }

    setLoading(true)
    try {
      const csvContent = `first_name,last_name,email,phone
${formData.first_name},${formData.last_name},${formData.email},${formData.phone || ''}`
      
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const file = new File([blob], 'participant.csv', { type: 'text/csv' })
      
      await importApi.importCsv(sessionId, file)

      setToast({ message: 'Participant ajouté !', type: 'success' })
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1500)
    } catch (error: any) {
      setToast({ message: error.message || 'Erreur', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="theme-modal-bg rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 theme-modal-bg border-b theme-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold theme-text">Ajouter un participant</h2>
              <p className="text-sm theme-text-secondary mt-1">Session : {sessionName}</p>
            </div>
            <button onClick={onClose} className="theme-text-dimmed hover:theme-text-secondary text-2xl leading-none">×</button>
          </div>
          <div className="flex space-x-2 mt-4">
            <button type="button" onClick={() => setMode('select')} className={`px-4 py-2 rounded ${mode === 'select' ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}>
              Sélectionner un utilisateur
            </button>
            <button type="button" onClick={() => setMode('create')} className={`px-4 py-2 rounded ${mode === 'create' ? 'bg-primary-600 text-white' : 'bg-gray-200'}`}>
              Créer un nouvel utilisateur
            </button>
          </div>
        </div>

        {mode === 'select' ? (
          <div className="p-6 space-y-4">
            <input
              type="text"
              placeholder="Rechercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 theme-bg-input rounded-lg"
              autoFocus
            />
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {people.length === 0 && searchTerm.length > 1 && (
                <p className="text-center theme-text-muted py-8">Aucun utilisateur trouvé</p>
              )}
              {people.length === 0 && searchTerm.length <= 1 && (
                <p className="text-center theme-text-muted py-8">Commencez à taper pour rechercher...</p>
              )}
              {people.map((person) => (
                <div
                  key={person.id}
                  className="border theme-border rounded-lg p-4 theme-hover cursor-pointer"
                  onClick={() => handleSelectPerson(person)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold theme-text">{person.first_name} {person.last_name}</p>
                      <p className="text-sm theme-text-secondary">{person.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {person.is_instructor && <span className="text-xs px-2 py-1 bg-purple-100 rounded">Encadrant</span>}
                      {person.default_wants_nitrox && <span className="text-xs px-2 py-1 bg-yellow-100 rounded">Nitrox</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium theme-text-secondary mb-2">
                Prénom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-4 py-2 theme-bg-input rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="Jean"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium theme-text-secondary mb-2">
                Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-4 py-2 theme-bg-input rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                placeholder="Dupont"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium theme-text-secondary mb-2">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 theme-bg-input rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="jean.dupont@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium theme-text-secondary mb-2">
              Téléphone <span className="theme-text-dimmed text-xs">(optionnel)</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 theme-bg-input rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="06 12 34 56 78"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t theme-border">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? 'Ajout en cours...' : '✅ Ajouter le participant'}
            </Button>
          </div>
          </form>
        )}

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>
  )
}

