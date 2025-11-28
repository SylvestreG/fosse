import { useEffect, useState } from 'react'
import { peopleApi, Person } from '@/lib/api'
import Button from '@/components/Button'
import Toast from '@/components/Toast'

export default function UsersPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
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
            <h3 className="text-lg font-semibold">{person.first_name} {person.last_name}</h3>
            <p className="text-sm text-gray-600">{person.email}</p>
            {person.phone && <p className="text-sm text-gray-600">📞 {person.phone}</p>}
            
            <div className="mt-3 flex flex-wrap gap-1">
              {person.default_is_encadrant && <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded">Encadrant</span>}
              {person.default_wants_nitrox && <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Nitrox</span>}
              {person.default_wants_stab && person.default_stab_size && <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">Stab {person.default_stab_size}</span>}
            </div>

            <div className="mt-4 flex space-x-2">
              <Button size="sm" variant="secondary" onClick={() => { setEditingPerson(person); setShowModal(true) }}>
                ✏️ Modifier
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

