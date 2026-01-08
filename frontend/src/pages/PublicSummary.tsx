import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { sessionsApi, SessionSummary, ParticipantInfo } from '@/lib/api'

export default function PublicSummary() {
  const { token } = useParams<{ token: string }>()
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      loadSummary(token)
    }
  }, [token])

  const loadSummary = async (summaryToken: string) => {
    try {
      const response = await sessionsApi.getSummaryByToken(summaryToken)
      setSummary(response.data)
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Ce lien de récapitulatif est invalide ou a expiré'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-slate-300">Chargement du récapitulatif...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow-lg p-8 max-w-md w-full text-center border border-slate-700">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-white mb-2">Lien invalide</h1>
          <p className="text-slate-300 mb-4">{error}</p>
          <p className="text-sm text-slate-400">
            Ce lien de récapitulatif a peut-être expiré (valide jusqu'au lendemain de la session).
          </p>
        </div>
      </div>
    )
  }

  if (!summary) {
    return null
  }

  // Calcul des bouteilles avec optimisation si activée
  const studentsAirCount = summary.students_count - summary.nitrox_training_count
  const studentsNitroxCount = summary.nitrox_training_count
  const backupTank = 1

  const studentsAirPlusBackup = studentsAirCount + backupTank
  const optimizedStudentAirPlusBackup = summary.optimization_mode 
    ? Math.ceil(studentsAirPlusBackup / 2) 
    : studentsAirPlusBackup
  const optimizedStudentNitroxBottles = summary.optimization_mode 
    ? Math.ceil(studentsNitroxCount / 2) 
    : studentsNitroxCount

  const encadrantsNitroxCount = summary.nitrox_count
  const optimizedNitroxBottles = encadrantsNitroxCount + optimizedStudentNitroxBottles

  const encadrantsAirCount = summary.encadrants_count - summary.nitrox_count
  const optimizedAirBottles = encadrantsAirCount + optimizedStudentAirPlusBackup

  const optimizedTotalBottles = optimizedNitroxBottles + optimizedAirBottles
  const savedBottles = summary.optimization_mode ? (summary.total_bottles - optimizedTotalBottles) : 0

  // Groupement des élèves
  const students = summary.participants.filter(p => !p.is_encadrant)
  const nitroxTrainingStudents = students.filter(p => p.nitrox_training)
  const remainingStudents = students.filter(p => !p.nitrox_training)
  const preparingLevels = ['N1', 'N2', 'N3', 'N4']
  const studentsByPreparingLevel: Record<string, ParticipantInfo[]> = {}
  preparingLevels.forEach(level => {
    studentsByPreparingLevel[level] = remainingStudents.filter(p => p.preparing_level === level)
  })
  const otherStudents = remainingStudents.filter(p => !p.preparing_level || !preparingLevels.includes(p.preparing_level))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 border border-slate-700">
          <h1 className="text-3xl font-bold text-white mb-2">📊 Récapitulatif de Session</h1>
          <p className="text-slate-300">
            Statistiques et liste des participants
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard title="Total Plongeurs" value={summary.total_questionnaires} icon="👥" color="blue" />
          <StatCard title="Encadrants" value={summary.encadrants_count} icon="🏊" color="purple" />
          <StatCard title="Élèves" value={summary.students_count} icon="🤿" color="cyan" />
          <StatCard title="Venant d'Issoire" value={summary.from_issoire_count} icon="🚗" color="green" />
          <StatCard
            title="Questionnaires Soumis"
            value={`${summary.submitted_count} / ${summary.total_questionnaires}`}
            icon="✅"
            color="green"
            subtitle={
              summary.total_questionnaires > 0
                ? `${Math.round((summary.submitted_count / summary.total_questionnaires) * 100)}%`
                : '0%'
            }
          />
        </div>

        {/* Bouteilles */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">📦 Bouteilles</h2>
            <div className="flex items-center gap-3">
              {summary.optimization_mode && (
                <span className="text-sm text-green-400 bg-green-500/20 px-3 py-1 rounded-full border border-green-500/30">
                  🔄 Mode 2 rotations (-{savedBottles} bouteilles)
                </span>
              )}
              <span className="text-sm text-slate-400 bg-slate-700/50 px-3 py-1 rounded-full">
                Inclut bloc de secours (Air)
              </span>
            </div>
          </div>
          {summary.optimization_mode && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-sm text-green-300">
                <strong>🔄 Optimisation activée :</strong> Les élèves font 2 rotations avec les mêmes blocs. 
                Air (élèves + secours): {studentsAirPlusBackup} → {optimizedStudentAirPlusBackup}, Nitrox: {studentsNitroxCount} → {optimizedStudentNitroxBottles}.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              title="Bouteilles Totales" 
              value={optimizedTotalBottles} 
              icon="🫧" 
              color="blue" 
              subtitle={summary.optimization_mode ? "Optimisé (2 rotations)" : "1 par personne + secours"} 
            />
            <StatCard 
              title="Bouteilles Nitrox" 
              value={optimizedNitroxBottles} 
              icon="⚡" 
              color="yellow" 
              subtitle={summary.optimization_mode && studentsNitroxCount > 0 ? `Élèves: ${studentsNitroxCount} → ${optimizedStudentNitroxBottles}` : undefined}
            />
            <StatCard 
              title="Bouteilles Air" 
              value={optimizedAirBottles} 
              icon="💨" 
              color="gray" 
              subtitle={summary.optimization_mode ? `${savedBottles} économisées` : "Inclut bloc de secours"} 
            />
          </div>
        </div>

        {/* Matériel */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">🛠️ Matériel</h2>
            <span className="text-sm text-slate-400 bg-slate-700/50 px-3 py-1 rounded-full">
              Inclut +1 détendeur et +1 stab de secours
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Détendeurs" value={summary.regulators_count} icon="🫧" color="cyan" subtitle="Inclut secours" />
            <StatCard title="2ème Détendeurs" value={summary.second_reg_count} icon="🔧" color="cyan" />
            <StatCard title="Stabs" value={summary.stab_count} icon="🦺" color="orange" subtitle="Inclut secours" />
            <StatCard
              title="Véhicules"
              value={`${summary.vehicles_count} (${summary.total_car_seats} places)`}
              icon="🚗"
              color="green"
            />
          </div>
        </div>

        {/* Stabs par taille */}
        {summary.stab_sizes && summary.stab_sizes.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4 text-white">🦺 Répartition Tailles Stab</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {summary.stab_sizes.map((size) => (
                <div 
                  key={size.size} 
                  className={`text-center p-4 rounded-lg ${
                    size.size === 'Secours' 
                      ? 'bg-red-500/20 border-2 border-red-500/50' 
                      : 'bg-slate-700/30'
                  }`}
                >
                  <p className="text-2xl font-bold text-white">{size.count}</p>
                  <p className={`text-sm ${
                    size.size === 'Secours' 
                      ? 'text-red-400 font-semibold' 
                      : 'text-slate-300'
                  }`}>
                    {size.size === 'Secours' ? '🚨 Secours' : `Taille ${size.size}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Encadrants */}
        {summary.participants.filter((p) => p.is_encadrant).length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4 text-white">
              🏊 Encadrants ({summary.participants.filter((p) => p.is_encadrant).length})
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-purple-500/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Niveau</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {summary.participants
                    .filter((p) => p.is_encadrant)
                    .map((participant, idx) => (
                      <tr key={idx} className={participant.submitted ? 'bg-green-500/10' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">
                            {participant.first_name} {participant.last_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-400">{participant.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                            {participant.diving_level || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {participant.submitted ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                              ✅ Soumis
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                              ⏳ En attente
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Élèves groupés */}
        {students.length > 0 && (
          <div className="space-y-6">
            {/* Formation Nitrox */}
            {nitroxTrainingStudents.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 border border-slate-700">
                <h2 className="text-xl font-semibold mb-4 text-white">
                  🎓 Formation Nitrox ({nitroxTrainingStudents.length})
                </h2>
                <StudentTable participants={nitroxTrainingStudents} headerColor="bg-yellow-500/10" />
              </div>
            )}

            {/* Élèves par niveau préparé */}
            {preparingLevels.map(level => {
              const levelStudents = studentsByPreparingLevel[level]
              if (levelStudents.length === 0) return null
              return (
                <div key={level} className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 border border-slate-700">
                  <h2 className="text-xl font-semibold mb-4 text-white">
                    🎯 Préparation {level} ({levelStudents.length})
                  </h2>
                  <StudentTable participants={levelStudents} headerColor="bg-cyan-500/10" />
                </div>
              )
            })}

            {/* Autres élèves */}
            {otherStudents.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 border border-slate-700">
                <h2 className="text-xl font-semibold mb-4 text-white">
                  🤿 Autres élèves ({otherStudents.length})
                </h2>
                <StudentTable participants={otherStudents} headerColor="bg-slate-500/10" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StudentTable({ participants, headerColor }: { participants: ParticipantInfo[], headerColor: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-700">
        <thead className={headerColor}>
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nom</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Niveau</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Prépare</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {participants.map((participant, idx) => (
            <tr key={idx} className={participant.submitted ? 'bg-green-500/10' : ''}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-white">
                  {participant.first_name} {participant.last_name}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-slate-400">{participant.email}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  {participant.diving_level || '-'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                {participant.preparing_level ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    🎯 {participant.preparing_level}
                  </span>
                ) : (
                  <span className="text-slate-500">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center">
                {participant.submitted ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                    ✅ Soumis
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    ⏳ En attente
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string | number
  icon: string
  color: string
  subtitle?: string
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    purple: 'bg-purple-500/20 text-purple-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    cyan: 'bg-cyan-500/20 text-cyan-400',
    orange: 'bg-orange-500/20 text-orange-400',
    gray: 'bg-slate-500/20 text-slate-400',
  }

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 border border-slate-700">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-300 mb-1">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`text-4xl p-3 rounded-full ${colorClasses[color] || colorClasses.gray}`}>{icon}</div>
      </div>
    </div>
  )
}
