import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { sessionsApi, SessionSummary } from '@/lib/api'

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
      <div className="min-h-screen bg-slate-700/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-300">Chargement du récapitulatif...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-700/30 flex items-center justify-center p-4">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow-lg p-8 max-w-md w-full text-center">
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

  return (
    <div className="min-h-screen bg-slate-700/30 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">📊 Récapitulatif de Session</h1>
          <p className="text-slate-300">
            Statistiques et liste des participants
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
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
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📦 Bouteilles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Bouteilles Totales" value={summary.total_bottles} icon="🫧" color="blue" subtitle="1 par personne + secours" />
            <StatCard title="Bouteilles Nitrox" value={summary.nitrox_bottles} icon="⚡" color="yellow" />
            <StatCard title="Bouteilles Air" value={summary.air_bottles} icon="💨" color="gray" subtitle="Inclut bloc de secours" />
          </div>
        </div>

        {/* Matériel */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🛠️ Matériel</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
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
          
          {/* Stabs par taille */}
          {summary.stab_sizes.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-3 text-slate-200">📏 Stabs par taille</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {summary.stab_sizes
                  .sort((a, b) => {
                    // Met "Secours" en dernier
                    if (a.size === 'Secours') return 1
                    if (b.size === 'Secours') return -1
                    return a.size.localeCompare(b.size)
                  })
                  .map((stabSize, idx) => (
                    <div
                      key={idx}
                      className="bg-orange-50 rounded-lg p-3 text-center border border-orange-200"
                    >
                      <p className="text-sm font-medium text-slate-200">{stabSize.size}</p>
                      <p className="text-2xl font-bold text-orange-600 mt-1">{stabSize.count}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Encadrants */}
        {summary.participants.filter((p) => p.is_encadrant).length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🏊 Encadrants ({summary.participants.filter((p) => p.is_encadrant).length})</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-purple-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Statut</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-800/50 backdrop-blur-xl divide-y divide-gray-200">
                  {summary.participants
                    .filter((p) => p.is_encadrant)
                    .map((participant, idx) => (
                      <tr key={idx} className={participant.submitted ? 'bg-green-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">
                            {participant.first_name} {participant.last_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-400">{participant.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {participant.submitted ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✅ Soumis
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
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

        {/* Élèves */}
        {summary.participants.filter((p) => !p.is_encadrant).length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">🤿 Élèves ({summary.participants.filter((p) => !p.is_encadrant).length})</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-cyan-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Nom</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">Statut</th>
                  </tr>
                </thead>
                <tbody className="bg-slate-800/50 backdrop-blur-xl divide-y divide-gray-200">
                  {summary.participants
                    .filter((p) => !p.is_encadrant)
                    .map((participant, idx) => (
                      <tr key={idx} className={participant.submitted ? 'bg-green-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-white">
                            {participant.first_name} {participant.last_name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-400">{participant.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {participant.submitted ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✅ Soumis
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
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
      </div>
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
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    orange: 'bg-orange-50 text-orange-600',
    gray: 'bg-slate-700/30 text-slate-300',
  }

  return (
    <div className={`${colorClasses[color as keyof typeof colorClasses]} rounded-lg p-4 shadow`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs opacity-70 mt-1">{subtitle}</p>}
        </div>
        <div className="text-3xl">{icon}</div>
      </div>
    </div>
  )
}

