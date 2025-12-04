import { useEffect, useState } from 'react'
import { 
  peopleApi, 
  validationStagesApi, 
  skillValidationsApi,
  Person, 
  ValidationStage,
  CompetencyHierarchy,
} from '@/lib/api'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import Toast from '@/components/Toast'

// Ordre des niveaux
const LEVEL_ORDER = ['N1', 'N2', 'N3', 'N4', 'N5', 'E2', 'MF1', 'MF2']

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

export default function CompetencesInstructorPage() {
  const [activeTab, setActiveTab] = useState('N2')
  const [people, setPeople] = useState<Person[]>([])
  const [stages, setStages] = useState<ValidationStage[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  const [showStudentProgressModal, setShowStudentProgressModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Person | null>(null)
  const [studentProgress, setStudentProgress] = useState<CompetencyHierarchy | null>(null)

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    try {
      setLoading(true)
      const [peopleRes, stagesRes] = await Promise.all([
        peopleApi.list(),
        validationStagesApi.list(),
      ])
      setPeople(peopleRes.data)
      setStages(stagesRes.data)
    } catch (error) {
      console.error('Error loading data:', error)
      setToast({ message: 'Erreur lors du chargement des données', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

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

  if (loading) {
    return <div className="text-center py-12">Chargement...</div>
  }

  const studentsForCurrentLevel = getStudentsPreparingLevel(activeTab)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🎯 Validation des Compétences</h1>
          <p className="text-gray-600 mt-1">Valider les compétences des élèves en préparation</p>
        </div>
      </div>

      {/* Tabs pour les niveaux */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-1 overflow-x-auto pb-px">
          {LEVEL_ORDER.map((level) => {
            const studentCount = getStudentCountByLevel(level)
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

      {/* Students Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">👨‍🎓 Élèves préparant {LEVEL_NAMES[activeTab] || activeTab}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {studentsForCurrentLevel.length} élève{studentsForCurrentLevel.length > 1 ? 's' : ''} en préparation
            </p>
          </div>
        </div>

        {studentsForCurrentLevel.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            Aucun élève ne prépare actuellement le niveau {activeTab}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {studentsForCurrentLevel.map((student) => (
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
                  onClick={() => handleViewStudentProgress(student)}
                  className="mt-3 w-full"
                >
                  📊 Voir et valider
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Student Progress Modal */}
      {showStudentProgressModal && selectedStudent && (
        <StudentProgressModal
          student={selectedStudent}
          progress={studentProgress}
          stages={stages}
          onClose={() => { setShowStudentProgressModal(false); setStudentProgress(null) }}
          onValidate={async () => {
            // Refresh student progress
            const level = selectedStudent.preparing_level || selectedStudent.diving_level_display
            if (level) {
              const res = await skillValidationsApi.getPersonCompetencies(selectedStudent.id, level)
              setStudentProgress(res.data)
            }
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
// STUDENT PROGRESS MODAL
// ============================================================================

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

