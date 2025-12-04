import { useEffect, useState } from 'react'
import { 
  peopleApi, 
  validationStagesApi, 
  competencyDomainsApi, 
  competencyModulesApi, 
  competencySkillsApi,
  skillValidationsApi,
  Person, 
  ValidationStage,
  CompetencyDomain,
  CompetencyModule,
  CompetencySkill,
  CompetencyHierarchy,
} from '@/lib/api'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import Toast from '@/components/Toast'

// Ordre des niveaux
const LEVEL_ORDER = ['N1', 'N2', 'N3', 'N4', 'N5', 'E2', 'MF1', 'MF2']
const MIN_VALIDATOR_LEVELS = ['E2', 'MF1', 'MF2', 'N4', 'N3']

// Noms complets des niveaux
const LEVEL_NAMES: Record<string, string> = {
  N1: 'Niveau 1 - Plongeur Encadré',
  N2: 'Niveau 2 - Plongeur Autonome 20m',
  N3: 'Niveau 3 - Plongeur Autonome 60m',
  N4: 'Niveau 4 - Guide de Palanquée',
  N5: 'Niveau 5 - Directeur de Plongée',
  E2: 'E2 - Encadrant Niveau 2',
  MF1: 'MF1 - Moniteur Fédéral 1',
  MF2: 'MF2 - Moniteur Fédéral 2',
}

type ManageMode = 'hierarchy' | 'stages' | 'students'

