import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  peopleApi,
  validationStagesApi, 
  skillValidationsApi,
  sessionsApi,
  questionnairesApi,
  Person, 
  ValidationStage,
  CompetencyHierarchy,
  Session,
} from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import Button from '@/components/Button'
import Toast from '@/components/Toast'
import Modal from '@/components/Modal'

interface StudentStats {
  totalSessions: number
  attendedSessions: number
  lastSessionDate: string | null
  lastSessionName: string | null
}

export default function StudentCompetencesPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  
  // Auth state - only real admins (not impersonating) can go backwards
  const { isAdmin, impersonating } = useAuthStore()
  const isRealAdmin = isAdmin && !impersonating
  
  const [student, setStudent] = useState<Person | null>(null)
  const [stages, setStages] = useState<ValidationStage[]>([])
  const [progress, setProgress] = useState<CompetencyHierarchy | null>(null)
  const [studentStats, setStudentStats] = useState<StudentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  // État pour les modifications en cours
  const [pendingChanges, setPendingChanges] = useState<Map<string, { stageId: string; notes: string }>>(new Map())
  const [saving, setSaving] = useState(false)
  
  // Domaines/modules dépliés
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    skillId: string
    skillName: string
    stageId: string
    stageName: string
  } | null>(null)

  useEffect(() => {
    if (studentId) {
      loadData()
    }
  }, [studentId])

  const loadData = async () => {
    if (!studentId) return
    
    try {
      setLoading(true)
      const [peopleRes, stagesRes, sessionsRes] = await Promise.all([
        peopleApi.list(),
        validationStagesApi.list(),
        sessionsApi.list(),
      ])
      
      const foundStudent = peopleRes.data.find(p => p.id === studentId)
      if (!foundStudent) {
        setToast({ message: 'Élève non trouvé', type: 'error' })
        return
      }
      
      setStudent(foundStudent)
      setStages(stagesRes.data)
      
      // Charger les stats de participation aux fosses
      const sessions = sessionsRes.data.sort((a, b) => 
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
      )
      
      let attendedCount = 0
      let lastAttendedSession: Session | null = null
      
      for (const session of sessions) {
        try {
          const questRes = await questionnairesApi.list(session.id)
          const hasAttended = questRes.data.some(q => q.person_id === studentId)
          if (hasAttended) {
            attendedCount++
            if (!lastAttendedSession) {
              lastAttendedSession = session
            }
          }
        } catch {
          // Ignorer les erreurs
        }
      }
      
      setStudentStats({
        totalSessions: sessions.length,
        attendedSessions: attendedCount,
        lastSessionDate: lastAttendedSession?.start_date || null,
        lastSessionName: lastAttendedSession?.name || null,
      })
      
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

  // Get current stage sort order for a skill
  const getCurrentStageSortOrder = (skillId: string): number => {
    if (!progress) return -1
    for (const domain of progress.domains) {
      for (const module of domain.modules) {
        const skill = module.skills.find(s => s.id === skillId)
        if (skill?.validation) {
          const currentStage = stages.find(s => s.id === skill.validation!.stage_id)
          return currentStage?.sort_order ?? -1
        }
      }
    }
    return -1
  }

  // Check if we can move to a specific stage (only forward, unless real admin)
  const canMoveToStage = (skillId: string, targetStage: ValidationStage): boolean => {
    if (isRealAdmin) return true // Real admins can do anything
    const currentSortOrder = getCurrentStageSortOrder(skillId)
    return targetStage.sort_order >= currentSortOrder
  }

  // Show confirmation before validation
  const requestValidation = (skillId: string, skillName: string, stageId: string) => {
    const stage = stages.find(s => s.id === stageId)
    if (!stage) return
    
    setConfirmDialog({
      skillId,
      skillName,
      stageId,
      stageName: stage.name
    })
  }

  // Execute the validation after confirmation
  const confirmValidation = async () => {
    if (!confirmDialog || !student) return
    
    try {
      await skillValidationsApi.create({
        person_id: student.id,
        skill_id: confirmDialog.skillId,
        stage_id: confirmDialog.stageId,
      })
      setToast({ message: 'Compétence mise à jour', type: 'success' })
      setConfirmDialog(null)
      await loadData()
    } catch (error: unknown) {
      console.error('Error:', error)
      const message = error instanceof Error ? error.message : 'Erreur lors de la validation'
      setToast({ message, type: 'error' })
      setConfirmDialog(null)
    }
  }

  const handleQuickValidate = async (skillId: string, skillName: string, stageId: string) => {
    if (!student) return
    
    // Check if we can move to this stage
    const targetStage = stages.find(s => s.id === stageId)
    if (!targetStage) return
    
    if (!canMoveToStage(skillId, targetStage)) {
      setToast({ 
        message: 'Vous ne pouvez pas revenir en arrière sur une étape de validation', 
        type: 'error' 
      })
      return
    }
    
    // Show confirmation dialog
    requestValidation(skillId, skillName, stageId)
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

      {/* Statistiques de l'élève */}
      {studentStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow p-4 border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <span className="text-2xl">🏊</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{studentStats.attendedSessions}</div>
                <div className="text-sm text-gray-500">Fosses effectuées</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {progress?.domains.reduce((sum, d) => sum + d.progress.validated, 0) || 0}
                </div>
                <div className="text-sm text-gray-500">Compétences validées</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow p-4 border-l-4 border-amber-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <span className="text-2xl">🔄</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {progress?.domains.reduce((sum, d) => sum + d.progress.in_progress, 0) || 0}
                </div>
                <div className="text-sm text-gray-500">En cours</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow p-4 border-l-4 border-purple-500">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <span className="text-2xl">📅</span>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900 truncate" title={studentStats.lastSessionName || undefined}>
                  {studentStats.lastSessionName || 'Aucune'}
                </div>
                <div className="text-sm text-gray-500">
                  {studentStats.lastSessionDate 
                    ? new Date(studentStats.lastSessionDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Dernière fosse'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                                      const canSelect = canMoveToStage(skill.id, stage)
                                      
                                      return (
                                        <button
                                          key={stage.id}
                                          disabled={!canSelect}
                                          onClick={() => {
                                            if (!canSelect) return
                                            if (pending) {
                                              // Annuler si on clique sur la même
                                              if (isPending) {
                                                handleStageChange(skill.id, '')
                                              } else {
                                                handleStageChange(skill.id, stage.id)
                                              }
                                            } else {
                                              // Validation directe avec confirmation
                                              handleQuickValidate(skill.id, skill.name, stage.id)
                                            }
                                          }}
                                          className={`
                                            w-8 h-8 rounded-full flex items-center justify-center text-sm
                                            transition-all transform
                                            ${!canSelect 
                                              ? 'opacity-20 cursor-not-allowed' 
                                              : 'hover:scale-110'
                                            }
                                            ${isCurrentStage 
                                              ? 'ring-2 ring-offset-2' 
                                              : isPending
                                                ? 'ring-2 ring-offset-1 ring-blue-500 scale-110'
                                                : canSelect ? 'opacity-40 hover:opacity-100' : ''
                                            }
                                          `}
                                          style={{ 
                                            backgroundColor: stage.color + '30',
                                            color: stage.color,
                                            borderColor: stage.color
                                          }}
                                          title={`${stage.name}${isCurrentStage ? ' (actuel)' : ''}${!canSelect ? ' - Non accessible' : ''}`}
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

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <Modal
          isOpen={true}
          onClose={() => setConfirmDialog(null)}
          title="⚠️ Confirmation de validation"
        >
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-amber-800 font-medium">
                ⚠️ Attention : cette action est irréversible !
              </p>
              <p className="text-amber-700 text-sm mt-1">
                {isRealAdmin 
                  ? "En tant qu'administrateur, vous pouvez modifier ce choix plus tard."
                  : "Une fois validée, vous ne pourrez plus revenir en arrière sur cette étape."}
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-600">
                Vous êtes sur le point de valider :
              </p>
              <p className="font-semibold text-gray-900 mt-2">
                📋 {confirmDialog.skillName}
              </p>
              <p className="text-gray-600 mt-2">
                Vers l'étape :
              </p>
              <p className="font-semibold text-blue-600 mt-1">
                ✓ {confirmDialog.stageName}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="secondary"
                onClick={() => setConfirmDialog(null)}
              >
                Annuler
              </Button>
              <Button
                onClick={confirmValidation}
              >
                Oui, valider
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

