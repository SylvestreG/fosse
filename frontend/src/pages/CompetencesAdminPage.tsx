import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  peopleApi, 
  validationStagesApi, 
  competencyDomainsApi, 
  competencyModulesApi, 
  competencySkillsApi,
  sessionsApi,
  questionnairesApi,
  skillValidationsApi,
  Person, 
  ValidationStage,
  CompetencyDomain,
  CompetencyModule,
  CompetencySkill,
  Session,
  ValidationLogEntry,
} from '@/lib/api'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import Toast from '@/components/Toast'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts'

// Ordre des niveaux - limité à N1, N2, N3 pour l'instant
const LEVEL_ORDER = ['N1', 'N2', 'N3']
const MIN_VALIDATOR_LEVELS = ['E2', 'E3', 'E4', 'N4', 'E1', 'N3']

// Noms complets des niveaux
const LEVEL_NAMES: Record<string, string> = {
  N1: 'Niveau 1 - Plongeur Encadré',
  N2: 'Niveau 2 - Plongeur Autonome 20m',
  N3: 'Niveau 3 - Plongeur Autonome 60m',
  N4: 'Niveau 4 - Guide de Palanquée',
  N5: 'Niveau 5 - Directeur de Plongée',
  E2: 'E2 - Encadrant Niveau 2',
  E3: 'E3 - Encadrant niveau 3',
  E4: 'E4 - Encadrant niveau 4',
}

type ManageMode = 'hierarchy' | 'stages' | 'students' | 'stats'

