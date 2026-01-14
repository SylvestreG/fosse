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
    } catch (error: any) {
      console.error('Error saving:', error)
      // Extraire le message d'erreur du backend
      const message = error.response?.data?.error || error.message || 'Erreur lors de la sauvegarde'
      setToast({ message, type: 'error' })
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
    } catch (error: any) {
      console.error('Error:', error)
      // Extraire le message d'erreur du backend
      const message = error.response?.data?.error || error.message || 'Erreur lors de la validation'
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

  // Supprimer une validation (admin uniquement)
  const handleDeleteValidation = async (validationId: string, skillName: string) => {
    if (!isRealAdmin) return
    
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la validation de "${skillName}" ?\n\nCette action est irréversible.`)) {
      return
    }
    
    try {
      await skillValidationsApi.delete(validationId)
      setToast({ message: 'Validation supprimée', type: 'success' })
      await loadData()
    } catch (error: any) {
      console.error('Error deleting validation:', error)
      const message = error.response?.data?.error || 'Erreur lors de la suppression'
      setToast({ message, type: 'error' })
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto"></div>
        <p className="mt-2 text-slate-400">Chargement...</p>
      </div>
    )
  }

  if (!student || !progress) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Élève non trouvé</p>
        <Button onClick={() => navigate('/dashboard/competences')} className="mt-4">
          ← Retour
        </Button>
      </div>
    )
  }

  const level = student.preparing_level || student.diving_level_display || ''

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header avec navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button 
            variant="secondary" 
            onClick={() => navigate('/dashboard/competences')}
            className="flex items-center gap-1 sm:gap-2 text-sm sm:text-base px-2 sm:px-4"
          >
            ← <span className="hidden sm:inline">Retour</span>
          </Button>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-white">
              {student.first_name} {student.last_name}
            </h1>
            <p className="text-slate-400 text-xs sm:text-base">
              Prépare <span className="font-semibold text-cyan-400">{level}</span>
              {student.diving_level_display && student.diving_level_display !== level && (
                <span className="ml-1 sm:ml-2 text-slate-500">• Actuel: {student.diving_level_display}</span>
              )}
            </p>
          </div>
        </div>
        
        {/* Bouton de sauvegarde groupée */}
        {pendingChanges.size > 0 && (
          <Button onClick={handleSaveAll} disabled={saving} className="text-sm sm:text-base">
            {saving ? '...' : `💾 ${pendingChanges.size} modif.`}
          </Button>
        )}
      </div>

      {/* Statistiques de l'élève */}
      {studentStats && (
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg sm:rounded-xl shadow p-2 sm:p-4 border-l-4 border-cyan-500">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-cyan-500/20 rounded-lg">
                <span className="text-lg sm:text-2xl">🏊</span>
              </div>
              <div>
                <div className="text-lg sm:text-2xl font-bold text-white">{studentStats.attendedSessions}</div>
                <div className="text-xs sm:text-sm text-slate-400">Fosses</div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg sm:rounded-xl shadow p-2 sm:p-4 border-l-4 border-green-500">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-green-500/20 rounded-lg">
                <span className="text-lg sm:text-2xl">✅</span>
              </div>
              <div>
                <div className="text-lg sm:text-2xl font-bold text-white">
                  {progress?.domains.reduce((sum, d) => sum + d.progress.validated, 0) || 0}
                </div>
                <div className="text-xs sm:text-sm text-slate-400">Validées</div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg sm:rounded-xl shadow p-2 sm:p-4 border-l-4 border-amber-500">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-amber-500/20 rounded-lg">
                <span className="text-lg sm:text-2xl">🔄</span>
              </div>
              <div>
                <div className="text-lg sm:text-2xl font-bold text-white">
                  {progress?.domains.reduce((sum, d) => sum + d.progress.in_progress, 0) || 0}
                </div>
                <div className="text-xs sm:text-sm text-slate-400">En cours</div>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg sm:rounded-xl shadow p-2 sm:p-4 border-l-4 border-purple-500">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-purple-500/20 rounded-lg">
                <span className="text-lg sm:text-2xl">📅</span>
              </div>
              <div className="min-w-0">
                <div className="text-xs sm:text-sm font-medium text-white truncate" title={studentStats.lastSessionName || undefined}>
                  {studentStats.lastSessionName || 'Aucune'}
                </div>
                <div className="text-xs sm:text-sm text-slate-400">
                  {studentStats.lastSessionDate 
                    ? new Date(studentStats.lastSessionDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                    : 'Dernière fosse'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progression globale */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg sm:rounded-xl p-4 sm:p-6 text-white">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm sm:text-lg font-medium opacity-90">Progression globale</h2>
            <div className="flex items-baseline gap-1 sm:gap-3 mt-1">
              <span className="text-2xl sm:text-4xl font-bold">
                {progress.domains.reduce((sum, d) => sum + d.progress.validated, 0)}
              </span>
              <span className="text-sm sm:text-xl opacity-80">
                / {progress.domains.reduce((sum, d) => sum + d.progress.total, 0)} validés
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl sm:text-5xl font-bold">
              {progress.domains.length > 0 
                ? Math.round(progress.domains.reduce((sum, d) => sum + d.progress.percentage, 0) / progress.domains.length)
                : 0}%
            </div>
          </div>
        </div>
        <div className="mt-3 sm:mt-4 bg-white/20 rounded-full h-2 sm:h-3 overflow-hidden">
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

      {/* Légende des étapes - toujours visible */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-3 sm:p-4 border border-slate-700">
        <h3 className="text-xs sm:text-sm font-medium text-slate-200 mb-2 sm:mb-3">Étapes de validation</h3>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <div className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-slate-400">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-slate-600"></span>
            Non commencé
          </div>
          {stages.map(stage => (
            <div key={stage.id} className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-slate-300">
              <span 
                className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full"
                style={{ backgroundColor: stage.color }}
              ></span>
              <span>{stage.icon} {stage.name}</span>
              {stage.is_final && <span className="text-xs text-green-400 font-medium">(✓)</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Liste des compétences */}
      {progress.domains.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 sm:p-8 text-center">
          <p className="text-slate-400 text-sm sm:text-base">Aucune compétence définie pour le niveau {level}</p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {progress.domains.map(domain => (
            <div key={domain.id} className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow overflow-hidden">
              {/* Header du domaine */}
              <div 
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gradient-to-r from-slate-700/50 to-slate-700/30 cursor-pointer hover:from-slate-700/70 hover:to-slate-700/50 transition-colors gap-2"
                onClick={() => toggleDomain(domain.id)}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-lg sm:text-xl">{expandedDomains.has(domain.id) ? '📂' : '📁'}</span>
                  <span className="font-bold text-amber-400 text-sm sm:text-base">{domain.name}</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 ml-7 sm:ml-0">
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs sm:text-sm font-medium text-slate-200">
                      {domain.progress.validated}/{domain.progress.total}
                    </span>
                  </div>
                  <div className="w-16 sm:w-24 h-1.5 sm:h-2 bg-slate-600 rounded-full overflow-hidden flex-shrink-0">
                    <div 
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${domain.progress.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-slate-300 w-10 sm:w-12 text-right">
                    {Math.round(domain.progress.percentage)}%
                  </span>
                </div>
              </div>

              {/* Modules */}
              {expandedDomains.has(domain.id) && (
                <div className="border-t border-slate-700">
                  {domain.modules.map(module => (
                    <div key={module.id} className="border-b border-slate-700/50 last:border-b-0">
                      {/* Header du module */}
                      <div 
                        className="flex items-center justify-between p-2 sm:p-3 pl-6 sm:pl-8 hover:bg-slate-700/30 cursor-pointer"
                        onClick={() => toggleModule(module.id)}
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="text-sm sm:text-base">{expandedModules.has(module.id) ? '📖' : '📕'}</span>
                          <span className="font-medium text-cyan-300 text-xs sm:text-base">{module.name}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-xs text-slate-400">
                            {module.progress.validated}/{module.progress.total}
                          </span>
                          <div className="w-12 sm:w-16 h-1 sm:h-1.5 bg-slate-600 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-green-500"
                              style={{ width: `${module.progress.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Skills */}
                      {expandedModules.has(module.id) && (
                        <div className="bg-slate-700/30 border-t border-slate-700">
                          {module.skills.map((skill, index) => {
                            const pending = pendingChanges.get(skill.id)
                            const currentStage = skill.validation
                            
                            return (
                              <div 
                                key={skill.id}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-2 sm:p-3 pl-8 sm:pl-14 border-b border-slate-700/50 last:border-b-0 hover:bg-slate-700/50 gap-2"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start sm:items-center gap-2 sm:gap-3">
                                    <span className="w-5 h-5 sm:w-6 sm:h-6 bg-cyan-500/20 text-cyan-300 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                                      {index + 1}
                                    </span>
                                    <span className="text-xs sm:text-sm text-slate-200">{skill.name}</span>
                                    <span className="text-xs text-slate-400 bg-slate-700/50 px-1 sm:px-1.5 py-0.5 rounded hidden sm:inline">
                                      Min: {skill.min_validator_level}
                                    </span>
                                  </div>
                                  {skill.description && (
                                    <p className="text-xs text-amber-400/80 ml-7 sm:ml-8 mt-1 italic">
                                      💡 {skill.description}
                                    </p>
                                  )}
                                </div>
                                
                                <div className="flex items-center gap-2 ml-7 sm:ml-0 flex-wrap sm:flex-nowrap">
                                  {/* Statut actuel - toujours visible */}
                                  {currentStage && !pending && (
                                    <div className="flex items-center gap-1 sm:gap-2 sm:mr-2">
                                      <span 
                                        className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded flex items-center gap-1 font-medium border"
                                        style={{ 
                                          backgroundColor: currentStage.stage_color + '20', 
                                          color: currentStage.stage_color,
                                          borderColor: currentStage.stage_color + '40'
                                        }}
                                      >
                                        {currentStage.stage_icon} {currentStage.stage_name}
                                      </span>
                                      <span className="text-[10px] sm:text-xs text-slate-500 hidden sm:inline">
                                        par {currentStage.validated_by_name}
                                      </span>
                                    </div>
                                  )}
                                  
                                  {/* Sélecteur rapide d'étape - avec labels visibles */}
                                  <div className="flex flex-wrap gap-1 sm:gap-1.5">
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
                                            px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] sm:text-xs font-medium
                                            transition-all transform border
                                            ${!canSelect 
                                              ? 'opacity-20 cursor-not-allowed' 
                                              : 'hover:scale-105 active:scale-95'
                                            }
                                            ${isCurrentStage 
                                              ? 'ring-2 ring-offset-1 ring-white/50' 
                                              : isPending
                                                ? 'ring-2 ring-offset-1 ring-blue-500 scale-105'
                                                : canSelect ? 'opacity-60 hover:opacity-100' : ''
                                            }
                                          `}
                                          style={{ 
                                            backgroundColor: stage.color + '25',
                                            color: stage.color,
                                            borderColor: stage.color + '50'
                                          }}
                                          title={`${stage.name}${isCurrentStage ? ' (actuel)' : ''}${!canSelect ? ' - Non accessible' : ''}`}
                                        >
                                          <span>{stage.icon}</span>
                                          <span className="hidden min-[400px]:inline">{stage.name}</span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                  
                                  {/* Bouton de suppression (admin uniquement) */}
                                  {isRealAdmin && currentStage && (
                                    <button
                                      onClick={() => handleDeleteValidation(currentStage.id, skill.name)}
                                      className="ml-1 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300 transition-all"
                                      title="Supprimer cette validation"
                                    >
                                      🗑️
                                    </button>
                                  )}
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
            <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-4">
              <p className="text-amber-300 font-medium">
                ⚠️ Attention : cette action est irréversible !
              </p>
              <p className="text-amber-400/80 text-sm mt-1">
                {isRealAdmin 
                  ? "En tant qu'administrateur, vous pouvez modifier ce choix plus tard."
                  : "Une fois validée, vous ne pourrez plus revenir en arrière sur cette étape."}
              </p>
            </div>
            
            <div className="bg-slate-700/30 rounded-lg p-4">
              <p className="text-slate-300">
                Vous êtes sur le point de valider :
              </p>
              <p className="font-semibold text-white mt-2">
                📋 {confirmDialog.skillName}
              </p>
              <p className="text-slate-300 mt-2">
                Vers l'étape :
              </p>
              <p className="font-semibold text-cyan-400 mt-1">
                ✓ {confirmDialog.stageName}
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
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

