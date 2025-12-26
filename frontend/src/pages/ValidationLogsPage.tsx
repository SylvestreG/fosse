import { useEffect, useState } from 'react'
import { skillValidationsApi, ValidationLogEntry } from '@/lib/api'
import Toast from '@/components/Toast'

export default function ValidationLogsPage() {
  const [logs, setLogs] = useState<ValidationLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('')

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = async () => {
    try {
      setLoading(true)
      const res = await skillValidationsApi.getLogs()
      setLogs(res.data)
    } catch (error: any) {
      console.error('Error loading logs:', error)
      setToast({ message: error.response?.data?.error || 'Erreur lors du chargement des logs', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Get unique levels for filter
  const uniqueLevels = [...new Set(logs.map(l => l.diving_level))].sort()

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === '' || 
      log.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.instructor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.skill_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.module_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.domain_name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesLevel = levelFilter === '' || log.diving_level === levelFilter
    
    return matchesSearch && matchesLevel
  })

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
        <span className="ml-3 text-slate-400">Chargement des logs...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">📋 Journal des Validations</h1>
        <p className="text-slate-400 mt-1">Historique de toutes les compétences validées</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg p-4 border border-slate-700/50">
          <div className="text-3xl font-bold text-cyan-400">{logs.length}</div>
          <div className="text-sm text-slate-400">Total validations</div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg p-4 border border-slate-700/50">
          <div className="text-3xl font-bold text-green-400">
            {logs.filter(l => l.is_final).length}
          </div>
          <div className="text-sm text-slate-400">Acquis validés</div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg p-4 border border-slate-700/50">
          <div className="text-3xl font-bold text-amber-400">
            {new Set(logs.map(l => l.student_email)).size}
          </div>
          <div className="text-sm text-slate-400">Élèves concernés</div>
        </div>
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg p-4 border border-slate-700/50">
          <div className="text-3xl font-bold text-purple-400">
            {new Set(logs.map(l => l.instructor_email)).size}
          </div>
          <div className="text-sm text-slate-400">Encadrants actifs</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg p-4 border border-slate-700/50">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="🔍 Rechercher (élève, encadrant, compétence...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div className="sm:w-48">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Tous les niveaux</option>
              {uniqueLevels.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
        </div>
        {filteredLogs.length !== logs.length && (
          <p className="text-sm text-slate-400 mt-2">
            {filteredLogs.length} résultat{filteredLogs.length > 1 ? 's' : ''} sur {logs.length}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg border border-slate-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-700/30 text-left">
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Élève</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Encadrant</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Niveau</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Compétence</th>
                <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase">Étape</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Aucune validation trouvée
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-white font-medium">{formatDate(log.validated_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-white">{log.student_name}</div>
                        <div className="text-xs text-slate-500">{log.student_email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-slate-300">{log.instructor_name}</div>
                        <div className="text-xs text-slate-500">{log.instructor_email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded-full text-xs font-medium border border-cyan-500/30">
                        {log.diving_level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-white text-sm">{log.skill_name}</div>
                        <div className="text-xs text-slate-500">
                          {log.domain_name} › {log.module_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span 
                        className="px-2 py-1 rounded-full text-xs font-medium border"
                        style={{ 
                          backgroundColor: log.stage_color + '20',
                          borderColor: log.stage_color + '50',
                          color: log.stage_color
                        }}
                      >
                        {log.is_final ? '✅' : '🔄'} {log.stage_name}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}

