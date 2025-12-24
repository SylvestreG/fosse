import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { questionnairesApi, QuestionnaireTokenData } from '@/lib/api'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Toast from '@/components/Toast'

export default function PublicQuestionnaire() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<QuestionnaireTokenData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [formData, setFormData] = useState({
    is_encadrant: false,
    wants_regulator: false,
    wants_nitrox: false,
    wants_2nd_reg: false,
    wants_stab: false,
    stab_size: '',
    comes_from_issoire: false,
    has_car: false,
    car_seats: '',
    comments: '',
  })

  useEffect(() => {
    if (token) {
      loadQuestionnaire()
    }
  }, [token])

  const loadQuestionnaire = async () => {
    try {
      const response = await questionnairesApi.getByToken(token!)
      setData(response.data)
      
      // Pre-fill form if questionnaire exists
      if (response.data.questionnaire) {
        const q = response.data.questionnaire
        setFormData({
          is_encadrant: q.is_encadrant,
          wants_regulator: q.wants_regulator,
          wants_nitrox: q.wants_nitrox,
          wants_2nd_reg: q.wants_2nd_reg,
          wants_stab: q.wants_stab,
          stab_size: q.stab_size || '',
          comes_from_issoire: q.comes_from_issoire,
          has_car: q.has_car,
          car_seats: q.car_seats?.toString() || '',
          comments: q.comments || '',
        })
      }
    } catch (error: any) {
      const message = error.response?.data?.error || 'Lien invalide ou expiré'
      setToast({ message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return

    setSubmitting(true)
    try {
      await questionnairesApi.submit({
        token,
        is_encadrant: formData.is_encadrant,
        wants_regulator: formData.wants_regulator,
        wants_nitrox: formData.wants_nitrox,
        wants_2nd_reg: formData.wants_2nd_reg,
        wants_stab: formData.wants_stab,
        stab_size: formData.wants_stab && formData.stab_size ? formData.stab_size : undefined,
        comes_from_issoire: formData.comes_from_issoire,
        has_car: formData.has_car,
        car_seats: formData.has_car && formData.car_seats ? parseInt(formData.car_seats) : undefined,
        comments: formData.comments || undefined,
      })
      setToast({ message: 'Questionnaire soumis avec succès!', type: 'success' })
      setTimeout(() => {
        // Could navigate to a thank you page
      }, 2000)
    } catch (error: any) {
      const message = error.response?.data?.error || 'Erreur lors de la soumission'
      setToast({ message, type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-slate-200">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Lien invalide</h2>
          <p className="text-slate-300">Ce lien est invalide ou a expiré.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="USI Plongée" className="w-20 h-20 mx-auto mb-4 object-contain" />
            <h1 className="text-3xl font-bold text-primary-600 mb-2">USI - Commission Technique</h1>
            <h2 className="text-2xl font-semibold text-white mb-2">Questionnaire plongée</h2>
            <p className="text-slate-300">
              Bonjour {data.person.first_name} {data.person.last_name}
            </p>
          </div>

          {data.questionnaire?.submitted_at ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <p className="text-green-700 font-medium mb-2">Questionnaire déjà soumis</p>
              <p className="text-slate-300 text-sm">
                Vous avez déjà soumis ce questionnaire le {new Date(data.questionnaire.submitted_at).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Informations</h3>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_encadrant"
                    checked={formData.is_encadrant}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      is_encadrant: e.target.checked,
                      wants_nitrox: e.target.checked ? formData.wants_nitrox : false,
                      wants_2nd_reg: e.target.checked ? formData.wants_2nd_reg : false
                    })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="is_encadrant" className="text-sm font-medium text-slate-200">
                    Je suis encadrant
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="wants_regulator"
                    checked={formData.wants_regulator}
                    onChange={(e) => setFormData({ ...formData, wants_regulator: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="wants_regulator" className="text-sm font-medium text-slate-200">
                    Je souhaite un détendeur
                  </label>
                </div>

                {formData.is_encadrant && (
                  <>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="wants_2nd_reg"
                        checked={formData.wants_2nd_reg}
                        onChange={(e) => setFormData({ ...formData, wants_2nd_reg: e.target.checked })}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <label htmlFor="wants_2nd_reg" className="text-sm font-medium text-slate-200">
                        Je souhaite un 2ème détendeur
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="wants_nitrox"
                        checked={formData.wants_nitrox}
                        onChange={(e) => setFormData({ ...formData, wants_nitrox: e.target.checked })}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <label htmlFor="wants_nitrox" className="text-sm font-medium text-slate-200">
                        Je souhaite plonger au nitrox
                      </label>
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Matériel</h3>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="wants_stab"
                    checked={formData.wants_stab}
                    onChange={(e) => setFormData({ ...formData, wants_stab: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="wants_stab" className="text-sm font-medium text-slate-200">
                    J'ai besoin d'une stab
                  </label>
                </div>

                {formData.wants_stab && (
                  <div>
                    <label htmlFor="stab_size" className="block text-sm font-medium text-slate-200 mb-1">
                      Taille de la stab
                    </label>
                    <select
                      id="stab_size"
                      value={formData.stab_size}
                      onChange={(e) => setFormData({ ...formData, stab_size: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      required
                    >
                      <option value="">Sélectionner une taille</option>
                      <option value="XS">XS</option>
                      <option value="S">S</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                      <option value="XL">XL</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">🗺️ Déplacement</h3>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="comes_from_issoire"
                    checked={formData.comes_from_issoire}
                    onChange={(e) => setFormData({ ...formData, comes_from_issoire: e.target.checked, has_car: e.target.checked ? formData.has_car : false, car_seats: e.target.checked ? formData.car_seats : '' })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="comes_from_issoire" className="text-sm font-medium text-slate-200">
                    Je pars d'Issoire
                  </label>
                </div>

                {formData.comes_from_issoire && (
                  <>
                    <div className="flex items-center space-x-2 ml-6">
                      <input
                        type="checkbox"
                        id="has_car"
                        checked={formData.has_car}
                        onChange={(e) => setFormData({ ...formData, has_car: e.target.checked })}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <label htmlFor="has_car" className="text-sm font-medium text-slate-200">
                        Je peux proposer du covoiturage
                      </label>
                    </div>

                    {formData.has_car && (
                      <div className="ml-12 bg-blue-50 border-2 border-blue-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-start space-x-2">
                          <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm text-blue-800 font-medium">
                            <strong>Important :</strong> Comptez-vous dans les places disponibles !
                          </p>
                        </div>
                        <Input
                          label="Nombre de places disponibles (vous inclus)"
                          type="number"
                          min="1"
                          value={formData.car_seats}
                          onChange={(e) => setFormData({ ...formData, car_seats: e.target.value })}
                          placeholder="Ex: 4 (dont vous-même)"
                        />
                        <p className="text-xs text-slate-300">
                          Par exemple, si vous avez 5 places dans votre voiture et vous êtes le conducteur, indiquez 5.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-1">
                  Commentaires (optionnel)
                </label>
                <textarea
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Informations supplémentaires..."
                />
              </div>

              <div className="flex justify-end space-x-4">
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? 'Envoi en cours...' : 'Soumettre'}
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-6 text-center text-sm text-slate-300">
          <p>Ce lien est personnel et ne doit pas être partagé.</p>
        </div>
      </div>

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

