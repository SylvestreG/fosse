import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { sessionsApi, questionnairesApi, SessionSummary, Session } from '@/lib/api'
import Button from '@/components/Button'
import Toast from '@/components/Toast'

export default function SummaryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (id) {
      loadData(id)
    }
  }, [id])

  const loadData = async (sessionId: string) => {
    try {
      console.log('Loading session:', sessionId)
      const [sessionRes, summaryRes] = await Promise.all([
        sessionsApi.get(sessionId),
        sessionsApi.getSummary(sessionId),
      ])
      
      console.log('Session data:', sessionRes.data)
      console.log('Summary data:', summaryRes.data)
      
      setSession(sessionRes.data)
      setSummary(summaryRes.data)
    } catch (error: any) {
      console.error('Erreur lors du chargement:', error)
      console.error('Error details:', error.response)
      const errorMessage = error.response?.data?.error || error.message || 'Erreur lors du chargement des données'
      setToast({ message: errorMessage, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const exportCSV = async () => {
    if (!id) return
    try {
      const response = await questionnairesApi.listDetail(id)
      const questionnaires = response.data

      // Create CSV content
      const headers = [
        'Nom',
        'Prénom',
        'Email',
        'Encadrant',
        'Nitrox',
        '2ème Reg',
        'Stab',
        'Taille Stab',
        'Voiture',
        'Places',
        'Commentaires',
        'Soumis',
      ]

      const rows = questionnaires.map((q) => [
        q.last_name,
        q.first_name,
        q.email,
        q.is_encadrant ? 'Oui' : 'Non',
        q.wants_nitrox ? 'Oui' : 'Non',
        q.wants_2nd_reg ? 'Oui' : 'Non',
        q.wants_stab ? 'Oui' : 'Non',
        q.stab_size || '',
        q.has_car ? 'Oui' : 'Non',
        q.car_seats?.toString() || '',
        q.comments || '',
        q.submitted_at ? 'Oui' : 'Non',
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
      ].join('\n')

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${session?.name || 'session'}_export.csv`
      link.click()
    } catch (error) {
      console.error('Erreur lors de l\'export:', error)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-slate-200">Chargement...</p>
      </div>
    )
  }

  if (!session || !summary) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Session introuvable</h2>
        <p className="text-slate-300 mb-4">Cette session n'existe pas ou vous n'avez pas accès.</p>
        <Button onClick={() => navigate('/dashboard/sessions')}>
          ← Retour aux sessions
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="secondary" onClick={() => navigate('/dashboard/sessions')}>
            ← Retour aux sessions
          </Button>
          <h1 className="text-3xl font-bold text-white mt-4">{session.name}</h1>
          <p className="text-slate-300">
            {new Date(session.start_date).toLocaleDateString('fr-FR')} • {session.location}
          </p>
        </div>
        <Button onClick={exportCSV}>📥 Exporter CSV</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Plongeurs"
          value={summary.total_questionnaires}
          icon="👥"
          color="blue"
        />
        <StatCard
          title="Encadrants"
          value={summary.encadrants_count}
          icon="🏊"
          color="purple"
        />
        <StatCard
          title="Élèves"
          value={summary.students_count}
          icon="🤿"
          color="cyan"
        />
        <StatCard
          title="Venant d'Issoire"
          value={summary.from_issoire_count}
          icon="🚗"
          color="green"
        />
        <StatCard
          title="Questionnaires Soumis"
          value={`${summary.submitted_count} / ${summary.total_questionnaires}`}
          icon="✅"
          color="green"
          subtitle={summary.total_questionnaires > 0 ? `${Math.round((summary.submitted_count / summary.total_questionnaires) * 100)}%` : '0%'}
        />
      </div>

      {/* Section Bouteilles */}
      {(() => {
        // Calcul des bouteilles avec optimisation si activée
        // En mode optimisation: les élèves font 2 rotations donc on divise par 2 (arrondi sup)
        const studentsAirCount = summary.students_count - summary.nitrox_training_count
        const optimizedStudentBottles = summary.optimization_mode 
          ? Math.ceil(studentsAirCount / 2) 
          : studentsAirCount
        
        // Bouteilles Air = encadrants sans nitrox + élèves optimisés + 1 secours
        const encadrantsAirCount = summary.encadrants_count - summary.nitrox_count
        const optimizedAirBottles = encadrantsAirCount + optimizedStudentBottles + 1
        
        // Total = Nitrox + Air optimisé
        const optimizedTotalBottles = summary.nitrox_bottles + optimizedAirBottles
        
        const savedBottles = summary.optimization_mode ? (summary.total_bottles - optimizedTotalBottles) : 0

        return (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">📦 Bouteilles</h2>
              <div className="flex items-center gap-3">
                {summary.optimization_mode && (
                  <span className="text-sm text-green-400 bg-green-500/20 px-3 py-1 rounded-full border border-green-500/30">
                    🔄 Mode 2 rotations (-{savedBottles} bouteilles)
                  </span>
                )}
                <span className="text-sm text-slate-400 bg-slate-700/50 px-3 py-1 rounded-full">
                  Inclut +1 bloc de secours (Air)
                </span>
              </div>
            </div>
            {summary.optimization_mode && (
              <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-sm text-green-300">
                  <strong>🔄 Optimisation activée :</strong> Les élèves font 2 rotations avec les mêmes blocs, 
                  ce qui réduit le nombre de bouteilles Air nécessaires de {studentsAirCount} à {optimizedStudentBottles}.
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
                value={summary.nitrox_bottles}
                icon="⚡"
                color="yellow"
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
        )
      })()}

      {/* Section Matériel */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">🛠️ Matériel</h2>
          <span className="text-sm text-slate-400 bg-slate-700/50 px-3 py-1 rounded-full">
            Inclut +1 détendeur et +1 stab de secours
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Détendeurs"
            value={summary.regulators_count}
            icon="🫧"
            color="cyan"
            subtitle="Inclut secours"
          />
          <StatCard
            title="2ème Détendeurs"
            value={summary.second_reg_count}
            icon="🔧"
            color="cyan"
          />
          <StatCard
            title="Stabs"
            value={summary.stab_count}
            icon="🦺"
            color="orange"
            subtitle="Inclut secours"
          />
          <StatCard
            title="Véhicules"
            value={`${summary.vehicles_count} (${summary.total_car_seats} places)`}
            icon="🚗"
            color="green"
          />
        </div>
      </div>

      {summary && summary.stab_sizes && summary.stab_sizes.length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-white">🚗 Transport</h2>
          <div className="space-y-2">
            <p className="text-3xl font-bold text-white">{summary.vehicles_count}</p>
            <p className="text-slate-300">Véhicules disponibles</p>
            <p className="text-2xl font-semibold text-cyan-400">{summary.total_car_seats}</p>
            <p className="text-slate-300">Places totales</p>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-white">📊 Taux de Complétion</h2>
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-cyan-300 bg-cyan-500/20 border border-cyan-500/30">
                  Progression
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold inline-block text-cyan-400">
                  {summary.total_questionnaires > 0 ? Math.round((summary.submitted_count / summary.total_questionnaires) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-4 mb-4 text-xs flex rounded bg-slate-700">
              <div
                style={{
                  width: summary.total_questionnaires > 0 ? `${(summary.submitted_count / summary.total_questionnaires) * 100}%` : '0%',
                }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
              ></div>
            </div>
            <p className="text-sm text-slate-300">
              {summary.submitted_count} réponses sur {summary.total_questionnaires} plongeurs
            </p>
          </div>
        </div>
      </div>

      {/* Section Encadrants */}
      {summary && summary.participants && summary.participants.filter(p => p.is_encadrant).length > 0 && (
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-white">
            🏊 Encadrants ({summary.participants.filter(p => p.is_encadrant).length})
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-purple-500/10">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Niveau
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="bg-slate-800/50 backdrop-blur-xl divide-y divide-slate-700">
                {summary.participants.filter(p => p.is_encadrant).map((participant, idx) => (
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

      {/* Section Élèves - Groupés */}
      {summary && summary.participants && (() => {
        const students = summary.participants.filter(p => !p.is_encadrant)
        if (students.length === 0) return null

        // Groupe 1: Formation Nitrox
        const nitroxTrainingStudents = students.filter(p => p.nitrox_training)
        
        // Groupe 2: Par niveau préparé (les élèves pas en formation nitrox)
        const remainingStudents = students.filter(p => !p.nitrox_training)
        const preparingLevels = ['N1', 'N2', 'N3', 'N4']
        const studentsByPreparingLevel: Record<string, typeof students> = {}
        preparingLevels.forEach(level => {
          studentsByPreparingLevel[level] = remainingStudents.filter(p => p.preparing_level === level)
        })
        
        // Groupe 3: Autres (pas de niveau préparé)
        const otherStudents = remainingStudents.filter(p => !p.preparing_level || !preparingLevels.includes(p.preparing_level))

        const StudentTable = ({ participants, headerColor }: { participants: typeof students, headerColor: string }) => (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className={headerColor}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Niveau
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Prépare
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="bg-slate-800/50 backdrop-blur-xl divide-y divide-slate-700">
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

        return (
          <div className="space-y-6">
            {/* Formation Nitrox */}
            {nitroxTrainingStudents.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6">
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
                <div key={level} className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold mb-4 text-white">
                    🎯 Préparation {level} ({levelStudents.length})
                  </h2>
                  <StudentTable participants={levelStudents} headerColor="bg-cyan-500/10" />
                </div>
              )
            })}

            {/* Autres élèves */}
            {otherStudents.length > 0 && (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 text-white">
                  🤿 Autres élèves ({otherStudents.length})
                </h2>
                <StudentTable participants={otherStudents} headerColor="bg-slate-500/10" />
              </div>
            )}
          </div>
        )
      })()}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
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
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6">
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

