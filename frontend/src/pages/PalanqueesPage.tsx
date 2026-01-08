import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
  palanqueesApi, 
  sessionsApi,
  SessionPalanquees, 
  Rotation, 
  Palanquee, 
  PalanqueeMember,
  UnassignedParticipant,
  Session
} from '../lib/api'

const ROLES = [
  { value: 'E', label: 'Encadrant' },
  { value: 'GP', label: 'Guide de Palanquée' },
  { value: 'P', label: 'Plongeur' },
]

const GAS_TYPES = ['Air', 'Nitrox', 'Trimix', 'Heliox']

export default function PalanqueesPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [session, setSession] = useState<Session | null>(null)
  const [data, setData] = useState<SessionPalanquees | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Modal states
  const [showFicheModal, setShowFicheModal] = useState(false)
  const [ficheOptions, setFicheOptions] = useState({
    date: '',
    club: '',
    directeur_plongee: '',
    site: '',
    position: '',
    securite_surface: '',
    observations: '',
  })
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (sessionId) {
      loadData()
    }
  }, [sessionId])

  const loadData = async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const [sessionRes, palanqueesRes] = await Promise.all([
        sessionsApi.get(sessionId),
        palanqueesApi.getSessionPalanquees(sessionId),
      ])
      setSession(sessionRes.data)
      setData(palanqueesRes.data)
      // Pré-remplir les options de la fiche
      setFicheOptions(prev => ({
        ...prev,
        site: sessionRes.data.location || '',
        date: sessionRes.data.start_date || '',
      }))
      setError(null)
    } catch (err) {
      setError('Erreur lors du chargement des données')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRotation = async () => {
    if (!sessionId) return
    try {
      await palanqueesApi.createRotation(sessionId)
      loadData()
    } catch (err) {
      console.error('Erreur création rotation:', err)
    }
  }

  const handleDeleteRotation = async (id: string) => {
    if (!confirm('Supprimer cette rotation et toutes ses palanquées ?')) return
    try {
      await palanqueesApi.deleteRotation(id)
      loadData()
    } catch (err) {
      console.error('Erreur suppression rotation:', err)
    }
  }

  const handleCreatePalanquee = async (rotationId: string) => {
    try {
      await palanqueesApi.createPalanquee(rotationId)
      loadData()
    } catch (err) {
      console.error('Erreur création palanquée:', err)
    }
  }

  const handleDeletePalanquee = async (id: string) => {
    if (!confirm('Supprimer cette palanquée ?')) return
    try {
      await palanqueesApi.deletePalanquee(id)
      loadData()
    } catch (err) {
      console.error('Erreur suppression palanquée:', err)
    }
  }

  const handleAddMember = async (
    palanqueeId: string, 
    participant: UnassignedParticipant
  ) => {
    const role = participant.is_encadrant ? 'E' : 'P'
    const gasType = (participant.wants_nitrox || participant.nitrox_training) ? 'Nitrox' : 'Air'
    try {
      await palanqueesApi.addMember(palanqueeId, participant.questionnaire_id, role, gasType)
      loadData()
    } catch (err) {
      console.error('Erreur ajout membre:', err)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      await palanqueesApi.removeMember(memberId)
      loadData()
    } catch (err) {
      console.error('Erreur suppression membre:', err)
    }
  }

  const handleUpdateMember = async (
    memberId: string, 
    role?: string, 
    gasType?: string
  ) => {
    try {
      await palanqueesApi.updateMember(memberId, role, gasType)
      loadData()
    } catch (err) {
      console.error('Erreur mise à jour membre:', err)
    }
  }

  const handleUpdatePalanquee = async (
    palanqueeId: string, 
    field: string, 
    value: string | number | undefined
  ) => {
    try {
      await palanqueesApi.updatePalanquee(palanqueeId, { [field]: value })
      loadData()
    } catch (err) {
      console.error('Erreur mise à jour palanquée:', err)
    }
  }

  const handleDownloadFiche = async () => {
    if (!sessionId) return
    setDownloading(true)
    try {
      const res = await palanqueesApi.downloadFicheSecurite(sessionId, ficheOptions)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Fiche_Securite_${session?.name || sessionId}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
      setShowFicheModal(false)
    } catch (err) {
      console.error('Erreur téléchargement PDF:', err)
      alert('Erreur lors du téléchargement du PDF')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="text-red-400 text-xl">{error || 'Données non disponibles'}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Header */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">🤿 Palanquées</h1>
              <p className="text-slate-300">
                {session?.name} - Organiser les plongeurs en palanquées
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to={`/sessions/${sessionId}`}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
              >
                ← Retour
              </Link>
              <button
                onClick={() => setShowFicheModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2"
              >
                📄 Fiche de Sécurité
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Participants non assignés */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              👥 Non assignés
              <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full text-sm">
                {data.unassigned_participants.length}
              </span>
            </h2>
            
            {data.unassigned_participants.length === 0 ? (
              <p className="text-slate-400 text-sm">Tous les participants sont assignés !</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {data.unassigned_participants.map(p => (
                  <ParticipantCard
                    key={p.questionnaire_id}
                    participant={p}
                    rotations={data.rotations}
                    onAssign={handleAddMember}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Rotations et Palanquées */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Bouton ajouter rotation */}
            <div className="flex justify-end">
              <button
                onClick={handleCreateRotation}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors flex items-center gap-2"
              >
                ➕ Ajouter une rotation
              </button>
            </div>

            {data.rotations.length === 0 ? (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-8 border border-slate-700 text-center">
                <p className="text-slate-400 mb-4">Aucune rotation créée</p>
                <p className="text-slate-500 text-sm">
                  Créez une rotation, puis des palanquées pour organiser les plongeurs.
                </p>
              </div>
            ) : (
              data.rotations.map(rotation => (
                <RotationCard
                  key={rotation.id}
                  rotation={rotation}
                  onCreatePalanquee={handleCreatePalanquee}
                  onDeleteRotation={handleDeleteRotation}
                  onDeletePalanquee={handleDeletePalanquee}
                  onRemoveMember={handleRemoveMember}
                  onUpdateMember={handleUpdateMember}
                  onUpdatePalanquee={handleUpdatePalanquee}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal Fiche de Sécurité */}
      {showFicheModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg shadow-xl max-w-lg w-full p-6 border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">📄 Générer Fiche de Sécurité</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
                  <input
                    type="date"
                    value={ficheOptions.date}
                    onChange={e => setFicheOptions(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Club</label>
                  <input
                    type="text"
                    value={ficheOptions.club}
                    onChange={e => setFicheOptions(prev => ({ ...prev, club: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    placeholder="PALME Issoire"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Directeur de Plongée</label>
                <input
                  type="text"
                  value={ficheOptions.directeur_plongee}
                  onChange={e => setFicheOptions(prev => ({ ...prev, directeur_plongee: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Site</label>
                  <input
                    type="text"
                    value={ficheOptions.site}
                    onChange={e => setFicheOptions(prev => ({ ...prev, site: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Position GPS</label>
                  <input
                    type="text"
                    value={ficheOptions.position}
                    onChange={e => setFicheOptions(prev => ({ ...prev, position: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Sécurité Surface</label>
                <input
                  type="text"
                  value={ficheOptions.securite_surface}
                  onChange={e => setFicheOptions(prev => ({ ...prev, securite_surface: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Observations</label>
                <textarea
                  value={ficheOptions.observations}
                  onChange={e => setFicheOptions(prev => ({ ...prev, observations: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  rows={2}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowFicheModal(false)}
                className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDownloadFiche}
                disabled={downloading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                {downloading ? 'Génération...' : '📥 Télécharger PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ COMPOSANTS ============

function ParticipantCard({
  participant,
  rotations,
  onAssign,
}: {
  participant: UnassignedParticipant
  rotations: Rotation[]
  onAssign: (palanqueeId: string, participant: UnassignedParticipant) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  
  return (
    <div className="relative">
      <div
        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
          participant.is_encadrant
            ? 'bg-purple-900/30 border-purple-700 hover:bg-purple-900/50'
            : 'bg-slate-700/50 border-slate-600 hover:bg-slate-700'
        }`}
        onClick={() => setShowMenu(!showMenu)}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium">
              {participant.last_name.toUpperCase()} {participant.first_name}
            </p>
            <p className="text-slate-400 text-sm">
              {participant.diving_level || 'Niveau ?'}
              {participant.preparing_level && ` → ${participant.preparing_level}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {participant.is_encadrant && (
              <span className="text-purple-400 text-xs">E</span>
            )}
            {(participant.wants_nitrox || participant.nitrox_training) && (
              <span className="text-yellow-400 text-xs">Nx</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Menu d'assignation */}
      {showMenu && rotations.length > 0 && (
        <div className="absolute right-0 top-full mt-1 z-10 bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-2 min-w-[200px]">
          <p className="text-slate-400 text-xs px-2 mb-2">Assigner à :</p>
          {rotations.map(rotation => (
            <div key={rotation.id}>
              <p className="text-slate-500 text-xs px-2 py-1">Rotation {rotation.number}</p>
              {rotation.palanquees.map(palanquee => (
                <button
                  key={palanquee.id}
                  onClick={() => {
                    onAssign(palanquee.id, participant)
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-3 py-1.5 text-slate-200 hover:bg-slate-700 rounded text-sm"
                >
                  Palanquée {palanquee.number}
                  {palanquee.call_sign && ` (${palanquee.call_sign})`}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RotationCard({
  rotation,
  onCreatePalanquee,
  onDeleteRotation,
  onDeletePalanquee,
  onRemoveMember,
  onUpdateMember,
  onUpdatePalanquee,
}: {
  rotation: Rotation
  onCreatePalanquee: (rotationId: string) => void
  onDeleteRotation: (id: string) => void
  onDeletePalanquee: (id: string) => void
  onRemoveMember: (memberId: string) => void
  onUpdateMember: (memberId: string, role?: string, gasType?: string) => void
  onUpdatePalanquee: (palanqueeId: string, field: string, value: string | number | undefined) => void
}) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow border border-slate-700">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          🔄 Rotation {rotation.number}
          <span className="text-slate-400 text-sm font-normal">
            ({rotation.palanquees.reduce((acc, p) => acc + p.members.length, 0)} plongeurs)
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCreatePalanquee(rotation.id)}
            className="px-3 py-1.5 bg-green-600/80 text-white rounded hover:bg-green-600 transition-colors text-sm"
          >
            + Palanquée
          </button>
          <button
            onClick={() => onDeleteRotation(rotation.id)}
            className="px-3 py-1.5 bg-red-600/80 text-white rounded hover:bg-red-600 transition-colors text-sm"
          >
            🗑️
          </button>
        </div>
      </div>
      
      {rotation.palanquees.length === 0 ? (
        <div className="p-6 text-center text-slate-400">
          Aucune palanquée. Cliquez sur "+ Palanquée" pour en créer une.
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {rotation.palanquees.map(palanquee => (
            <PalanqueeCard
              key={palanquee.id}
              palanquee={palanquee}
              onDelete={onDeletePalanquee}
              onRemoveMember={onRemoveMember}
              onUpdateMember={onUpdateMember}
              onUpdatePalanquee={onUpdatePalanquee}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PalanqueeCard({
  palanquee,
  onDelete,
  onRemoveMember,
  onUpdateMember,
  onUpdatePalanquee,
}: {
  palanquee: Palanquee
  onDelete: (id: string) => void
  onRemoveMember: (memberId: string) => void
  onUpdateMember: (memberId: string, role?: string, gasType?: string) => void
  onUpdatePalanquee: (palanqueeId: string, field: string, value: string | number | undefined) => void
}) {
  const [showParams, setShowParams] = useState(false)
  
  return (
    <div className="bg-slate-700/50 rounded-lg border border-slate-600 overflow-hidden">
      {/* Header */}
      <div className="p-3 bg-slate-700/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold">Palanquée {palanquee.number}</span>
          <input
            type="text"
            placeholder="Nom..."
            value={palanquee.call_sign || ''}
            onChange={e => onUpdatePalanquee(palanquee.id, 'call_sign', e.target.value || undefined)}
            className="px-2 py-0.5 bg-slate-600 border border-slate-500 rounded text-white text-sm w-24"
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowParams(!showParams)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded"
            title="Paramètres"
          >
            ⚙️
          </button>
          <button
            onClick={() => onDelete(palanquee.id)}
            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-slate-600 rounded"
            title="Supprimer"
          >
            🗑️
          </button>
        </div>
      </div>
      
      {/* Paramètres (dépliable) */}
      {showParams && (
        <div className="p-3 bg-slate-800/50 border-b border-slate-600 grid grid-cols-2 gap-2 text-sm">
          <div>
            <label className="text-slate-400 text-xs">Heure départ</label>
            <input
              type="time"
              value={palanquee.planned_departure_time || ''}
              onChange={e => onUpdatePalanquee(palanquee.id, 'planned_departure_time', e.target.value || undefined)}
              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs">Prof. prévue (m)</label>
            <input
              type="number"
              value={palanquee.planned_depth || ''}
              onChange={e => onUpdatePalanquee(palanquee.id, 'planned_depth', e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs">Durée prévue (min)</label>
            <input
              type="number"
              value={palanquee.planned_time || ''}
              onChange={e => onUpdatePalanquee(palanquee.id, 'planned_time', e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
            />
          </div>
        </div>
      )}
      
      {/* Membres */}
      <div className="p-3 space-y-2">
        {palanquee.members.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-2">
            Cliquez sur un participant pour l'ajouter
          </p>
        ) : (
          palanquee.members.map(member => (
            <MemberRow
              key={member.id}
              member={member}
              onRemove={onRemoveMember}
              onUpdate={onUpdateMember}
            />
          ))
        )}
      </div>
    </div>
  )
}

function MemberRow({
  member,
  onRemove,
  onUpdate,
}: {
  member: PalanqueeMember
  onRemove: (memberId: string) => void
  onUpdate: (memberId: string, role?: string, gasType?: string) => void
}) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded ${
      member.role === 'E' ? 'bg-purple-900/30' : 'bg-slate-600/30'
    }`}>
      <select
        value={member.role}
        onChange={e => onUpdate(member.id, e.target.value, undefined)}
        className="px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-white text-xs w-14"
      >
        {ROLES.map(r => (
          <option key={r.value} value={r.value}>{r.value}</option>
        ))}
      </select>
      
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm truncate">
          {member.last_name.toUpperCase()} {member.first_name}
        </p>
        <p className="text-slate-400 text-xs">
          {member.diving_level || '?'}
          {member.preparing_level && ` → ${member.preparing_level}`}
        </p>
      </div>
      
      <select
        value={member.gas_type}
        onChange={e => onUpdate(member.id, undefined, e.target.value)}
        className="px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-white text-xs w-16"
      >
        {GAS_TYPES.map(g => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>
      
      <button
        onClick={() => onRemove(member.id)}
        className="p-1 text-red-400 hover:text-red-300 hover:bg-slate-600 rounded"
        title="Retirer"
      >
        ✕
      </button>
    </div>
  )
}

