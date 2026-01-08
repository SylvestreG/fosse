import { useEffect, useState, DragEvent } from 'react'
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
  const [draggedParticipant, setDraggedParticipant] = useState<UnassignedParticipant | null>(null)
  
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

  const handleUpdateMember = async (memberId: string, role?: string, gasType?: string) => {
    try {
      await palanqueesApi.updateMember(memberId, role, gasType)
      loadData()
    } catch (err) {
      console.error('Erreur mise à jour membre:', err)
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

  // Drag & Drop handlers
  const handleDragStart = (participant: UnassignedParticipant) => {
    setDraggedParticipant(participant)
  }

  const handleDragEnd = () => {
    setDraggedParticipant(null)
  }

  const handleDrop = (palanqueeId: string) => {
    if (draggedParticipant) {
      handleAddMember(palanqueeId, draggedParticipant)
      setDraggedParticipant(null)
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
                {session?.name} — <span className="text-slate-400">Glissez-déposez les participants dans les palanquées</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to={`/dashboard/sessions`}
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
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-4 border border-slate-700 h-fit sticky top-4">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              👥 Non assignés
              <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full text-sm">
                {data.unassigned_participants.length}
              </span>
            </h2>
            
            {data.unassigned_participants.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">✅ Tous assignés !</p>
            ) : (
              <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
                {data.unassigned_participants.map(p => (
                  <DraggableParticipant
                    key={p.questionnaire_id}
                    participant={p}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Rotations et Palanquées */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Actions */}
            <div className="flex justify-end">
              <button
                onClick={handleCreateRotation}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors"
              >
                ➕ Rotation
              </button>
            </div>

            {data.rotations.length === 0 ? (
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-8 border border-slate-700 text-center">
                <p className="text-slate-400 mb-2">Aucune rotation</p>
                <p className="text-slate-500 text-sm">
                  Créez une rotation puis ajoutez des palanquées.
                </p>
              </div>
            ) : (
              data.rotations.map(rotation => (
                <RotationCard
                  key={rotation.id}
                  rotation={rotation}
                  isDragging={!!draggedParticipant}
                  onCreatePalanquee={handleCreatePalanquee}
                  onDeleteRotation={handleDeleteRotation}
                  onDeletePalanquee={handleDeletePalanquee}
                  onDrop={handleDrop}
                  onRemoveMember={handleRemoveMember}
                  onUpdateMember={handleUpdateMember}
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

function DraggableParticipant({
  participant,
  onDragStart,
  onDragEnd,
}: {
  participant: UnassignedParticipant
  onDragStart: (p: UnassignedParticipant) => void
  onDragEnd: () => void
}) {
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'move'
    onDragStart(participant)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      className={`p-2.5 rounded-lg border cursor-grab active:cursor-grabbing transition-all select-none ${
        participant.is_encadrant
          ? 'bg-purple-900/40 border-purple-600 hover:bg-purple-900/60'
          : 'bg-slate-700/60 border-slate-600 hover:bg-slate-700'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white text-sm font-medium truncate">
            {participant.last_name.toUpperCase()} {participant.first_name}
          </p>
          <p className="text-slate-400 text-xs">
            {participant.diving_level || '?'}
            {participant.preparing_level && ` → ${participant.preparing_level}`}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {participant.is_encadrant && (
            <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded">E</span>
          )}
          {(participant.wants_nitrox || participant.nitrox_training) && (
            <span className="bg-yellow-600 text-white text-xs px-1.5 py-0.5 rounded">Nx</span>
          )}
        </div>
      </div>
    </div>
  )
}

function RotationCard({
  rotation,
  isDragging,
  onCreatePalanquee,
  onDeleteRotation,
  onDeletePalanquee,
  onDrop,
  onRemoveMember,
  onUpdateMember,
}: {
  rotation: Rotation
  isDragging: boolean
  onCreatePalanquee: (rotationId: string) => void
  onDeleteRotation: (id: string) => void
  onDeletePalanquee: (id: string) => void
  onDrop: (palanqueeId: string) => void
  onRemoveMember: (memberId: string) => void
  onUpdateMember: (memberId: string, role?: string, gasType?: string) => void
}) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow border border-slate-700">
      <div className="p-3 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          🔄 Rotation {rotation.number}
          <span className="text-slate-400 text-sm font-normal">
            ({rotation.palanquees.reduce((acc, p) => acc + p.members.length, 0)} plongeurs)
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCreatePalanquee(rotation.id)}
            className="px-2.5 py-1 bg-green-600/80 text-white rounded hover:bg-green-600 transition-colors text-sm"
          >
            + Palanquée
          </button>
          <button
            onClick={() => onDeleteRotation(rotation.id)}
            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded transition-colors"
            title="Supprimer rotation"
          >
            🗑️
          </button>
        </div>
      </div>
      
      {rotation.palanquees.length === 0 ? (
        <div className="p-4 text-center text-slate-500 text-sm">
          Cliquez sur "+ Palanquée" pour créer une palanquée
        </div>
      ) : (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rotation.palanquees.map(palanquee => (
            <PalanqueeCard
              key={palanquee.id}
              palanquee={palanquee}
              isDragging={isDragging}
              onDelete={onDeletePalanquee}
              onDrop={onDrop}
              onRemoveMember={onRemoveMember}
              onUpdateMember={onUpdateMember}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PalanqueeCard({
  palanquee,
  isDragging,
  onDelete,
  onDrop,
  onRemoveMember,
  onUpdateMember,
}: {
  palanquee: Palanquee
  isDragging: boolean
  onDelete: (id: string) => void
  onDrop: (palanqueeId: string) => void
  onRemoveMember: (memberId: string) => void
  onUpdateMember: (memberId: string, role?: string, gasType?: string) => void
}) {
  const [isOver, setIsOver] = useState(false)

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setIsOver(true)
  }

  const handleDragLeave = () => {
    setIsOver(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsOver(false)
    onDrop(palanquee.id)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-lg border-2 transition-all ${
        isOver
          ? 'border-green-500 bg-green-500/10'
          : isDragging
          ? 'border-dashed border-slate-500 bg-slate-700/30'
          : 'border-slate-600 bg-slate-700/50'
      }`}
    >
      {/* Header */}
      <div className="p-2 bg-slate-700/60 rounded-t-lg flex items-center justify-between">
        <span className="text-white font-medium text-sm">
          P{palanquee.number}
          <span className="text-slate-400 ml-1">({palanquee.members.length})</span>
        </span>
        <button
          onClick={() => onDelete(palanquee.id)}
          className="p-1 text-red-400 hover:text-red-300 hover:bg-slate-600 rounded transition-colors"
          title="Supprimer"
        >
          ✕
        </button>
      </div>
      
      {/* Membres */}
      <div className="p-2 space-y-1 min-h-[60px]">
        {palanquee.members.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-3">
            {isDragging ? '↓ Déposez ici' : 'Vide'}
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
    <div className={`flex items-center gap-1.5 p-1.5 rounded text-xs ${
      member.role === 'E' ? 'bg-purple-900/40' : 'bg-slate-600/40'
    }`}>
      <select
        value={member.role}
        onChange={e => onUpdate(member.id, e.target.value, undefined)}
        className="px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-white text-xs w-12"
      >
        {ROLES.map(r => (
          <option key={r.value} value={r.value}>{r.value}</option>
        ))}
      </select>
      
      <div className="flex-1 min-w-0">
        <p className="text-white truncate">
          {member.last_name.toUpperCase()} {member.first_name}
        </p>
      </div>
      
      <select
        value={member.gas_type}
        onChange={e => onUpdate(member.id, undefined, e.target.value)}
        className="px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-white text-xs w-14"
      >
        {GAS_TYPES.map(g => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>
      
      <button
        onClick={() => onRemove(member.id)}
        className="p-0.5 text-red-400 hover:text-red-300 rounded"
      >
        ✕
      </button>
    </div>
  )
}
