import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  peopleApi,
  validationStagesApi, 
  skillValidationsApi,
  Person, 
  ValidationStage,
  CompetencyHierarchy,
} from '@/lib/api'
import Button from '@/components/Button'
import Toast from '@/components/Toast'

export default function StudentCompetencesPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  
  const [student, setStudent] = useState<Person | null>(null)
  const [stages, setStages] = useState<ValidationStage[]>([])
  const [progress, setProgress] = useState<CompetencyHierarchy | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  // État pour les modifications en cours
  const [pendingChanges, setPendingChanges] = useState<Map<string, { stageId: string; notes: string }>>(new Map())
  const [saving, setSaving] = useState(false)
  
  // Domaines/modules dépliés
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (studentId) {
      loadData()
    }
  }, [studentId])

  const loadData = async () => {
    if (!studentId) return
    
    try {
      setLoading(true)
      const [peopleRes, stagesRes] = await Promise.all([
        peopleApi.list(),
        validationStagesApi.list(),
      ])
      
      const foundStudent = peopleRes.data.find(p => p.id === studentId)
      if (!foundStudent) {
        setToast({ message: 'Élève non trouvé', type: 'error' })
        return
      }
      
      setStudent(foundStudent)
      setStages(stagesRes.data)
      
      // Charger la progression
      const level = foundStudent.preparing_level || foundStudent.diving_level_display
      if (level) {
        const progressRes = await skillValidationsApi.getPersonCompetencies(studentId, level)
        setProgress(progressRes.data)
        
        // Auto-expand tous les domaines
        const domainIds = new Set(progressRes.data.domains.map(d => d.id))
        setExpandedDomains(domainIds)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setToast({ message: 'Erreur lors du chargement', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const toggleDomain = (id: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleModule = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleStageChange = (skillId: string, stageId: string) => {
    setPendingChanges(prev => {
      const next = new Map(prev)
      const existing = next.get(skillId)
      if (stageId === '') {
        next.delete(skillId)
      } else {
        next.set(skillId, { stageId, notes: existing?.notes || '' })
      }
      return next
    })
  }

  const handleSaveAll = async () => {
    if (!student || pendingChanges.size === 0) return
    
    setSaving(true)
    try {
      // Sauvegarder toutes les modifications
      const promises = Array.from(pendingChanges.entries()).map(([skillId, { stageId, notes }]) =>
        skillValidationsApi.create({
          person_id: student.id,
          skill_id: skillId,
          stage_id: stageId,
          notes: notes || undefined,
        })
      )
      
      await Promise.all(promises)
      setPendingChanges(new Map())
      setToast({ message: `${promises.length} compétence(s) mise(s) à jour`, type: 'success' })
      
      // Recharger les données
      await loadData()
    } catch (error) {
      console.error('Error saving:', error)
      setToast({ message: 'Erreur lors de la sauvegarde', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleQuickValidate = async (skillId: string, stageId: string) => {
    if (!student) return
    
    try {
      await skillValidationsApi.create({
        person_id: student.id,
        skill_id: skillId,
        stage_id: stageId,
      })
      setToast({ message: 'Compétence mise à jour', type: 'success' })
      await loadData()
    } catch (error) {
      console.error('Error:', error)
      setToast({ message: 'Erreur', type: 'error' })
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-500">Chargement...</p>
      </div>
    )
  }

  if (!student || !progress) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Élève non trouvé</p>
        <Button onClick={() => navigate('/dashboard/competences')} className="mt-4">
          ← Retour
        </Button>
      </div>
    )
  }

  const level = student.preparing_level || student.diving_level_display || ''

  return (
    <div className="space-y-6">
      {/* Header avec navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="secondary" 
            onClick={() => navigate('/dashboard/competences')}
            className="flex items-center gap-2"
          >
            ← Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {student.first_name} {student.last_name}
            </h1>
            <p className="text-gray-500">
              Prépare le niveau <span className="font-semibold text-blue-600">{level}</span>
              {student.diving_level_display && student.diving_level_display !== level && (
                <span className="ml-2 text-gray-400">• Niveau actuel: {student.diving_level_display}</span>
              )}
            </p>
          </div>
        </div>
        
        {/* Bouton de sauvegarde groupée */}
        {pendingChanges.size > 0 && (
          <Button onClick={handleSaveAll} disabled={saving}>
            {saving ? 'Enregistrement...' : `💾 Enregistrer ${pendingChanges.size} modification(s)`}
          </Button>
        )}
      </div>

      {/* Progression globale */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl p-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium opacity-90">Progression globale</h2>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-4xl font-bold">
                {progress.domains.reduce((sum, d) => sum + d.progress.validated, 0)}
              </span>
              <span className="text-xl opacity-80">
                / {progress.domains.reduce((sum, d) => sum + d.progress.total, 0)} acquis validés
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold">
              {progress.domains.length > 0 
                ? Math.round(progress.domains.reduce((sum, d) => sum + d.progress.percentage, 0) / progress.domains.length)
                : 0}%
            </div>
          </div>
        </div>
        <div className="mt-4 bg-white/20 rounded-full h-3 overflow-hidden">
          <div 
            className="h-full bg-white transition-all duration-500"
            style={{ 
              width: `${progress.domains.length > 0 
                ? progress.domains.reduce((sum, d) => sum + d.progress.percentage, 0) / progress.domains.length
                : 0}%` 
            }}
          />
        </div>
      </div>

      {/* Légende des étapes */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Étapes de validation</h3>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <span className="w-3 h-3 rounded-full bg-gray-200"></span>
            Non commencé
          </div>
          {stages.map(stage => (
            <div key={stage.id} className="flex items-center gap-1.5 text-sm">
              <span 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: stage.color }}
              ></span>
              <span>{stage.icon} {stage.name}</span>
              {stage.is_final && <span className="text-xs text-green-600 font-medium">(final)</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Liste des compétences */}
      {progress.domains.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">Aucune compétence définie pour le niveau {level}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {progress.domains.map(domain => (
            <div key={domain.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Header du domaine */}
              <div 
                className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-cyan-50 cursor-pointer hover:from-blue-100 hover:to-cyan-100 transition-colors"
                onClick={() => toggleDomain(domain.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{expandedDomains.has(domain.id) ? '📂' : '📁'}</span>
                  <div>
                    <span className="font-bold text-gray-900">{domain.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-sm font-medium text-gray-700">
                      {domain.progress.validated}/{domain.progress.total}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">validés</span>
                  </div>
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${domain.progress.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-gray-600 w-12 text-right">
                    {Math.round(domain.progress.percentage)}%
                  </span>
                </div>
              </div>

              {/* Modules */}
              {expandedDomains.has(domain.id) && (
                <div className="border-t border-gray-100">
                  {domain.modules.map(module => (
                    <div key={module.id} className="border-b border-gray-50 last:border-b-0">
                      {/* Header du module */}
                      <div 
                        className="flex items-center justify-between p-3 pl-8 hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleModule(module.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span>{expandedModules.has(module.id) ? '📖' : '📕'}</span>
                          <span className="font-medium text-gray-800">{module.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">
                            {module.progress.validated}/{module.progress.total}
                          </span>
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500"
                              style={{ width: `${module.progress.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Skills */}
                      {expandedModules.has(module.id) && (
                        <div className="bg-gray-50 border-t border-gray-100">
                          {module.skills.map((skill, index) => {
                            const pending = pendingChanges.get(skill.id)
                            const currentStage = skill.validation
                            
                            return (
                              <div 
                                key={skill.id}
                                className="flex items-center justify-between p-3 pl-14 border-b border-gray-100 last:border-b-0 hover:bg-gray-100"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
                                    {index + 1}
                                  </span>
                                  <span className="text-sm text-gray-700">{skill.name}</span>
                                  <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">
                                    Min: {skill.min_validator_level}
                                  </span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {/* Statut actuel */}
                                  {currentStage && !pending && (
                                    <div className="flex items-center gap-2 mr-2">
                                      <span 
                                        className="px-2 py-1 text-xs rounded flex items-center gap-1"
                                        style={{ 
                                          backgroundColor: currentStage.stage_color + '20', 
                                          color: currentStage.stage_color 
                                        }}
                                      >
                                        {currentStage.stage_icon} {currentStage.stage_name}
                                      </span>
                                      <span className="text-xs text-gray-400">
                                        par {currentStage.validated_by_name}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {/* Sélecteur rapide d'étape */}
                                  <div className="flex gap-1">
                                    {stages.map(stage => {
                                      const isCurrentStage = currentStage?.stage_id === stage.id
                                      const isPending = pending?.stageId === stage.id
                                      
                                      return (
                                        <button
                                          key={stage.id}
                                          onClick={() => {
                                            if (pending) {
                                              // Annuler si on clique sur la même
                                              if (isPending) {
                                                handleStageChange(skill.id, '')
                                              } else {
                                                handleStageChange(skill.id, stage.id)
                                              }
                                            } else {
                                              // Validation directe
                                              handleQuickValidate(skill.id, stage.id)
                                            }
                                          }}
                                          className={`
                                            w-8 h-8 rounded-full flex items-center justify-center text-sm
                                            transition-all transform hover:scale-110
                                            ${isCurrentStage 
                                              ? 'ring-2 ring-offset-2' 
                                              : isPending
                                                ? 'ring-2 ring-offset-1 ring-blue-500 scale-110'
                                                : 'opacity-40 hover:opacity-100'
                                            }
                                          `}
                                          style={{ 
                                            backgroundColor: stage.color + '30',
                                            color: stage.color,
                                            borderColor: stage.color
                                          }}
                                          title={`${stage.name}${isCurrentStage ? ' (actuel)' : ''}`}
                                        >
                                          {stage.icon}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}

