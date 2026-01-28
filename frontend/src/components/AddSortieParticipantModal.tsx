import { useState, useEffect } from 'react'
import Button from './Button'
import Toast from './Toast'
import { peopleApi, Person, questionnairesApi } from '@/lib/api'

interface AddSortieParticipantModalProps {
  sortieId: string
  sortieName: string
  sortieType: 'exploration' | 'technique'
  nitroxCompatible: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function AddSortieParticipantModal({
  sortieId,
  sortieName,
  sortieType,
  nitroxCompatible,
  onClose,
  onSuccess,
}: AddSortieParticipantModalProps) {
  const [mode, setMode] = useState<'select' | 'create'>('select')
  const [searchTerm, setSearchTerm] = useState('')
  const [people, setPeople] = useState<Person[]>([])
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    is_encadrant: false,
    nitrox_base_formation: false,
    nitrox_confirmed_formation: false,
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

  const handleSelectPerson = (person: Person) => {
    setSelectedPerson(person)
    setFormData({
      ...formData,
      first_name: person.first_name,
      last_name: person.last_name,
      email: person.email,
      is_encadrant: person.is_instructor || false,
    })
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
      await questionnairesApi.register({
        sortie_id: sortieId,
        email: formData.email,
        first_name: formData.first_name,
        last_name: formData.last_name,
        is_encadrant: formData.is_encadrant,
        wants_regulator: false,
        wants_nitrox: false,
        wants_2nd_reg: false,
        wants_stab: false,
        nitrox_training: false,
        nitrox_base_formation: formData.nitrox_base_formation,
        nitrox_confirmed_formation: formData.nitrox_confirmed_formation,
        comes_from_issoire: false,
        has_car: false,
      })

      setToast({ message: 'Participant ajouté !', type: 'success' })
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1000)
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Erreur'
      setToast({ message: errorMessage, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const showNitroxOptions = sortieType === 'technique' && nitroxCompatible

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800/90 backdrop-blur-xl rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-800/90 backdrop-blur-xl border-b border-slate-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Ajouter un participant</h2>
              <p className="text-sm text-slate-300 mt-1">Sortie : {sortieName}</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-2xl leading-none">×</button>
          </div>
          <div className="flex space-x-2 mt-4">
            <button 
              type="button" 
              onClick={() => { setMode('select'); setSelectedPerson(null) }} 
              className={`px-4 py-2 rounded ${mode === 'select' && !selectedPerson ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              Sélectionner un utilisateur
            </button>
            <button 
              type="button" 
              onClick={() => { setMode('create'); setSelectedPerson(null); setFormData({ ...formData, first_name: '', last_name: '', email: '', is_encadrant: false }) }} 
              className={`px-4 py-2 rounded ${mode === 'create' ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              Créer un nouvel utilisateur
            </button>
          </div>
        </div>

        {mode === 'select' && !selectedPerson ? (
          <div className="p-6 space-y-4">
            <input
              type="text"
              placeholder="Rechercher par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400"
              autoFocus
            />
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {people.length === 0 && searchTerm.length > 1 && (
                <p className="text-center text-slate-400 py-8">Aucun utilisateur trouvé</p>
              )}
              {people.length === 0 && searchTerm.length <= 1 && (
                <p className="text-center text-slate-400 py-8">Commencez à taper pour rechercher...</p>
              )}
              {people.map((person) => {
                // Get highest level from diving_level (e.g., "N1,N2,N3" -> "N3")
                const highestLevel = person.diving_level?.split(',').pop()?.trim()
                // Clean preparing level (e.g., "preparing_N3" -> "N3")
                const prepLevel = person.preparing_level?.replace('preparing_', '')
                return (
                  <div
                    key={person.id}
                    className="border border-slate-600 rounded-lg p-4 hover:bg-slate-700/30 cursor-pointer"
                    onClick={() => handleSelectPerson(person)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-white">
                          {person.first_name} {person.last_name}
                          {highestLevel && <span className="ml-2 text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">{highestLevel}</span>}
                        </p>
                        <p className="text-sm text-slate-300">{person.email}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {person.is_instructor && <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded">Encadrant</span>}
                        {prepLevel && <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded">Prép. {prepLevel}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {selectedPerson && (() => {
              const highestLevel = selectedPerson.diving_level?.split(',').pop()?.trim()
              const prepLevel = selectedPerson.preparing_level?.replace('preparing_', '')
              return (
                <div className="bg-slate-700/30 p-4 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm text-slate-400">Utilisateur sélectionné :</p>
                      <p className="text-lg font-semibold text-white">
                        {selectedPerson.first_name} {selectedPerson.last_name}
                        {highestLevel && <span className="ml-2 text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">{highestLevel}</span>}
                      </p>
                      <p className="text-sm text-slate-300">{selectedPerson.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedPerson.is_instructor && <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded">Encadrant</span>}
                      {prepLevel && <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded">Prép. {prepLevel}</span>}
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setSelectedPerson(null)} 
                    className="text-sm text-cyan-400 hover:text-cyan-300 mt-2"
                  >
                    ← Changer d'utilisateur
                  </button>
                </div>
              )
            })()}

            {mode === 'create' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">
                      Prénom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="Jean"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-200 mb-2">
                      Nom <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="Dupont"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="jean.dupont@example.com"
                    required
                  />
                </div>
              </>
            )}

            {showNitroxOptions && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-green-300">Formation Nitrox</p>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="nitrox_base"
                    checked={formData.nitrox_base_formation}
                    onChange={e => setFormData({ ...formData, nitrox_base_formation: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="nitrox_base" className="text-sm text-white">
                    Formation Nitrox Base (pour N1+)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="nitrox_confirmed"
                    checked={formData.nitrox_confirmed_formation}
                    onChange={e => setFormData({ ...formData, nitrox_confirmed_formation: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="nitrox_confirmed" className="text-sm text-white">
                    Formation Nitrox Confirmé (pour N2+)
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-600">
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
                {loading ? 'Ajout en cours...' : 'Ajouter le participant'}
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
