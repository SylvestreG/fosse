import { useEffect, useState } from 'react'
import { peopleApi, Person } from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { useThemeStore } from '@/lib/theme'
import Button from '@/components/Button'
import Toast from '@/components/Toast'

export default function MyProfilePage() {
  const { email, impersonating } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
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

  // Classes de thème
  const cardClass = theme === 'dark' 
    ? 'bg-slate-800/50 backdrop-blur-xl border-slate-700' 
    : 'bg-white/90 backdrop-blur-xl border-gray-200 shadow-lg'
  const titleClass = theme === 'dark' ? 'text-white' : 'text-gray-900'
  const labelClass = theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
  const textClass = theme === 'dark' ? 'text-white' : 'text-gray-900'
  const inputClass = theme === 'dark'
    ? 'bg-slate-700/50 border-slate-600 text-white placeholder-slate-400'
    : 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400'
  const checkboxBorderClass = theme === 'dark' ? 'border-slate-600 hover:bg-slate-700/30' : 'border-gray-200 hover:bg-gray-50'

  if (loading) {
    return <div className={`text-center py-12 ${labelClass}`}>Chargement...</div>
  }

  if (!person) {
    return (
      <div className="text-center py-12">
        <p className={labelClass}>Profil non trouvé. Contactez un administrateur.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className={`text-3xl font-bold ${titleClass}`}>👤 Mon Profil</h1>

      {/* Apparence */}
      <div className={`${cardClass} rounded-lg shadow p-6 border`}>
        <h2 className={`text-xl font-semibold mb-4 ${titleClass}`}>🎨 Apparence</h2>
        <p className={`text-sm ${labelClass} mb-4`}>
          Choisissez le thème de l'interface
        </p>
        
        <div className="flex gap-4">
          <button
            onClick={() => setTheme('dark')}
            className={`flex-1 p-4 rounded-lg border-2 transition-all ${
              theme === 'dark'
                ? 'border-cyan-500 bg-slate-800'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              </div>
              <span className={theme === 'dark' ? 'text-white font-medium' : 'text-gray-700'}>Sombre</span>
            </div>
          </button>
          
          <button
            onClick={() => setTheme('light')}
            className={`flex-1 p-4 rounded-lg border-2 transition-all ${
              theme === 'light'
                ? 'border-cyan-500 bg-white'
                : theme === 'dark' ? 'border-slate-600 hover:border-slate-500' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center justify-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-gray-200' : 'bg-yellow-100 border border-yellow-300'}`}>
                <svg className={`w-4 h-4 ${theme === 'dark' ? 'text-gray-600' : 'text-yellow-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <span className={theme === 'dark' ? 'text-slate-300' : 'text-gray-900 font-medium'}>Clair</span>
            </div>
          </button>
        </div>
      </div>

      {/* Informations de base (lecture seule) */}
      <div className={`${cardClass} rounded-lg shadow p-6 border`}>
        <h2 className={`text-xl font-semibold mb-4 ${titleClass}`}>Informations personnelles</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium ${labelClass}`}>Prénom</label>
            <p className={`text-lg font-medium ${textClass}`}>{person.first_name}</p>
          </div>
          <div>
            <label className={`block text-sm font-medium ${labelClass}`}>Nom</label>
            <p className={`text-lg font-medium ${textClass}`}>{person.last_name}</p>
          </div>
          <div className="col-span-2">
            <label className={`block text-sm font-medium ${labelClass}`}>Email</label>
            <p className={`text-lg ${textClass}`}>{person.email}</p>
          </div>
          <div className="col-span-2">
            <label className={`block text-sm font-medium ${labelClass} mb-1`}>Téléphone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={`w-full px-3 py-2 ${inputClass} border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500`}
              placeholder="06 12 34 56 78"
            />
          </div>
        </div>
      </div>

      {/* Niveau de plongée (lecture seule) */}
      <div className={`${cardClass} rounded-lg shadow p-6 border`}>
        <h2 className={`text-xl font-semibold mb-4 ${titleClass}`}>🤿 Niveau de plongée</h2>
        
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className={labelClass}>Niveau validé :</span>
            <span className="text-lg font-semibold text-cyan-500">
              {person.diving_level_display || 'Aucun'}
            </span>
          </div>
          
          {person.preparing_level && (
            <div className="flex items-center gap-3">
              <span className={labelClass}>En préparation :</span>
              <span className="text-lg font-semibold text-amber-500">
                🎯 {person.preparing_level}
              </span>
            </div>
          )}
          
          {person.is_instructor && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full">
              👨‍🏫 Encadrant
            </div>
          )}
        </div>
        
        <p className={`text-sm ${labelClass} mt-4`}>
          Pour modifier votre niveau, contactez un administrateur.
        </p>
      </div>

      {/* Préférences de matériel (modifiable) */}
      <div className={`${cardClass} rounded-lg shadow p-6 border`}>
        <h2 className={`text-xl font-semibold mb-4 ${titleClass}`}>⚙️ Préférences de matériel</h2>
        <p className={`text-sm ${labelClass} mb-4`}>
          Ces préférences seront utilisées par défaut lors de vos inscriptions aux sessions.
        </p>
        
        <div className="space-y-4">
          <label className={`flex items-center gap-3 p-3 border ${checkboxBorderClass} rounded-lg cursor-pointer`}>
            <input
              type="checkbox"
              checked={formData.default_wants_regulator}
              onChange={(e) => setFormData({ ...formData, default_wants_regulator: e.target.checked })}
              className="w-5 h-5 accent-cyan-500"
            />
            <div>
              <span className={`font-medium ${textClass}`}>Détendeur</span>
              <p className={`text-sm ${labelClass}`}>J'ai besoin d'un détendeur</p>
            </div>
          </label>

          {person.is_instructor && (
            <>
              <label className={`flex items-center gap-3 p-3 border ${checkboxBorderClass} rounded-lg cursor-pointer`}>
                <input
                  type="checkbox"
                  checked={formData.default_wants_nitrox}
                  onChange={(e) => setFormData({ ...formData, default_wants_nitrox: e.target.checked })}
                  className="w-5 h-5 accent-cyan-500"
                />
                <div>
                  <span className={`font-medium ${textClass}`}>Nitrox</span>
                  <p className={`text-sm ${labelClass}`}>Je plonge au Nitrox</p>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-3 border ${checkboxBorderClass} rounded-lg cursor-pointer`}>
                <input
                  type="checkbox"
                  checked={formData.default_wants_2nd_reg}
                  onChange={(e) => setFormData({ ...formData, default_wants_2nd_reg: e.target.checked })}
                  className="w-5 h-5 accent-cyan-500"
                />
                <div>
                  <span className={`font-medium ${textClass}`}>2ème détendeur</span>
                  <p className={`text-sm ${labelClass}`}>J'ai besoin d'un 2ème détendeur (encadrement)</p>
                </div>
              </label>
            </>
          )}

          <label className={`flex items-center gap-3 p-3 border ${checkboxBorderClass} rounded-lg cursor-pointer`}>
            <input
              type="checkbox"
              checked={formData.default_wants_stab}
              onChange={(e) => setFormData({ ...formData, default_wants_stab: e.target.checked })}
              className="w-5 h-5 accent-cyan-500"
            />
            <div>
              <span className={`font-medium ${textClass}`}>Stab</span>
              <p className={`text-sm ${labelClass}`}>J'ai besoin d'une stab</p>
            </div>
          </label>

          {formData.default_wants_stab && (
            <div className="ml-8">
              <label className={`block text-sm font-medium ${labelClass} mb-1`}>Taille de stab</label>
              <select
                value={formData.default_stab_size}
                onChange={(e) => setFormData({ ...formData, default_stab_size: e.target.value })}
                className={`w-full px-3 py-2 ${inputClass} border rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500`}
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

