import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  peopleApi, 
  sessionsApi,
  questionnairesApi,
  skillValidationsApi,
  Person, 
  Session,
} from '@/lib/api'
import Button from '@/components/Button'
import Toast from '@/components/Toast'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts'

// Ordre des niveaux - limité à N1, N2, N3 pour l'instant
const LEVEL_ORDER = ['N1', 'N2', 'N3']

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

type ViewMode = 'students' | 'stats'

export default function CompetencesInstructorPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('N2')
  const [viewMode, setViewMode] = useState<ViewMode>('students')
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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">🎯 Validation des Compétences</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Valider les compétences des élèves</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'students' ? 'primary' : 'secondary'}
            onClick={() => setViewMode('students')}
            className="text-sm sm:text-base px-2 sm:px-4"
          >
            👨‍🎓 <span className="hidden sm:inline">Élèves</span>
          </Button>
          <Button
            variant={viewMode === 'stats' ? 'primary' : 'secondary'}
            onClick={() => setViewMode('stats')}
            className="text-sm sm:text-base px-2 sm:px-4"
          >
            📊 <span className="hidden sm:inline">Statistiques</span>
          </Button>
        </div>
      </div>

      {viewMode === 'students' && (
        <>
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
                      whitespace-nowrap py-2 sm:py-3 px-3 sm:px-4 border-b-2 font-medium text-xs sm:text-sm transition-colors
                      flex items-center gap-1.5 sm:gap-2
                      ${activeTab === level
                        ? 'border-blue-500 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    {level}
                    {studentCount > 0 && (
                      <span className={`px-1.5 py-0.5 text-xs rounded-full ${activeTab === level ? 'bg-amber-200 text-amber-800' : 'bg-amber-100 text-amber-600'}`}>
                        {studentCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Students Section */}
          <div className="bg-white rounded-lg shadow p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-2">
              <div>
                <h2 className="text-base sm:text-xl font-bold text-gray-900">👨‍🎓 Élèves préparant {activeTab}</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {studentsForCurrentLevel.length} élève{studentsForCurrentLevel.length > 1 ? 's' : ''} en préparation
                </p>
              </div>
            </div>

            {studentsForCurrentLevel.length === 0 ? (
              <p className="text-center text-gray-500 py-6 sm:py-8 text-sm sm:text-base">
                Aucun élève ne prépare actuellement le niveau {activeTab}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {studentsForCurrentLevel.map((student) => (
                  <div
                    key={student.id}
                    onClick={() => navigate(`/dashboard/competences/student/${student.id}`)}
                    className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group active:bg-blue-50"
                  >
                    <div className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors text-sm sm:text-base">
                      {student.first_name} {student.last_name}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-500 truncate">{student.email}</div>
                    {student.diving_level_display && (
                      <div className="text-xs text-blue-600 mt-1">
                        🤿 {student.diving_level_display}
                      </div>
                    )}
                    <div className="mt-2 sm:mt-3 flex items-center justify-between">
                      <span className="text-xs text-gray-400 hidden sm:inline">Cliquez pour valider</span>
                      <span className="text-blue-500 group-hover:translate-x-1 transition-transform text-sm sm:text-base">Valider →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {viewMode === 'stats' && (
        <StatisticsSection people={people} />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}

// ============================================================================
// STATISTICS SECTION
// ============================================================================

interface StatisticsSectionProps {
  people: Person[]
}

function StatisticsSection({ people }: StatisticsSectionProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [participationData, setParticipationData] = useState<{ name: string; fullName: string; eleves: number; encadrants: number; total: number }[]>([])
  const [progressData, setProgressData] = useState<Record<string, { validated: number; inProgress: number; notStarted: number }>>({})
  const [loading, setLoading] = useState(true)

  // Créer un map des encadrants pour lookup rapide
  const encadrantIds = new Set(people.filter(p => p.default_is_encadrant).map(p => p.id))

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
      
      // Charger les participations par session (10 plus récentes) - différencier élèves et encadrants
      const participationPromises = sortedSessions.slice(-10).map(async (session) => {
        try {
          const res = await questionnairesApi.list(session.id)
          const encadrantsCount = res.data.filter(q => encadrantIds.has(q.person_id)).length
          const elevesCount = res.data.length - encadrantsCount
          return {
            name: session.name.length > 12 ? session.name.substring(0, 12) + '...' : session.name,
            fullName: session.name,
            eleves: elevesCount,
            encadrants: encadrantsCount,
            total: res.data.length
          }
        } catch {
          return { name: session.name, fullName: session.name, eleves: 0, encadrants: 0, total: 0 }
        }
      })
      const participations = await Promise.all(participationPromises)
      setParticipationData(participations)

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
      
      setProgressData(progressByLevel)
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
    const encadrants = people.filter(p => p.default_is_encadrant).length
    const eleves = people.filter(p => !p.default_is_encadrant).length
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

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-500">Chargement des statistiques...</p>
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
          <div className="text-3xl font-bold">{people.filter(p => p.default_is_encadrant).length}</div>
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
        {/* Élèves par niveau préparé */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">👨‍🎓 Élèves par niveau préparé</h3>
          <ResponsiveContainer width="100%" height={300}>
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
          </ResponsiveContainer>
        </div>

        {/* Répartition Encadrants / Élèves */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">👥 Répartition des membres</h3>
          <ResponsiveContainer width="100%" height={300}>
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
          </ResponsiveContainer>
        </div>

        {/* Niveaux actuels des membres */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">🤿 Niveaux actuels des membres</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={currentLevelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="level" type="category" width={60} />
              <Tooltip formatter={(value: number) => [value, 'Membres']} />
              <Bar dataKey="count" fill="#10B981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Participations aux fosses - élèves vs encadrants */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">📅 Participations aux dernières fosses</h3>
          {participationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={participationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} fontSize={10} />
                <YAxis allowDecimals={false} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length > 0) {
                      const data = payload[0].payload as { name: string; fullName: string; eleves: number; encadrants: number; total: number }
                      return (
                        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                          <p className="font-semibold text-gray-900 mb-2">📅 {data.fullName}</p>
                          <p className="text-green-600">👨‍🎓 Élèves : {data.eleves}</p>
                          <p className="text-blue-600">👨‍🏫 Encadrants : {data.encadrants}</p>
                          <p className="text-gray-700 font-medium border-t mt-2 pt-2">Total : {data.total}</p>
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
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              Aucune donnée de participation disponible
            </div>
          )}
        </div>
      </div>

      {/* Progression des compétences par niveau */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">📈 Progression des compétences par niveau</h3>
        <ResponsiveContainer width="100%" height={350}>
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
        </ResponsiveContainer>
        <p className="text-sm text-gray-500 mt-2 text-center">
          Agrégation des compétences des élèves préparant chaque niveau
        </p>
      </div>

      {/* Tableau détaillé par niveau */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">📋 Détail par niveau</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Niveau</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Élèves en préparation</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Membres avec ce niveau</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {LEVEL_ORDER.map((level) => {
              const preparing = people.filter(p => p.preparing_level === level).length
              const current = people.filter(p => p.diving_level_display === level).length
              return (
                <tr key={level} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                      {level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {LEVEL_NAMES[level] || level}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {preparing > 0 ? (
                      <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-sm">
                        {preparing} 👨‍🎓
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {current > 0 ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                        {current} 🤿
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
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