export default function CompetencesAdminPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('N2')
  const [manageMode, setManageMode] = useState<ManageMode>('hierarchy')
  const [people, setPeople] = useState<Person[]>([])
  const [stages, setStages] = useState<ValidationStage[]>([])
  const [domains, setDomains] = useState<CompetencyDomain[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  // État des branches ouvertes (remonté ici pour persister lors des refresh)
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  
  // Modals
  const [showStageModal, setShowStageModal] = useState(false)
  const [editingStage, setEditingStage] = useState<ValidationStage | null>(null)
  const [showDomainModal, setShowDomainModal] = useState(false)
  const [editingDomain, setEditingDomain] = useState<CompetencyDomain | null>(null)
  const [showModuleModal, setShowModuleModal] = useState(false)
  const [editingModule, setEditingModule] = useState<CompetencyModule | null>(null)
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null)
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [editingSkill, setEditingSkill] = useState<CompetencySkill | null>(null)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)

  useEffect(() => {
    loadData(true)
  }, [activeTab])

  const loadData = async (isInitial = false) => {
    try {
      if (isInitial) setInitialLoading(true)
      const [peopleRes, stagesRes, domainsRes] = await Promise.all([
        peopleApi.list(),
        validationStagesApi.list(),
        competencyDomainsApi.list(activeTab, true),
      ])
      setPeople(peopleRes.data)
      setStages(stagesRes.data)
      
      // Load modules with skills for each domain
      const domainsWithModules = await Promise.all(
        domainsRes.data.map(async (domain) => {
          const modulesRes = await competencyModulesApi.list(domain.id, true)
          return { ...domain, modules: modulesRes.data }
        })
      )
      setDomains(domainsWithModules)
    } catch (error) {
      console.error('Error loading data:', error)
      setToast({ message: 'Erreur lors du chargement des données', type: 'error' })
    } finally {
      if (isInitial) setInitialLoading(false)
    }
  }

  // Filtrer les élèves qui préparent un niveau donné
  const getStudentsPreparingLevel = (level: string) => {
    return people.filter(p => p.preparing_level === level)
  }

  const getStudentCountByLevel = (level: string) => {
    return getStudentsPreparingLevel(level).length
  }

  // Stage handlers
  const handleDeleteStage = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette étape ?')) return
    try {
      await validationStagesApi.delete(id)
      setToast({ message: 'Étape supprimée', type: 'success' })
      loadData()
    } catch (error) {
      setToast({ message: 'Erreur lors de la suppression', type: 'error' })
    }
  }

  // Domain handlers
  const handleDeleteDomain = async (id: string) => {
    if (!confirm('Supprimer ce domaine et tous ses modules/acquis ?')) return
    try {
      await competencyDomainsApi.delete(id)
      setToast({ message: 'Domaine supprimé', type: 'success' })
      loadData()
    } catch (error) {
      setToast({ message: 'Erreur lors de la suppression', type: 'error' })
    }
  }

  // Module handlers
  const handleDeleteModule = async (id: string) => {
    if (!confirm('Supprimer ce module et tous ses acquis ?')) return
    try {
      await competencyModulesApi.delete(id)
      setToast({ message: 'Module supprimé', type: 'success' })
      loadData()
    } catch (error) {
      setToast({ message: 'Erreur lors de la suppression', type: 'error' })
    }
  }

  // Skill handlers
  const handleDeleteSkill = async (id: string) => {
    if (!confirm('Supprimer cet acquis ?')) return
    try {
      await competencySkillsApi.delete(id)
      setToast({ message: 'Acquis supprimé', type: 'success' })
      loadData()
    } catch (error) {
      setToast({ message: 'Erreur lors de la suppression', type: 'error' })
    }
  }

  if (initialLoading) {
    return <div className="text-center py-12 theme-text">Chargement...</div>
  }

  const studentsForCurrentLevel = getStudentsPreparingLevel(activeTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold theme-text">🎯 Gestion des Compétences</h1>
          <p className="theme-text-secondary mt-1">Administration des domaines, modules et acquis</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={manageMode === 'hierarchy' ? 'primary' : 'secondary'}
            onClick={() => setManageMode('hierarchy')}
          >
            📚 Hiérarchie
          </Button>
          <Button
            variant={manageMode === 'stages' ? 'primary' : 'secondary'}
            onClick={() => setManageMode('stages')}
          >
            🔄 Étapes
          </Button>
          <Button
            variant={manageMode === 'students' ? 'primary' : 'secondary'}
            onClick={() => setManageMode('students')}
          >
            👨‍🎓 Élèves
          </Button>
          <Button
            variant={manageMode === 'stats' ? 'primary' : 'secondary'}
            onClick={() => setManageMode('stats')}
          >
            📊 Statistiques
          </Button>
        </div>
      </div>

      {/* Tabs pour les niveaux */}
      <div className="border-b theme-border">
        <nav className="-mb-px flex space-x-1 overflow-x-auto pb-px">
          {LEVEL_ORDER.map((level) => {
            const studentCount = getStudentCountByLevel(level)
            const domainCount = domains.filter(d => d.diving_level === level).length
            return (
              <button
                key={level}
                onClick={() => setActiveTab(level)}
                className={`
                  whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm transition-colors
                  flex items-center gap-2
                  ${activeTab === level
                    ? 'border-cyan-500 text-cyan-400 bg-cyan-500/10'
                    : 'border-transparent theme-text-muted hover:theme-text-secondary'
                  }
                `}
              >
                {level}
                {activeTab === level && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {domainCount} dom.
                  </span>
                )}
                {studentCount > 0 && (
                  <span className={`px-1.5 py-0.5 text-xs rounded-full ${activeTab === level ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-500/10 text-amber-400'}`}>
                    👨‍🎓 {studentCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Content based on mode */}
      {manageMode === 'stages' && (
        <ValidationStagesSection
          stages={stages}
          onAdd={() => { setEditingStage(null); setShowStageModal(true) }}
          onEdit={(stage) => { setEditingStage(stage); setShowStageModal(true) }}
          onDelete={handleDeleteStage}
        />
      )}

      {manageMode === 'hierarchy' && (
        <HierarchySection
          level={activeTab}
          domains={domains}
          expandedDomains={expandedDomains}
          setExpandedDomains={setExpandedDomains}
          expandedModules={expandedModules}
          setExpandedModules={setExpandedModules}
          onAddDomain={() => { setEditingDomain(null); setShowDomainModal(true) }}
          onEditDomain={(domain) => { setEditingDomain(domain); setShowDomainModal(true) }}
          onDeleteDomain={handleDeleteDomain}
          onAddModule={(domainId) => { 
            setSelectedDomainId(domainId); 
            setEditingModule(null); 
            setShowModuleModal(true);
            // Auto-expand le domaine parent
            setExpandedDomains(prev => new Set([...prev, domainId]));
          }}
          onEditModule={(module) => { setSelectedDomainId(module.domain_id); setEditingModule(module); setShowModuleModal(true) }}
          onDeleteModule={handleDeleteModule}
          onAddSkill={(moduleId, domainId) => { 
            setSelectedModuleId(moduleId); 
            setEditingSkill(null); 
            setShowSkillModal(true);
            // Auto-expand le module et domaine parents
            setExpandedDomains(prev => new Set([...prev, domainId]));
            setExpandedModules(prev => new Set([...prev, moduleId]));
          }}
          onEditSkill={(skill) => { setSelectedModuleId(skill.module_id); setEditingSkill(skill); setShowSkillModal(true) }}
          onDeleteSkill={handleDeleteSkill}
        />
      )}

      {manageMode === 'students' && (
        <StudentsSection
          level={activeTab}
          students={studentsForCurrentLevel}
          onViewProgress={(student) => navigate(`/dashboard/competences/student/${student.id}`)}
        />
      )}

      {manageMode === 'stats' && (
        <StatisticsSection
          people={people}
          stages={stages}
        />
      )}

      {/* Modals */}
      {showStageModal && (
        <StageModal
          stage={editingStage}
          onClose={() => setShowStageModal(false)}
          onSuccess={() => { setShowStageModal(false); loadData(); setToast({ message: 'Étape enregistrée', type: 'success' }) }}
        />
      )}

      {showDomainModal && (
        <DomainModal
          domain={editingDomain}
          defaultLevel={activeTab}
          onClose={() => setShowDomainModal(false)}
          onSuccess={(newDomainId) => { 
            setShowDomainModal(false); 
            // Auto-expand le nouveau domaine
            if (newDomainId) setExpandedDomains(prev => new Set([...prev, newDomainId]));
            loadData(); 
            setToast({ message: 'Domaine enregistré', type: 'success' }); 
          }}
        />
      )}

      {showModuleModal && selectedDomainId && (
        <ModuleModal
          module={editingModule}
          domainId={selectedDomainId}
          onClose={() => setShowModuleModal(false)}
          onSuccess={(newModuleId) => { 
            setShowModuleModal(false); 
            // Auto-expand le nouveau module
            if (newModuleId) setExpandedModules(prev => new Set([...prev, newModuleId]));
            loadData(); 
            setToast({ message: 'Module enregistré', type: 'success' }); 
          }}
        />
      )}

      {showSkillModal && selectedModuleId && (
        <SkillModal
          skill={editingSkill}
          moduleId={selectedModuleId}
          onClose={() => setShowSkillModal(false)}
          onSuccess={() => { 
            setShowSkillModal(false); 
            loadData(); 
            setToast({ message: 'Acquis enregistré', type: 'success' }); 
          }}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}

// ============================================================================
// VALIDATION STAGES SECTION
// ============================================================================

interface ValidationStagesSectionProps {
  stages: ValidationStage[]
  onAdd: () => void
  onEdit: (stage: ValidationStage) => void
  onDelete: (id: string) => void
}

function ValidationStagesSection({ stages, onAdd, onEdit, onDelete }: ValidationStagesSectionProps) {
  return (
    <div className="theme-card p-6 shadow">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold theme-text">📊 Étapes de Validation</h2>
          <p className="text-sm theme-text-muted mt-1">
            Configurez les différentes étapes de progression (ex: Vu en piscine → Acquis → Validé en mer)
          </p>
        </div>
        <Button onClick={onAdd}>➕ Nouvelle étape</Button>
      </div>

      <div className="space-y-3">
        {stages.map((stage, index) => (
          <div
            key={stage.id}
            className="flex items-center justify-between p-4 theme-bg-card rounded-lg border theme-border hover:border-cyan-500/50 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl">{stage.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium theme-text">{stage.name}</span>
                  <span 
                    className="px-2 py-0.5 text-xs rounded"
                    style={{ backgroundColor: stage.color + '20', color: stage.color }}
                  >
                    {stage.code}
                  </span>
                  {stage.is_final && (
                    <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400 border border-green-500/30">
                      ✓ Finale
                    </span>
                  )}
                </div>
                {stage.description && (
                  <p className="text-sm theme-text-muted mt-0.5">{stage.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm theme-text-muted">#{index + 1}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onEdit(stage)}
                  className="p-1.5 theme-text-muted hover:text-cyan-400 hover:bg-cyan-500/20 rounded"
                  title="Modifier"
                >
                  ✏️
                </button>
                <button
                  onClick={() => onDelete(stage.id)}
                  className="p-1.5 theme-text-muted hover:text-red-400 hover:bg-red-500/20 rounded"
                  title="Supprimer"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// HIERARCHY SECTION
// ============================================================================

interface HierarchySectionProps {
  level: string
  domains: CompetencyDomain[]
  expandedDomains: Set<string>
  setExpandedDomains: React.Dispatch<React.SetStateAction<Set<string>>>
  expandedModules: Set<string>
  setExpandedModules: React.Dispatch<React.SetStateAction<Set<string>>>
  onAddDomain: () => void
  onEditDomain: (domain: CompetencyDomain) => void
  onDeleteDomain: (id: string) => void
  onAddModule: (domainId: string) => void
  onEditModule: (module: CompetencyModule) => void
  onDeleteModule: (id: string) => void
  onAddSkill: (moduleId: string, domainId: string) => void
  onEditSkill: (skill: CompetencySkill) => void
  onDeleteSkill: (id: string) => void
}

function HierarchySection({
  level,
  domains,
  expandedDomains,
  setExpandedDomains,
  expandedModules,
  setExpandedModules,
  onAddDomain,
  onEditDomain,
  onDeleteDomain,
  onAddModule,
  onEditModule,
  onDeleteModule,
  onAddSkill,
  onEditSkill,
  onDeleteSkill,
}: HierarchySectionProps) {
  const toggleDomain = (id: string) => {
    setExpandedDomains(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(id)) {
        newExpanded.delete(id)
      } else {
        newExpanded.add(id)
      }
      return newExpanded
    })
  }

  const toggleModule = (id: string) => {
    setExpandedModules(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(id)) {
        newExpanded.delete(id)
      } else {
        newExpanded.add(id)
      }
      return newExpanded
    })
  }

  const levelDomains = domains.filter(d => d.diving_level === level)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold theme-text">{LEVEL_NAMES[level] || level}</h2>
          <p className="text-sm theme-text-muted">
            {levelDomains.length} domaine{levelDomains.length > 1 ? 's' : ''} • 
            {levelDomains.reduce((sum, d) => sum + (d.modules?.length || 0), 0)} modules •
            {levelDomains.reduce((sum, d) => sum + (d.modules?.reduce((s, m) => s + (m.skills?.length || 0), 0) || 0), 0)} acquis
          </p>
        </div>
        <Button onClick={onAddDomain}>➕ Nouveau domaine</Button>
      </div>

      {levelDomains.length === 0 ? (
        <div className="theme-card p-12 text-center shadow">
          <p className="theme-text-muted mb-4">Aucun domaine défini pour {level}</p>
          <Button onClick={onAddDomain}>Créer le premier domaine</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {levelDomains.map((domain) => (
            <div key={domain.id} className="theme-card shadow overflow-hidden">
              {/* Domain header */}
              <div 
                className="flex items-center justify-between p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 cursor-pointer hover:from-cyan-500/20 hover:to-blue-500/20 transition-colors"
                onClick={() => toggleDomain(domain.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{expandedDomains.has(domain.id) ? '📂' : '📁'}</span>
                  <div>
                    <span className="font-bold text-amber-400">{domain.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <span className="text-sm text-slate-400">
                    {domain.modules?.length || 0} module{(domain.modules?.length || 0) > 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => onAddModule(domain.id)}
                    className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-300 rounded hover:bg-cyan-500/30 border border-cyan-500/30"
                  >
                    + Module
                  </button>
                  <button
                    onClick={() => onEditDomain(domain)}
                    className="p-1 text-slate-400 hover:text-cyan-400"
                    title="Modifier"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onDeleteDomain(domain.id)}
                    className="p-1 text-slate-400 hover:text-red-400"
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Modules */}
              {expandedDomains.has(domain.id) && domain.modules && (
                <div className="border-t theme-border">
                  {domain.modules.length === 0 ? (
                    <div className="p-4 text-center theme-text-muted text-sm">
                      Aucun module dans ce domaine
                    </div>
                  ) : (
                    domain.modules.map((module) => (
                      <div key={module.id} className="border-b theme-border last:border-b-0">
                        {/* Module header */}
                        <div 
                          className="flex items-center justify-between p-3 pl-8 theme-hover cursor-pointer"
                          onClick={() => toggleModule(module.id)}
                        >
                          <div className="flex items-center gap-2">
                            <span>{expandedModules.has(module.id) ? '📖' : '📕'}</span>
                            <span className="font-medium text-cyan-300">{module.name}</span>
                          </div>
                          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs theme-text-muted">
                              {module.skills?.length || 0} acquis
                            </span>
                            <button
                              onClick={() => onAddSkill(module.id, module.domain_id)}
                              className="px-2 py-0.5 text-xs bg-green-500/20 text-green-300 rounded hover:bg-green-500/30 border border-green-500/30"
                            >
                              + Acquis
                            </button>
                            <button
                              onClick={() => onEditModule(module)}
                              className="p-1 theme-text-muted hover:text-cyan-400"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => onDeleteModule(module.id)}
                              className="p-1 theme-text-muted hover:text-red-400"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Skills */}
                        {expandedModules.has(module.id) && module.skills && (
                          <div className="theme-bg-card border-t theme-border">
                            {module.skills.length === 0 ? (
                              <div className="p-3 pl-12 theme-text-muted text-sm">
                                Aucun acquis dans ce module
                              </div>
                            ) : (
                              module.skills.map((skill, index) => (
                                <div
                                  key={skill.id}
                                  className="flex items-center justify-between p-2 pl-12 theme-hover border-b theme-border last:border-b-0"
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="w-5 h-5 bg-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center text-xs border border-cyan-500/30">
                                        {index + 1}
                                      </span>
                                      <span className="text-sm theme-text-secondary">{skill.name}</span>
                                      <span className="text-xs theme-text-muted theme-badge px-1.5 py-0.5 rounded">
                                        Min: {skill.min_validator_level}
                                      </span>
                                    </div>
                                    {skill.description && (
                                      <p className="text-xs theme-text-muted ml-7 mt-1 italic">
                                        💡 {skill.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => onEditSkill(skill)}
                                      className="p-1 theme-text-muted hover:text-cyan-400"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => onDeleteSkill(skill.id)}
                                      className="p-1 theme-text-muted hover:text-red-400"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// STUDENTS SECTION
// ============================================================================

interface StudentsSectionProps {
  level: string
  students: Person[]
  onViewProgress: (student: Person) => void
}

function StudentsSection({ level, students, onViewProgress }: StudentsSectionProps) {
  return (
    <div className="theme-card p-6 shadow">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold theme-text">👨‍🎓 Élèves préparant {level}</h2>
          <p className="text-sm theme-text-muted mt-1">
            {students.length} élève{students.length > 1 ? 's' : ''} en préparation
          </p>
        </div>
      </div>

      {students.length === 0 ? (
        <p className="text-center theme-text-muted py-8">
          Aucun élève ne prépare actuellement le niveau {level}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((student) => (
            <div
              key={student.id}
              className="p-4 theme-bg-card rounded-lg border theme-border hover:border-cyan-500/50 transition-colors"
            >
              <div className="font-medium theme-text">
                {student.first_name} {student.last_name}
              </div>
              <div className="text-sm theme-text-muted">{student.email}</div>
              {student.diving_level_display && (
                <div className="text-xs text-cyan-400 mt-1">
                  🤿 Niveau actuel: {student.diving_level_display}
                </div>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onViewProgress(student)}
                className="mt-3 w-full"
              >
                📊 Voir la progression
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// CHART CARD WITH FULLSCREEN
// ============================================================================

interface ChartCardProps {
  chartId: string
  title: string
  fullscreenChartId: string | null
  onToggleFullscreen: (id: string | null) => void
  children: React.ReactNode
  height?: number
}

function ChartCard({ chartId, title, fullscreenChartId, onToggleFullscreen, children, height = 300 }: ChartCardProps) {
  const isFullscreen = fullscreenChartId === chartId
  return (
    <>
      <div className="theme-card p-6 shadow relative">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold theme-text">{title}</h3>
          <button
            type="button"
            onClick={() => onToggleFullscreen(isFullscreen ? null : chartId)}
            className="p-2 rounded-lg theme-text-muted hover:theme-bg-hover transition-colors"
            title={isFullscreen ? 'Réduire' : 'Plein écran'}
            aria-label={isFullscreen ? 'Réduire' : 'Plein écran'}
          >
            {isFullscreen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            )}
          </button>
        </div>
        <ResponsiveContainer width="100%" height={height}>
          {children}
        </ResponsiveContainer>
      </div>
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          onClick={() => onToggleFullscreen(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Graphique en plein écran"
        >
          <div
            className="theme-card shadow-xl max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold theme-text">{title}</h3>
              <button
                type="button"
                onClick={() => onToggleFullscreen(null)}
                className="p-2 rounded-lg theme-text-muted hover:theme-bg-hover"
                aria-label="Fermer"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                {children}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ============================================================================
// STATISTICS SECTION
// ============================================================================

interface StatisticsSectionProps {
  people: Person[]
  stages: ValidationStage[]
}

function StatisticsSection({ people }: StatisticsSectionProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [participationData, setParticipationData] = useState<{ id: string; name: string; fullName: string; eleves: number; encadrants: number; total: number }[]>([])
  const [progressData, setProgressData] = useState<Record<string, { validated: number; inProgress: number; notStarted: number }>>({})
  const [validationLogs, setValidationLogs] = useState<ValidationLogEntry[]>([])
  const [fullscreenChartId, setFullscreenChartId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Créer un map des encadrants pour lookup rapide
  const encadrantIds = new Set(people.filter(p => p.is_instructor).map(p => p.id))

  useEffect(() => {
    loadStatistics()
  }, [people])

  const loadStatistics = async () => {
    try {
      setLoading(true)
      
      // Charger les sessions
      const sessionsRes = await sessionsApi.list()
      const sortedSessions = sessionsRes.data.sort((a, b) => 
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      )
      setSessions(sortedSessions)
      
      // Charger les participations par session - différencier élèves et encadrants (10 plus récentes)
      const recentSessions = sortedSessions.slice(-10)
      const participations: { id: string; name: string; fullName: string; eleves: number; encadrants: number; total: number }[] = []
      
      for (let i = 0; i < recentSessions.length; i++) {
        const session = recentSessions[i]
        try {
          const res = await questionnairesApi.list(session.id)
          const encadrantsCount = res.data.filter(q => encadrantIds.has(q.person_id)).length
          const elevesCount = res.data.length - encadrantsCount
          // Extraire juste la date pour l'axe X (format court et unique)
          const dateMatch = session.name.match(/(\d{2}\/\d{2}\/\d{4})/)
          const shortName = dateMatch ? dateMatch[1] : `Session ${i + 1}`
          participations.push({
            id: session.id,
            name: shortName,
            fullName: session.name,
            eleves: elevesCount,
            encadrants: encadrantsCount,
            total: res.data.length
          })
        } catch {
          participations.push({ 
            id: session.id, 
            name: `Session ${i + 1}`, 
            fullName: session.name, 
            eleves: 0, 
            encadrants: 0, 
            total: 0 
          })
        }
      }
      
      setParticipationData(participations)

      // Logs des validations (admin) pour graphique par mois
      try {
        const logsRes = await skillValidationsApi.getLogs()
        setValidationLogs(logsRes.data)
      } catch {
        setValidationLogs([])
      }

      // Charger la progression des compétences par niveau
      const studentsPreparingLevels = people.filter(p => p.preparing_level && LEVEL_ORDER.includes(p.preparing_level))
      const progressByLevel: Record<string, { validated: number; inProgress: number; notStarted: number }> = {}
      
      for (const level of LEVEL_ORDER) {
        progressByLevel[level] = { validated: 0, inProgress: 0, notStarted: 0 }
      }
      
      // Pour chaque élève avec un niveau en préparation, charger ses compétences
      for (const student of studentsPreparingLevels.slice(0, 20)) { // Limiter à 20 pour la perf
        if (!student.preparing_level) continue
        try {
          const competencies = await skillValidationsApi.getPersonCompetencies(student.id, student.preparing_level)
          for (const domain of competencies.data.domains) {
            progressByLevel[student.preparing_level].validated += domain.progress.validated
            progressByLevel[student.preparing_level].inProgress += domain.progress.in_progress
            progressByLevel[student.preparing_level].notStarted += domain.progress.not_started
          }
        } catch {
          // Ignorer les erreurs silencieusement
        }
      }
      
      setProgressData(progressByLevel as any)
    } catch (error) {
      console.error('Error loading statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  // Données pour le graphique des élèves par niveau
  const studentsByLevelData = LEVEL_ORDER.map((level) => {
    const count = people.filter(p => p.preparing_level === level).length
    return { level, count, name: LEVEL_NAMES[level] || level }
  })

  // Données pour le graphique des niveaux actuels (tous les plongeurs)
  const currentLevelData = (() => {
    const levelCounts: Record<string, number> = {}
    people.forEach(p => {
      if (p.diving_level_display) {
        levelCounts[p.diving_level_display] = (levelCounts[p.diving_level_display] || 0) + 1
      }
    })
    return Object.entries(levelCounts)
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => {
        const orderA = LEVEL_ORDER.indexOf(a.level)
        const orderB = LEVEL_ORDER.indexOf(b.level)
        if (orderA === -1 && orderB === -1) return 0
        if (orderA === -1) return 1
        if (orderB === -1) return -1
        return orderA - orderB
      })
  })()

  // Données pour le graphique encadrants vs élèves
  const encadrantsVsEleves = (() => {
    const encadrants = people.filter(p => p.is_instructor).length
    const eleves = people.filter(p => !p.is_instructor).length
    return [
      { name: 'Encadrants', value: encadrants, color: '#3B82F6' },
      { name: 'Élèves', value: eleves, color: '#10B981' }
    ]
  })()

  // Progression par niveau
  const progressChartData = LEVEL_ORDER.map(level => {
    const data = progressData[level] || { validated: 0, inProgress: 0, notStarted: 0 }
    return {
      level,
      'Validé': data.validated,
      'En cours': data.inProgress,
      'Non commencé': data.notStarted
    }
  })

  // Validations par mois (et par niveau)
  const validationsByMonthData = (() => {
    const byMonth: Record<string, { total: number; N1: number; N2: number; N3: number }> = {}
    for (const log of validationLogs) {
      const d = new Date(log.validated_at)
      if (Number.isNaN(d.getTime())) continue
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!byMonth[monthKey]) byMonth[monthKey] = { total: 0, N1: 0, N2: 0, N3: 0 }
      byMonth[monthKey].total += 1
      const level = log.diving_level?.toUpperCase?.() || ''
      if (LEVEL_ORDER.includes(level)) (byMonth[monthKey] as Record<string, number>)[level] += 1
    }
    const monthNames = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']
    return Object.entries(byMonth)
      .map(([month, v]) => {
        const [y, m] = month.split('-')
        const name = `${monthNames[parseInt(m, 10) - 1]} ${y}`
        return { month, ...v, name }
      })
      .sort((a, b) => a.month.localeCompare(b.month))
  })()

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 theme-text-muted">Chargement des statistiques...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Cartes de résumé */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="text-3xl font-bold">{people.length}</div>
          <div className="text-blue-100">Membres total</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="text-3xl font-bold">{people.filter(p => p.is_instructor).length}</div>
          <div className="text-green-100">Encadrants</div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-6 text-white">
          <div className="text-3xl font-bold">{people.filter(p => p.preparing_level).length}</div>
          <div className="text-amber-100">En préparation</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="text-3xl font-bold">{sessions.length}</div>
          <div className="text-purple-100">Sessions de fosse</div>
        </div>
      </div>

      {/* Graphiques en grille */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Validations par mois (par niveau) */}
        <ChartCard chartId="validations-mois" title="📆 Validations par mois (par niveau)" fullscreenChartId={fullscreenChartId} onToggleFullscreen={setFullscreenChartId}>
          {validationsByMonthData.length > 0 ? (
            <BarChart data={validationsByMonthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip
                labelFormatter={(label) => label}
                formatter={(value: number) => [value, 'Validations']}
              />
              <Legend />
              <Bar dataKey="N1" stackId="a" fill="#3B82F6" name="N1" radius={[0, 0, 0, 0]} />
              <Bar dataKey="N2" stackId="a" fill="#10B981" name="N2" radius={[0, 0, 0, 0]} />
              <Bar dataKey="N3" stackId="a" fill="#8B5CF6" name="N3" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <div className="h-full flex items-center justify-center theme-text-muted">Aucune validation enregistrée</div>
          )}
        </ChartCard>

        {/* Élèves par niveau préparé */}
        <ChartCard chartId="eleves-niveau" title="👨‍🎓 Élèves par niveau préparé" fullscreenChartId={fullscreenChartId} onToggleFullscreen={setFullscreenChartId}>
          <BarChart data={studentsByLevelData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="level" />
            <YAxis allowDecimals={false} />
            <Tooltip 
              formatter={(value: number) => [value, 'Élèves']}
              labelFormatter={(label) => LEVEL_NAMES[label] || label}
            />
            <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>

        {/* Répartition Encadrants / Élèves */}
        <ChartCard chartId="repartition" title="👥 Répartition des membres" fullscreenChartId={fullscreenChartId} onToggleFullscreen={setFullscreenChartId}>
          <PieChart>
            <Pie
              data={encadrantsVsEleves}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
            >
              {encadrantsVsEleves.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartCard>

        {/* Niveaux actuels des membres */}
        <ChartCard chartId="niveaux-actuels" title="🤿 Niveaux actuels des membres" fullscreenChartId={fullscreenChartId} onToggleFullscreen={setFullscreenChartId}>
          <BarChart data={currentLevelData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis dataKey="level" type="category" width={60} />
            <Tooltip formatter={(value: number) => [value, 'Membres']} />
            <Bar dataKey="count" fill="#10B981" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartCard>

        {/* Participations aux fosses - élèves vs encadrants */}
        <div className="theme-card p-6 shadow relative">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold theme-text">📅 Participations aux dernières fosses</h3>
            <button
              type="button"
              onClick={() => setFullscreenChartId(fullscreenChartId === 'participations' ? null : 'participations')}
              className="p-2 rounded-lg theme-text-muted hover:theme-bg-hover transition-colors"
              title={fullscreenChartId === 'participations' ? 'Réduire' : 'Plein écran'}
              aria-label="Plein écran"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </button>
          </div>
          {participationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={participationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={10} />
                <YAxis allowDecimals={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0 && payload[0]?.payload) {
                      const data = payload[0].payload
                      return (
                        <div className="theme-card p-3">
                          <p className="font-semibold theme-text mb-2">📅 {data.fullName}</p>
                          <p className="text-green-600">👨‍🎓 Élèves : {data.eleves}</p>
                          <p className="text-blue-600">👨‍🏫 Encadrants : {data.encadrants}</p>
                          <p className="theme-text-secondary font-medium border-t theme-border mt-2 pt-2">Total : {data.eleves + data.encadrants}</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend 
                  formatter={(value) => value === 'eleves' ? '👨‍🎓 Élèves' : '👨‍🏫 Encadrants'}
                />
                <Bar dataKey="eleves" stackId="a" fill="#10B981" name="eleves" radius={[0, 0, 0, 0]} />
                <Bar dataKey="encadrants" stackId="a" fill="#3B82F6" name="encadrants" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center theme-text-muted">
              Aucune donnée de participation disponible
            </div>
          )}
          {fullscreenChartId === 'participations' && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setFullscreenChartId(null)} role="dialog" aria-modal="true">
              <div className="theme-card shadow-xl max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold theme-text">📅 Participations aux dernières fosses</h3>
                  <button type="button" onClick={() => setFullscreenChartId(null)} className="p-2 rounded-lg theme-text-muted hover:theme-bg-hover" aria-label="Fermer">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={participationData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={10} />
                      <YAxis allowDecimals={false} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length > 0 && payload[0]?.payload) {
                            const data = payload[0].payload
                            return (
                              <div className="theme-card p-3">
                                <p className="font-semibold theme-text mb-2">📅 {data.fullName}</p>
                                <p className="text-green-600">👨‍🎓 Élèves : {data.eleves}</p>
                                <p className="text-blue-600">👨‍🏫 Encadrants : {data.encadrants}</p>
                                <p className="theme-text-secondary font-medium border-t theme-border mt-2 pt-2">Total : {data.eleves + data.encadrants}</p>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Legend formatter={(value) => value === 'eleves' ? '👨‍🎓 Élèves' : '👨‍🏫 Encadrants'} />
                      <Bar dataKey="eleves" stackId="a" fill="#10B981" name="eleves" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="encadrants" stackId="a" fill="#3B82F6" name="encadrants" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progression des compétences par niveau */}
      <ChartCard chartId="progression" title="📈 Progression des compétences par niveau" fullscreenChartId={fullscreenChartId} onToggleFullscreen={setFullscreenChartId} height={350}>
        <BarChart data={progressChartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="level" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Bar dataKey="Validé" stackId="a" fill="#10B981" />
          <Bar dataKey="En cours" stackId="a" fill="#F59E0B" />
          <Bar dataKey="Non commencé" stackId="a" fill="#E5E7EB" />
        </BarChart>
      </ChartCard>
      <p className="text-sm theme-text-muted mt-2 text-center -mt-4">
        Agrégation des compétences des élèves préparant chaque niveau
      </p>

      {/* Tableau détaillé par niveau */}
      <div className="theme-card shadow overflow-hidden">
        <div className="px-6 py-4 border-b theme-border">
          <h3 className="text-lg font-bold theme-text">📋 Détail par niveau</h3>
        </div>
        <table className="min-w-full divide-y theme-border">
          <thead className="theme-bg-input">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium theme-text-muted uppercase">Niveau</th>
              <th className="px-6 py-3 text-left text-xs font-medium theme-text-muted uppercase">Description</th>
              <th className="px-6 py-3 text-center text-xs font-medium theme-text-muted uppercase">Élèves en préparation</th>
              <th className="px-6 py-3 text-center text-xs font-medium theme-text-muted uppercase">Membres avec ce niveau</th>
            </tr>
          </thead>
          <tbody className="theme-card divide-y theme-border">
            {LEVEL_ORDER.map((level) => {
              const preparing = people.filter(p => p.preparing_level === level).length
              const current = people.filter(p => p.diving_level_display === level).length
              return (
                <tr key={level} className="theme-hover">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full font-medium border border-cyan-500/30">
                      {level}
                    </span>
                  </td>
                  <td className="px-6 py-4 theme-text-secondary">
                    {LEVEL_NAMES[level] || level}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {preparing > 0 ? (
                      <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded-full text-sm border border-amber-500/30">
                        {preparing} 👨‍🎓
                      </span>
                    ) : (
                      <span className="theme-text-dimmed">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {current > 0 ? (
                      <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded-full text-sm border border-green-500/30">
                        {current} 🤿
                      </span>
                    ) : (
                      <span className="theme-text-dimmed">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================================
// MODALS
// ============================================================================

interface StageModalProps {
  stage: ValidationStage | null
  onClose: () => void
  onSuccess: () => void
}

function StageModal({ stage, onClose, onSuccess }: StageModalProps) {
  const [formData, setFormData] = useState({
    code: stage?.code || '',
    name: stage?.name || '',
    description: stage?.description || '',
    color: stage?.color || '#6B7280',
    icon: stage?.icon || '⏳',
    sort_order: stage?.sort_order ?? undefined,
    is_final: stage?.is_final ?? false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (stage) {
        await validationStagesApi.update(stage.id, formData)
      } else {
        await validationStagesApi.create(formData)
      }
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={stage ? 'Modifier l\'étape' : 'Nouvelle étape'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-500/20 text-red-400 border border-red-500/50 p-3 rounded">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Code *</label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="VU_PISCINE"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Icône</label>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="👀"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Nom *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            placeholder="Vu - en piscine"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Couleur</label>
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-full h-10 px-1 py-1 bg-slate-700/50 border border-slate-600 rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Ordre</label>
            <input
              type="number"
              value={formData.sort_order ?? ''}
              onChange={(e) => setFormData({ ...formData, sort_order: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_final"
            checked={formData.is_final}
            onChange={(e) => setFormData({ ...formData, is_final: e.target.checked })}
            className="rounded border-slate-600 accent-cyan-500"
          />
          <label htmlFor="is_final" className="text-sm text-slate-300">
            Étape finale de validation (ex: Validé en mer)
          </label>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'En cours...' : stage ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

interface DomainModalProps {
  domain: CompetencyDomain | null
  defaultLevel: string
  onClose: () => void
  onSuccess: (newDomainId?: string) => void
}

function DomainModal({ domain, defaultLevel, onClose, onSuccess }: DomainModalProps) {
  const [formData, setFormData] = useState({
    diving_level: domain?.diving_level || defaultLevel,
    name: domain?.name || '',
    sort_order: domain?.sort_order ?? undefined,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (domain) {
        await competencyDomainsApi.update(domain.id, formData)
        onSuccess()
      } else {
        const res = await competencyDomainsApi.create(formData)
        onSuccess(res.data.id)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={domain ? 'Modifier le domaine' : 'Nouveau domaine'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-500/20 text-red-400 border border-red-500/50 p-3 rounded">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Niveau *</label>
          <select
            value={formData.diving_level}
            onChange={(e) => setFormData({ ...formData, diving_level: e.target.value })}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            required
          >
            {LEVEL_ORDER.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Nom *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            placeholder="COMMUNES, PE40, PA20..."
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'En cours...' : domain ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

interface ModuleModalProps {
  module: CompetencyModule | null
  domainId: string
  onClose: () => void
  onSuccess: (newModuleId?: string) => void
}

function ModuleModal({ module, domainId, onClose, onSuccess }: ModuleModalProps) {
  const [formData, setFormData] = useState({
    domain_id: module?.domain_id || domainId,
    name: module?.name || '',
    sort_order: module?.sort_order ?? undefined,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (module) {
        await competencyModulesApi.update(module.id, formData)
        onSuccess()
      } else {
        const res = await competencyModulesApi.create(formData)
        onSuccess(res.data.id)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={module ? 'Modifier le module' : 'Nouveau module'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-500/20 text-red-400 border border-red-500/50 p-3 rounded">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Nom *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            placeholder="S'ÉQUIPER ET SE DÉSÉQUIPER..."
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'En cours...' : module ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

interface SkillModalProps {
  skill: CompetencySkill | null
  moduleId: string
  onClose: () => void
  onSuccess: () => void
}

function SkillModal({ skill, moduleId, onClose, onSuccess }: SkillModalProps) {
  const [formData, setFormData] = useState({
    module_id: skill?.module_id || moduleId,
    name: skill?.name || '',
    description: skill?.description || '',
    sort_order: skill?.sort_order ?? undefined,
    min_validator_level: skill?.min_validator_level || 'E2',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (skill) {
        await competencySkillsApi.update(skill.id, formData)
      } else {
        await competencySkillsApi.create(formData)
      }
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={skill ? 'Modifier l\'acquis' : 'Nouvel acquis'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-500/20 text-red-400 border border-red-500/50 p-3 rounded">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Nom *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            placeholder="Gréage et dégréage"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">
            Description <span className="text-slate-500">(optionnelle)</span>
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            placeholder="Aide pour les encadrants lors de la validation..."
            rows={3}
          />
          <p className="text-xs text-slate-400 mt-1">
            Aide affichée aux encadrants lors de la validation de cet acquis
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Niveau minimum du validateur</label>
          <select
            value={formData.min_validator_level}
            onChange={(e) => setFormData({ ...formData, min_validator_level: e.target.value })}
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {MIN_VALIDATOR_LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Niveau minimum requis pour valider cet acquis
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'En cours...' : skill ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
