import { useEffect, useState } from 'react'
import { sessionsApi, Session } from '@/lib/api'
import Button from '@/components/Button'
import { useNavigate } from 'react-router-dom'

export default function DashboardHome() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      const response = await sessionsApi.list()
      setSessions(response.data)
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Tableau de bord</h1>
        <Button onClick={() => navigate('/dashboard/sessions')}>
          Gérer les sessions
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-lg font-semibold text-slate-300 mb-2">Sessions totales</h3>
          <p className="text-4xl font-bold text-cyan-400">{sessions.length}</p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-lg font-semibold text-slate-300 mb-2">Sessions actives</h3>
          <p className="text-4xl font-bold text-green-400">
            {sessions.filter(s => new Date(s.end_date || s.start_date) >= new Date()).length}
          </p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-lg font-semibold text-slate-300 mb-2">Sessions passées</h3>
          <p className="text-4xl font-bold text-slate-400">
            {sessions.filter(s => new Date(s.end_date || s.start_date) < new Date()).length}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-slate-400">Chargement...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-12 text-center">
          <p className="text-slate-400 mb-4">Aucune session créée</p>
          <Button onClick={() => navigate('/dashboard/sessions')}>
            Créer votre première session
          </Button>
        </div>
      ) : (
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50">
          <div className="px-6 py-4 border-b border-slate-700/50">
            <h2 className="text-xl font-semibold text-white">Sessions récentes</h2>
          </div>
          <div className="p-6 space-y-4">
            {sessions.slice(0, 5).map((session) => (
              <div key={session.id} className="flex justify-between items-center p-4 bg-slate-700/30 rounded-lg border border-slate-600/30">
                <div>
                  <h3 className="font-semibold text-white">{session.name}</h3>
                  <p className="text-sm text-slate-400">
                    {session.start_date} - {session.end_date}
                  </p>
                  {session.location && (
                    <p className="text-sm text-slate-300">{session.location}</p>
                  )}
                </div>
                <Button size="sm" onClick={() => navigate('/dashboard/sessions')}>
                  Voir
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
