import { useEffect, useState } from 'react'
import { peopleApi, Person } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import Button from '@/components/Button'
import Toast from '@/components/Toast'

export default function MyProfilePage() {
  const { email, impersonating } = useAuthStore()
  const [person, setPerson] = useState<Person | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Si on impersonnifie, utiliser l'email de la personne impersonnifiée
  const targetEmail = impersonating?.user_email || email

  const [formData, setFormData] = useState({
    phone: '',
    default_wants_regulator: true,
    default_wants_nitrox: false,
    default_wants_2nd_reg: false,
    default_wants_stab: true,
    default_stab_size: 'M',
  })

  useEffect(() => {
    loadMyProfile()
  }, [targetEmail])

  const loadMyProfile = async () => {
    if (!targetEmail) return
    
    try {
      // Chercher l'utilisateur par son email
      const response = await peopleApi.list(targetEmail)
      const me = response.data.find(p => p.email === targetEmail)
      
      if (me) {
        setPerson(me)
        setFormData({
          phone: me.phone || '',
          default_wants_regulator: me.default_wants_regulator,
          default_wants_nitrox: me.default_wants_nitrox,
          default_wants_2nd_reg: me.default_wants_2nd_reg,
          default_wants_stab: me.default_wants_stab,
          default_stab_size: me.default_stab_size || 'M',
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      setToast({ message: 'Erreur lors du chargement du profil', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!person) return
    
    setSaving(true)
    try {
      await peopleApi.update(person.id, formData)
      setToast({ message: 'Préférences sauvegardées', type: 'success' })
      loadMyProfile()
    } catch (error) {
      setToast({ message: 'Erreur lors de la sauvegarde', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  if (!person) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Profil non trouvé. Contactez un administrateur.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-white">👤 Mon Profil</h1>

      {/* Informations de base (lecture seule) */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Informations personnelles</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400">Prénom</label>
            <p className="text-lg font-medium text-white">{person.first_name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400">Nom</label>
            <p className="text-lg font-medium text-white">{person.last_name}</p>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-400">Email</label>
            <p className="text-lg text-white">{person.email}</p>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-slate-400 mb-1">Téléphone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="06 12 34 56 78"
            />
          </div>
        </div>
      </div>

      {/* Niveau de plongée (lecture seule) */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-white">🤿 Niveau de plongée</h2>
        
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-slate-300">Niveau validé :</span>
            <span className="text-lg font-semibold text-cyan-400">
              {person.diving_level_display || 'Aucun'}
            </span>
          </div>
          
          {person.preparing_level && (
            <div className="flex items-center gap-3">
              <span className="text-slate-300">En préparation :</span>
              <span className="text-lg font-semibold text-amber-400">
                🎯 {person.preparing_level}
              </span>
            </div>
          )}
          
          {person.is_instructor && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full">
              👨‍🏫 Encadrant
            </div>
          )}
        </div>
        
        <p className="text-sm text-slate-400 mt-4">
          Pour modifier votre niveau, contactez un administrateur.
        </p>
      </div>

      {/* Préférences de matériel (modifiable) */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-white">⚙️ Préférences de matériel</h2>
        <p className="text-sm text-slate-300 mb-4">
          Ces préférences seront utilisées par défaut lors de vos inscriptions aux sessions.
        </p>
        
        <div className="space-y-4">
          <label className="flex items-center gap-3 p-3 border border-slate-600 rounded-lg hover:bg-slate-700/30 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.default_wants_regulator}
              onChange={(e) => setFormData({ ...formData, default_wants_regulator: e.target.checked })}
              className="w-5 h-5 accent-cyan-500"
            />
            <div>
              <span className="font-medium text-white">Détendeur</span>
              <p className="text-sm text-slate-400">J'ai besoin d'un détendeur</p>
            </div>
          </label>

          {person.is_instructor && (
            <>
              <label className="flex items-center gap-3 p-3 border border-slate-600 rounded-lg hover:bg-slate-700/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.default_wants_nitrox}
                  onChange={(e) => setFormData({ ...formData, default_wants_nitrox: e.target.checked })}
                  className="w-5 h-5 accent-cyan-500"
                />
                <div>
                  <span className="font-medium text-white">Nitrox</span>
                  <p className="text-sm text-slate-400">Je plonge au Nitrox</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 border border-slate-600 rounded-lg hover:bg-slate-700/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.default_wants_2nd_reg}
                  onChange={(e) => setFormData({ ...formData, default_wants_2nd_reg: e.target.checked })}
                  className="w-5 h-5 accent-cyan-500"
                />
                <div>
                  <span className="font-medium text-white">2ème détendeur</span>
                  <p className="text-sm text-slate-400">J'ai besoin d'un 2ème détendeur (encadrement)</p>
                </div>
              </label>
            </>
          )}

          <label className="flex items-center gap-3 p-3 border border-slate-600 rounded-lg hover:bg-slate-700/30 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.default_wants_stab}
              onChange={(e) => setFormData({ ...formData, default_wants_stab: e.target.checked })}
              className="w-5 h-5 accent-cyan-500"
            />
            <div>
              <span className="font-medium text-white">Stab</span>
              <p className="text-sm text-slate-400">J'ai besoin d'une stab</p>
            </div>
          </label>

          {formData.default_wants_stab && (
            <div className="ml-8">
              <label className="block text-sm font-medium text-slate-300 mb-1">Taille de stab</label>
              <select
                value={formData.default_stab_size}
                onChange={(e) => setFormData({ ...formData, default_stab_size: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="XS">XS</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegarde...' : '💾 Sauvegarder mes préférences'}
          </Button>
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}

