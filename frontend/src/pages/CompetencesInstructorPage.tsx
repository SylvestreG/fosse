import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  peopleApi, 
  Person, 
} from '@/lib/api'
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
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('N2')
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const peopleRes = await peopleApi.list()
      setPeople(peopleRes.data)
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
                onClick={() => navigate(`/dashboard/competences/student/${student.id}`)}
                className="p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                  {student.first_name} {student.last_name}
                </div>
                <div className="text-sm text-gray-500">{student.email}</div>
                {student.diving_level_display && (
                  <div className="text-xs text-blue-600 mt-1">
                    🤿 Niveau actuel: {student.diving_level_display}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Cliquez pour voir et valider</span>
                  <span className="text-blue-500 group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