export default function CompetencesAdminPage() {
  const [activeTab, setActiveTab] = useState('N2')
  const [manageMode, setManageMode] = useState<ManageMode>('hierarchy')
  const [people, setPeople] = useState<Person[]>([])
  const [stages, setStages] = useState<ValidationStage[]>([])
  const [domains, setDomains] = useState<CompetencyDomain[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
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
  const [showStudentProgressModal, setShowStudentProgressModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Person | null>(null)
  const [studentProgress, setStudentProgress] = useState<CompetencyHierarchy | null>(null)

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    try {
      setLoading(true)
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
      setLoading(false)
    }
  }

  // Filtrer les élèves qui préparent un niveau donné
  const getStudentsPreparingLevel = (level: string) => {
    return people.filter(p => p.preparing_level === level)
  }

  const getStudentCountByLevel = (level: string) => {
    return getStudentsPreparingLevel(level).length
  }

  const handleViewStudentProgress = async (student: Person) => {
    setSelectedStudent(student)
    try {
      const level = student.preparing_level || student.diving_level_display
      if (level) {
        const res = await skillValidationsApi.getPersonCompetencies(student.id, level)
        setStudentProgress(res.data)
      }
    } catch (error) {
      console.error('Error loading student progress:', error)
    }
    setShowStudentProgressModal(true)
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

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  const studentsForCurrentLevel = getStudentsPreparingLevel(activeTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🎯 Gestion des Compétences</h1>
          <p className="text-gray-600 mt-1">Administration des domaines, modules et acquis</p>
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
            📊 Étapes
          </Button>
          <Button
            variant={manageMode === 'students' ? 'primary' : 'secondary'}
            onClick={() => setManageMode('students')}
          >
            👨‍🎓 Élèves
          </Button>
        </div>
      </div>

      {/* Tabs pour les niveaux */}
      <div className="border-b border-gray-200">
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
                    ? 'border-blue-500 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {level}
                {activeTab === level && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-blue-200 text-blue-800">
                    {domainCount} dom.
                  </span>
                )}
                {studentCount > 0 && (
                  <span className={`px-1.5 py-0.5 text-xs rounded-full ${activeTab === level ? 'bg-amber-200 text-amber-800' : 'bg-amber-100 text-amber-600'}`}>
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
          onAddDomain={() => { setEditingDomain(null); setShowDomainModal(true) }}
          onEditDomain={(domain) => { setEditingDomain(domain); setShowDomainModal(true) }}
          onDeleteDomain={handleDeleteDomain}
          onAddModule={(domainId) => { setSelectedDomainId(domainId); setEditingModule(null); setShowModuleModal(true) }}
          onEditModule={(module) => { setSelectedDomainId(module.domain_id); setEditingModule(module); setShowModuleModal(true) }}
          onDeleteModule={handleDeleteModule}
          onAddSkill={(moduleId) => { setSelectedModuleId(moduleId); setEditingSkill(null); setShowSkillModal(true) }}
          onEditSkill={(skill) => { setSelectedModuleId(skill.module_id); setEditingSkill(skill); setShowSkillModal(true) }}
          onDeleteSkill={handleDeleteSkill}
        />
      )}

      {manageMode === 'students' && (
        <StudentsSection
          level={activeTab}
          students={studentsForCurrentLevel}
          onViewProgress={handleViewStudentProgress}
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
          onSuccess={() => { setShowDomainModal(false); loadData(); setToast({ message: 'Domaine enregistré', type: 'success' }) }}
        />
      )}

      {showModuleModal && selectedDomainId && (
        <ModuleModal
          module={editingModule}
          domainId={selectedDomainId}
          onClose={() => setShowModuleModal(false)}
          onSuccess={() => { setShowModuleModal(false); loadData(); setToast({ message: 'Module enregistré', type: 'success' }) }}
        />
      )}

      {showSkillModal && selectedModuleId && (
        <SkillModal
          skill={editingSkill}
          moduleId={selectedModuleId}
          onClose={() => setShowSkillModal(false)}
          onSuccess={() => { setShowSkillModal(false); loadData(); setToast({ message: 'Acquis enregistré', type: 'success' }) }}
        />
      )}

      {showStudentProgressModal && selectedStudent && (
        <StudentProgressModal
          student={selectedStudent}
          progress={studentProgress}
          stages={stages}
          onClose={() => { setShowStudentProgressModal(false); setStudentProgress(null) }}
          onValidate={() => loadData()}
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
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">📊 Étapes de Validation</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configurez les différentes étapes de progression (ex: Vu en piscine → Acquis → Validé en mer)
          </p>
        </div>
        <Button onClick={onAdd}>➕ Nouvelle étape</Button>
      </div>

      <div className="space-y-3">
        {stages.map((stage, index) => (
          <div
            key={stage.id}
            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl">{stage.icon}</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{stage.name}</span>
                  <span 
                    className="px-2 py-0.5 text-xs rounded"
                    style={{ backgroundColor: stage.color + '20', color: stage.color }}
                  >
                    {stage.code}
                  </span>
                  {stage.is_final && (
                    <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">
                      ✓ Finale
                    </span>
                  )}
                </div>
                {stage.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{stage.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">#{index + 1}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onEdit(stage)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                  title="Modifier"
                >
                  ✏️
                </button>
                <button
                  onClick={() => onDelete(stage.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
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
  onAddDomain: () => void
  onEditDomain: (domain: CompetencyDomain) => void
  onDeleteDomain: (id: string) => void
  onAddModule: (domainId: string) => void
  onEditModule: (module: CompetencyModule) => void
  onDeleteModule: (id: string) => void
  onAddSkill: (moduleId: string) => void
  onEditSkill: (skill: CompetencySkill) => void
  onDeleteSkill: (id: string) => void
}

function HierarchySection({
  level,
  domains,
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
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

  const toggleDomain = (id: string) => {
    const newExpanded = new Set(expandedDomains)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedDomains(newExpanded)
  }

  const toggleModule = (id: string) => {
    const newExpanded = new Set(expandedModules)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedModules(newExpanded)
  }

  const levelDomains = domains.filter(d => d.diving_level === level)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{LEVEL_NAMES[level] || level}</h2>
          <p className="text-sm text-gray-500">
            {levelDomains.length} domaine{levelDomains.length > 1 ? 's' : ''} • 
            {levelDomains.reduce((sum, d) => sum + (d.modules?.length || 0), 0)} modules •
            {levelDomains.reduce((sum, d) => sum + (d.modules?.reduce((s, m) => s + (m.skills?.length || 0), 0) || 0), 0)} acquis
          </p>
        </div>
        <Button onClick={onAddDomain}>➕ Nouveau domaine</Button>
      </div>

      {levelDomains.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 mb-4">Aucun domaine défini pour {level}</p>
          <Button onClick={onAddDomain}>Créer le premier domaine</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {levelDomains.map((domain) => (
            <div key={domain.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Domain header */}
              <div 
                className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-cyan-50 cursor-pointer hover:from-blue-100 hover:to-cyan-100 transition-colors"
                onClick={() => toggleDomain(domain.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{expandedDomains.has(domain.id) ? '📂' : '📁'}</span>
                  <div>
                    <span className="font-bold text-gray-900">{domain.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <span className="text-sm text-gray-500">
                    {domain.modules?.length || 0} module{(domain.modules?.length || 0) > 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => onAddModule(domain.id)}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    + Module
                  </button>
                  <button
                    onClick={() => onEditDomain(domain)}
                    className="p-1 text-gray-400 hover:text-blue-600"
                    title="Modifier"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onDeleteDomain(domain.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Supprimer"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {/* Modules */}
              {expandedDomains.has(domain.id) && domain.modules && (
                <div className="border-t border-gray-100">
                  {domain.modules.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      Aucun module dans ce domaine
                    </div>
                  ) : (
                    domain.modules.map((module) => (
                      <div key={module.id} className="border-b border-gray-50 last:border-b-0">
                        {/* Module header */}
                        <div 
                          className="flex items-center justify-between p-3 pl-8 hover:bg-gray-50 cursor-pointer"
                          onClick={() => toggleModule(module.id)}
                        >
                          <div className="flex items-center gap-2">
                            <span>{expandedModules.has(module.id) ? '📖' : '📕'}</span>
                            <span className="font-medium text-gray-800">{module.name}</span>
                          </div>
                          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs text-gray-500">
                              {module.skills?.length || 0} acquis
                            </span>
                            <button
                              onClick={() => onAddSkill(module.id)}
                              className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              + Acquis
                            </button>
                            <button
                              onClick={() => onEditModule(module)}
                              className="p-1 text-gray-400 hover:text-blue-600"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => onDeleteModule(module.id)}
                              className="p-1 text-gray-400 hover:text-red-600"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* Skills */}
                        {expandedModules.has(module.id) && module.skills && (
                          <div className="bg-gray-50 border-t border-gray-100">
                            {module.skills.length === 0 ? (
                              <div className="p-3 pl-12 text-gray-500 text-sm">
                                Aucun acquis dans ce module
                              </div>
                            ) : (
                              module.skills.map((skill, index) => (
                                <div
                                  key={skill.id}
                                  className="flex items-center justify-between p-2 pl-12 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs">
                                      {index + 1}
                                    </span>
                                    <span className="text-sm text-gray-700">{skill.name}</span>
                                    <span className="text-xs text-gray-400 bg-gray-200 px-1.5 py-0.5 rounded">
                                      Min: {skill.min_validator_level}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => onEditSkill(skill)}
                                      className="p-1 text-gray-400 hover:text-blue-600"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => onDeleteSkill(skill.id)}
                                      className="p-1 text-gray-400 hover:text-red-600"
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
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">👨‍🎓 Élèves préparant {level}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {students.length} élève{students.length > 1 ? 's' : ''} en préparation
          </p>
        </div>
      </div>

      {students.length === 0 ? (
        <p className="text-center text-gray-500 py-8">
          Aucun élève ne prépare actuellement le niveau {level}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((student) => (
            <div
              key={student.id}
              className="p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors"
            >
              <div className="font-medium text-gray-900">
                {student.first_name} {student.last_name}
              </div>
              <div className="text-sm text-gray-500">{student.email}</div>
              {student.diving_level_display && (
                <div className="text-xs text-blue-600 mt-1">
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
        {error && <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Code *</label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="VU_PISCINE"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Icône</label>
            <input
              type="text"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="👀"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nom *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Vu - en piscine"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Couleur</label>
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-full h-10 px-1 py-1 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ordre</label>
            <input
              type="number"
              value={formData.sort_order ?? ''}
              onChange={(e) => setFormData({ ...formData, sort_order: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_final"
            checked={formData.is_final}
            onChange={(e) => setFormData({ ...formData, is_final: e.target.checked })}
            className="rounded border-gray-300"
          />
          <label htmlFor="is_final" className="text-sm">
            Étape finale de validation (ex: Validé en mer)
          </label>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
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
  onSuccess: () => void
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
      } else {
        await competencyDomainsApi.create(formData)
      }
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={domain ? 'Modifier le domaine' : 'Nouveau domaine'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>}

        <div>
          <label className="block text-sm font-medium mb-1">Niveau *</label>
          <select
            value={formData.diving_level}
            onChange={(e) => setFormData({ ...formData, diving_level: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            {LEVEL_ORDER.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nom *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="COMMUNES, PE40, PA20..."
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
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
  onSuccess: () => void
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
      } else {
        await competencyModulesApi.create(formData)
      }
      onSuccess()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onClose} title={module ? 'Modifier le module' : 'Nouveau module'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>}

        <div>
          <label className="block text-sm font-medium mb-1">Nom *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="S'ÉQUIPER ET SE DÉSÉQUIPER..."
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
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
        {error && <div className="bg-red-50 text-red-600 p-3 rounded">{error}</div>}

        <div>
          <label className="block text-sm font-medium mb-1">Nom *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Gréage et dégréage"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Niveau minimum du validateur</label>
          <select
            value={formData.min_validator_level}
            onChange={(e) => setFormData({ ...formData, min_validator_level: e.target.value })}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MIN_VALIDATOR_LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Niveau minimum requis pour valider cet acquis
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'En cours...' : skill ? 'Modifier' : 'Créer'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

interface StudentProgressModalProps {
  student: Person
  progress: CompetencyHierarchy | null
  stages: ValidationStage[]
  onClose: () => void
  onValidate: () => void
}

function StudentProgressModal({ student, progress, stages, onClose, onValidate }: StudentProgressModalProps) {
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [selectedStage, setSelectedStage] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleValidateSkill = async () => {
    if (!selectedSkill || !selectedStage) return
    setSaving(true)
    try {
      await skillValidationsApi.create({
        person_id: student.id,
        skill_id: selectedSkill,
        stage_id: selectedStage,
        notes: notes || undefined,
      })
      setSelectedSkill(null)
      setSelectedStage('')
      setNotes('')
      onValidate()
    } catch (error) {
      console.error('Error validating skill:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal 
      isOpen={true} 
      onClose={onClose} 
      title={`Progression de ${student.first_name} ${student.last_name}`}
      className="max-w-4xl"
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {!progress ? (
          <p className="text-center text-gray-500 py-8">Chargement...</p>
        ) : progress.domains.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Aucune compétence définie pour le niveau {progress.diving_level}
          </p>
        ) : (
          progress.domains.map((domain) => (
            <div key={domain.id} className="border rounded-lg overflow-hidden">
              <div className="bg-blue-50 p-3 flex justify-between items-center">
                <div>
                  <span className="font-bold">{domain.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {domain.progress.validated}/{domain.progress.total} validés
                  </span>
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${domain.progress.percentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {domain.modules.map((module) => (
                <div key={module.id} className="border-t">
                  <div className="bg-gray-50 p-2 pl-6 text-sm font-medium text-gray-700 flex justify-between">
                    <span>{module.name}</span>
                    <span className="text-xs text-gray-500">
                      {module.progress.validated}/{module.progress.total}
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {module.skills.map((skill) => (
                      <div
                        key={skill.id}
                        className={`p-2 pl-10 flex items-center justify-between hover:bg-gray-50 ${
                          selectedSkill === skill.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span className="text-sm text-gray-700">{skill.name}</span>
                        <div className="flex items-center gap-2">
                          {skill.validation ? (
                            <div className="flex items-center gap-2">
                              <span 
                                className="px-2 py-0.5 text-xs rounded flex items-center gap-1"
                                style={{ 
                                  backgroundColor: skill.validation.stage_color + '20', 
                                  color: skill.validation.stage_color 
                                }}
                              >
                                {skill.validation.stage_icon} {skill.validation.stage_name}
                              </span>
                              <span className="text-xs text-gray-400">
                                par {skill.validation.validated_by_name}
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={() => setSelectedSkill(selectedSkill === skill.id ? null : skill.id)}
                              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              Valider
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}

        {/* Validation form */}
        {selectedSkill && (
          <div className="sticky bottom-0 bg-white border-t p-4 space-y-3">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Étape de validation</label>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sélectionner une étape...</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Notes (optionnel)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Commentaires..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSelectedSkill(null)}>
                Annuler
              </Button>
              <Button onClick={handleValidateSkill} disabled={!selectedStage || saving}>
                {saving ? 'Enregistrement...' : 'Valider'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t mt-4">
        <Button onClick={onClose}>Fermer</Button>
      </div>
    </Modal>
  )
}

