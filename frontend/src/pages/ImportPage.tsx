import { useEffect, useState } from 'react'
import { sessionsApi, importApi, Session, ImportJob } from '@/lib/api'
import Button from '@/components/Button'
import Toast from '@/components/Toast'

export default function ImportPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportJob | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      const response = await sessionsApi.list()
      setSessions(response.data)
      if (response.data.length > 0) {
        setSelectedSessionId(response.data[0].id)
      }
    } catch (error) {
      setToast({ message: 'Erreur lors du chargement des sessions', type: 'error' })
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !selectedSessionId) {
      setToast({ message: 'Veuillez sélectionner un fichier et une session', type: 'error' })
      return
    }

    setImporting(true)
    try {
      const response = await importApi.importCsv(selectedSessionId, file)
      setImportResult(response.data)
      setToast({ message: 'Import réussi - emails générés!', type: 'success' })
      setFile(null)
    } catch (error) {
      setToast({ message: 'Erreur lors de l\'import', type: 'error' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Import CSV</h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Importer des plongeurs</h2>
          <p className="text-gray-600 mb-4">
            Le fichier CSV doit contenir les colonnes suivantes : first_name, last_name, email, phone (optionnel)
          </p>
        </div>

        <form onSubmit={handleImport} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session
            </label>
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name} ({session.start_date} - {session.end_date})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fichier CSV
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>

          <Button type="submit" disabled={importing || !file || !selectedSessionId}>
            {importing ? 'Import en cours...' : 'Importer'}
          </Button>
        </form>

        {importResult && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-2">Résultat de l'import</h3>
            <div className="space-y-2 text-sm">
              <p>Fichier : {importResult.filename}</p>
              <p>Total de lignes : {importResult.total_rows}</p>
              <p className="text-green-600">Succès : {importResult.success_count}</p>
              <p className="text-red-600">Erreurs : {importResult.error_count}</p>
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Erreurs détaillées :</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {importResult.errors.map((error, idx) => (
                      <li key={idx} className="text-red-600">
                        Ligne {error.row}: {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-blue-800 text-sm">
                ✉️ Les emails ont été générés. Consultez la page <a href="/dashboard/emails" className="font-semibold underline">Emails</a> pour les récupérer et les envoyer.
              </p>
            </div>
          </div>
        )}
      </div>

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

