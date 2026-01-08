import React, { useState, useEffect } from 'react'
import Modal from './Modal'
import Input from './Input'
import Button from './Button'
import { QuestionnaireDetail } from '../lib/api'

interface EditQuestionnaireModalProps {
  isOpen: boolean
  onClose: () => void
  questionnaire: QuestionnaireDetail | null
  onSave: (id: string, data: any) => Promise<void>
}

export default function EditQuestionnaireModal({
  isOpen,
  onClose,
  questionnaire,
  onSave,
}: EditQuestionnaireModalProps) {
  const [formData, setFormData] = useState({
    wants_regulator: false,
    wants_nitrox: false,
    wants_2nd_reg: false,
    wants_stab: false,
    stab_size: '',
    nitrox_training: false,
    comes_from_issoire: true,
    has_car: false,
    car_seats: '',
    comments: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (questionnaire) {
      setFormData({
        wants_regulator: questionnaire.wants_regulator,
        wants_nitrox: questionnaire.wants_nitrox,
        wants_2nd_reg: questionnaire.wants_2nd_reg,
        wants_stab: questionnaire.wants_stab,
        stab_size: questionnaire.stab_size || '',
        nitrox_training: questionnaire.nitrox_training,
        comes_from_issoire: questionnaire.comes_from_issoire,
        has_car: questionnaire.has_car,
        car_seats: questionnaire.car_seats?.toString() || '',
        comments: questionnaire.comments || '',
      })
    }
  }, [questionnaire])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!questionnaire) return

    setLoading(true)
    try {
      await onSave(questionnaire.id, {
        wants_regulator: formData.wants_regulator,
        wants_nitrox: formData.wants_nitrox,
        wants_2nd_reg: formData.wants_2nd_reg,
        wants_stab: formData.wants_stab,
        stab_size: formData.wants_stab && formData.stab_size ? formData.stab_size : undefined,
        nitrox_training: formData.nitrox_training,
        comes_from_issoire: formData.comes_from_issoire,
        has_car: formData.has_car,
        car_seats: formData.has_car && formData.car_seats ? parseInt(formData.car_seats) : undefined,
        comments: formData.comments || undefined,
      })
      onClose()
    } catch (error) {
      console.error('Erreur lors de la modification:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!questionnaire) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Modifier - ${questionnaire.first_name} ${questionnaire.last_name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-sm text-slate-300">Email: {questionnaire.email}</p>
        </div>

        <div className="space-y-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.wants_regulator}
              onChange={(e) => setFormData({ ...formData, wants_regulator: e.target.checked })}
              className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-200">Souhaite un détendeur</span>
          </label>

          {questionnaire.is_encadrant && (
            <>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.wants_2nd_reg}
                  onChange={(e) => setFormData({ ...formData, wants_2nd_reg: e.target.checked })}
                  className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-200">Souhaite 2ème détendeur</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.wants_nitrox}
                  onChange={(e) => setFormData({ ...formData, wants_nitrox: e.target.checked })}
                  className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-200">Souhaite Nitrox</span>
              </label>
            </>
          )}

          {!questionnaire.is_encadrant && (
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.nitrox_training}
                onChange={(e) => setFormData({ ...formData, nitrox_training: e.target.checked })}
                className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-200">🎓 Formation Nitrox (bloc nitrox)</span>
            </label>
          )}

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.wants_stab}
              onChange={(e) => setFormData({ ...formData, wants_stab: e.target.checked })}
              className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-200">Souhaite stab</span>
          </label>

          {formData.wants_stab && (
            <div className="ml-6">
              <label className="block text-sm font-medium text-slate-200 mb-1">
                Taille stab
              </label>
              <select
                value={formData.stab_size}
                onChange={(e) => setFormData({ ...formData, stab_size: e.target.value })}
                className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-slate-200 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner</option>
                <option value="XS">XS</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
              </select>
            </div>
          )}

          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.comes_from_issoire}
              onChange={(e) => setFormData({ ...formData, comes_from_issoire: e.target.checked, has_car: e.target.checked ? formData.has_car : false })}
              className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-200">🗺️ Vient d'Issoire</span>
          </label>

          {formData.comes_from_issoire && (
            <>
              <label className="flex items-center space-x-2 ml-6 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.has_car}
                  onChange={(e) => setFormData({ ...formData, has_car: e.target.checked })}
                  className="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-200">🚗 A une voiture</span>
              </label>

              {formData.has_car && (
                <div className="ml-12 bg-blue-900/30 border border-blue-700 rounded-lg p-3 space-y-2">
                  <div className="flex items-start space-x-2 mb-2">
                    <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-blue-300">
                      <strong>Important :</strong> La personne doit se compter dans les places
                    </p>
                  </div>
                  <Input
                    label="Nombre de places disponibles (conducteur inclus)"
                    type="number"
                    min="1"
                    value={formData.car_seats}
                    onChange={(e) => setFormData({ ...formData, car_seats: e.target.value })}
                    required={formData.has_car}
                    placeholder="Ex: 4"
                  />
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-200 mb-1">
              Commentaires
            </label>
            <textarea
              value={formData.comments}
              onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-700 text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

