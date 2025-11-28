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
        <p className="text-xl text-gray-700">Chargement...</p>
      </div>
    )
  }

  if (!session || !summary) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Session introuvable</h2>
        <p className="text-gray-600 mb-4">Cette session n'existe pas ou vous n'avez pas accès.</p>
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
          <h1 className="text-3xl font-bold text-gray-900 mt-4">{session.name}</h1>
          <p className="text-gray-600">
            {new Date(session.start_date).toLocaleDateString('fr-FR')} • {session.location}
          </p>
        </div>
        <Button onClick={exportCSV}>📥 Exporter CSV</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Plongeurs"
          value={summary.total_questionnaires}
          icon="👥"
          color="blue"
        />
        <StatCard
          title="Questionnaires Soumis"
          value={`${summary.submitted_count} / ${summary.total_questionnaires}`}
          icon="✅"
          color="green"
          subtitle={summary.total_questionnaires > 0 ? `${Math.round((summary.submitted_count / summary.total_questionnaires) * 100)}%` : '0%'}
        />
        <StatCard
          title="Encadrants"
          value={summary.encadrants_count}
          icon="🏊"
          color="purple"
        />
      </div>

      {/* Section Bouteilles */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">📦 Bouteilles</h2>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            Inclut +1 bloc de secours (Air)
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Bouteilles Totales"
            value={summary.total_bottles}
            icon="🫧"
            color="blue"
            subtitle="1 par personne + secours"
          />
          <StatCard
            title="Bouteilles Nitrox"
            value={summary.nitrox_bottles}
            icon="⚡"
            color="yellow"
          />
          <StatCard
            title="Bouteilles Air"
            value={summary.air_bottles}
            icon="💨"
            color="gray"
            subtitle="Inclut bloc de secours"
          />
        </div>
      </div>

      {/* Section Matériel */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">🛠️ Matériel</h2>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
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
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">🦺 Répartition Tailles Stab</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {summary.stab_sizes.map((size) => (
              <div 
                key={size.size} 
                className={`text-center p-4 rounded-lg ${
                  size.size === 'Secours' 
                    ? 'bg-red-50 border-2 border-red-300' 
                    : 'bg-gray-50'
                }`}
              >
                <p className="text-2xl font-bold text-gray-900">{size.count}</p>
                <p className={`text-sm ${
                  size.size === 'Secours' 
                    ? 'text-red-600 font-semibold' 
                    : 'text-gray-600'
                }`}>
                  {size.size === 'Secours' ? '🚨 Secours' : `Taille ${size.size}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">🚗 Transport</h2>
          <div className="space-y-2">
            <p className="text-3xl font-bold text-gray-900">{summary.vehicles_count}</p>
            <p className="text-gray-600">Véhicules disponibles</p>
            <p className="text-2xl font-semibold text-blue-600">{summary.total_car_seats}</p>
            <p className="text-gray-600">Places totales</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">📊 Taux de Complétion</h2>
          <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                  Progression
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold inline-block text-blue-600">
                  {summary.total_questionnaires > 0 ? Math.round((summary.submitted_count / summary.total_questionnaires) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-4 mb-4 text-xs flex rounded bg-blue-200">
              <div
                style={{
                  width: summary.total_questionnaires > 0 ? `${(summary.submitted_count / summary.total_questionnaires) * 100}%` : '0%',
                }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600 transition-all duration-500"
              ></div>
            </div>
            <p className="text-sm text-gray-600">
              {summary.submitted_count} réponses sur {summary.total_questionnaires} plongeurs
            </p>
          </div>
        </div>
      </div>

      {/* Section Participants avec Magic Links */}
      {summary && summary.participants && summary.participants.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">🔗 Participants & Magic Links</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Magic Link
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {summary.participants.map((participant, idx) => (
                  <tr key={idx} className={participant.submitted ? 'bg-green-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {participant.first_name} {participant.last_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{participant.email}</div>
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={participant.magic_link}
                          readOnly
                          className="flex-1 text-sm text-gray-600 bg-gray-50 border border-gray-300 rounded px-2 py-1 font-mono text-xs"
                        />
                        <Button
                          variant="secondary"
                          onClick={() => {
                            navigator.clipboard.writeText(participant.magic_link)
                            setToast({ message: 'Lien copié !', type: 'success' })
                          }}
                        >
                          📋
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    orange: 'bg-orange-50 text-orange-600',
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`text-4xl p-3 rounded-full ${colorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  )
}

