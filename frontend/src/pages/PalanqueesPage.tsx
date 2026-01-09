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

const MAX_STUDENTS = 4

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
    club: 'USI Plongée',
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
    participant: UnassignedParticipant,
    role: 'GP' | 'P'
  ) => {
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

  const handleDropGP = (palanqueeId: string, rotation: Rotation) => {
    if (draggedParticipant) {
      // Vérifier si l'encadrant est déjà dans cette rotation
      if (draggedParticipant.is_encadrant) {
        const alreadyInRotation = rotation.palanquees.some(p => 
          p.members.some(m => m.questionnaire_id === draggedParticipant.questionnaire_id)
        )
        if (alreadyInRotation) {
          alert('Cet encadrant est déjà assigné à une palanquée dans cette rotation')
          setDraggedParticipant(null)
          return
        }
      }
      handleAddMember(palanqueeId, draggedParticipant, 'GP')
      setDraggedParticipant(null)
    }
  }

  const handleDropStudent = (palanqueeId: string, rotation: Rotation) => {
    if (draggedParticipant) {
      // Vérifier si l'encadrant est déjà dans cette rotation
      if (draggedParticipant.is_encadrant) {
        const alreadyInRotation = rotation.palanquees.some(p => 
          p.members.some(m => m.questionnaire_id === draggedParticipant.questionnaire_id)
        )
        if (alreadyInRotation) {
          alert('Cet encadrant est déjà assigné à une palanquée dans cette rotation')
          setDraggedParticipant(null)
          return
        }
      }
      handleAddMember(palanqueeId, draggedParticipant, 'P')
      setDraggedParticipant(null)
    }
  }

  // Grouper les participants non assignés
  const groupParticipants = (participants: UnassignedParticipant[]) => {
    const encadrants = participants.filter(p => p.is_encadrant)
    const students = participants.filter(p => !p.is_encadrant)
    
    const nitroxTraining = students.filter(p => p.nitrox_training)
    const remainingStudents = students.filter(p => !p.nitrox_training)
    
    const preparingLevels = ['N1', 'N2', 'N3', 'N4']
    const byPreparingLevel: Record<string, UnassignedParticipant[]> = {}
    preparingLevels.forEach(level => {
      byPreparingLevel[level] = remainingStudents.filter(p => p.preparing_level === level)
    })
    
    const others = remainingStudents.filter(
      p => !p.preparing_level || !preparingLevels.includes(p.preparing_level)
    )
    
    return { encadrants, nitroxTraining, byPreparingLevel, others }
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

  const grouped = groupParticipants(data.unassigned_participants)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        
        {/* Header */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-6 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">🤿 Palanquées</h1>
              <p className="text-slate-300">
                {session?.name} — <span className="text-slate-400">Glissez-déposez les participants</span>
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
          
          {/* Participants non assignés - groupés */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow p-4 border border-slate-700 h-fit sticky top-4 max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              👥 Non assignés
              <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full text-sm">
                {data.unassigned_participants.length}
              </span>
            </h2>
            
            {data.unassigned_participants.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">✅ Tous assignés !</p>
            ) : (
              <div className="space-y-4">
                {/* Encadrants */}
                {grouped.encadrants.length > 0 && (
                  <ParticipantGroup
                    title="🏅 Encadrants"
                    participants={grouped.encadrants}
                    color="purple"
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  />
                )}
                
                {/* Formation Nitrox */}
                {grouped.nitroxTraining.length > 0 && (
                  <ParticipantGroup
                    title="⚡ Formation Nitrox"
                    participants={grouped.nitroxTraining}
                    color="yellow"
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  />
                )}
                
                {/* Par niveau préparé */}
                {['N1', 'N2', 'N3', 'N4'].map(level => {
                  const students = grouped.byPreparingLevel[level]
                  if (!students || students.length === 0) return null
                  return (
                    <ParticipantGroup
                      key={level}
                      title={`📘 Prépa ${level}`}
                      participants={students}
                      color="cyan"
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  )
                })}
                
                {/* Autres */}
                {grouped.others.length > 0 && (
                  <ParticipantGroup
                    title="📋 Autres"
                    participants={grouped.others}
                    color="slate"
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  />
                )}
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
                  draggedIsEncadrant={draggedParticipant?.is_encadrant || false}
                  onCreatePalanquee={handleCreatePalanquee}
                  onDeleteRotation={handleDeleteRotation}
                  onDeletePalanquee={handleDeletePalanquee}
                  onDropGP={(palanqueeId) => handleDropGP(palanqueeId, rotation)}
                  onDropStudent={(palanqueeId) => handleDropStudent(palanqueeId, rotation)}
                  onRemoveMember={handleRemoveMember}
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

function ParticipantGroup({
  title,
  participants,
  color,
  onDragStart,
  onDragEnd,
}: {
  title: string
  participants: UnassignedParticipant[]
  color: 'purple' | 'yellow' | 'cyan' | 'slate'
  onDragStart: (p: UnassignedParticipant) => void
  onDragEnd: () => void
}) {
  const colorClasses = {
    purple: 'border-purple-600/50 bg-purple-900/20',
    yellow: 'border-yellow-600/50 bg-yellow-900/20',
    cyan: 'border-cyan-600/50 bg-cyan-900/20',
    slate: 'border-slate-600/50 bg-slate-700/20',
  }

  return (
    <div className={`rounded-lg border p-2 ${colorClasses[color]}`}>
      <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center justify-between">
        {title}
        <span className="text-xs text-slate-500">{participants.length}</span>
      </h3>
      <div className="space-y-1">
        {participants.map(p => (
          <DraggableParticipant
            key={p.questionnaire_id}
            participant={p}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  )
}

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
      className={`p-2 rounded border cursor-grab active:cursor-grabbing transition-all select-none text-sm ${
        participant.is_encadrant
          ? 'bg-purple-900/40 border-purple-600/50 hover:bg-purple-900/60'
          : 'bg-slate-700/40 border-slate-600/50 hover:bg-slate-700/60'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-white truncate">
          {participant.last_name.toUpperCase()} {participant.first_name}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {participant.is_encadrant && (
            <span className="bg-purple-600 text-white text-xs px-1 rounded">E</span>
          )}
          {(participant.wants_nitrox || participant.nitrox_training) && (
            <span className="bg-yellow-600 text-white text-xs px-1 rounded">Nx</span>
          )}
        </div>
      </div>
    </div>
  )
}

function RotationCard({
  rotation,
  isDragging,
  draggedIsEncadrant,
  onCreatePalanquee,
  onDeleteRotation,
  onDeletePalanquee,
  onDropGP,
  onDropStudent,
  onRemoveMember,
}: {
  rotation: Rotation
  isDragging: boolean
  draggedIsEncadrant: boolean
  onCreatePalanquee: (rotationId: string) => void
  onDeleteRotation: (id: string) => void
  onDeletePalanquee: (id: string) => void
  onDropGP: (palanqueeId: string) => void
  onDropStudent: (palanqueeId: string) => void
  onRemoveMember: (memberId: string) => void
}) {
  // Compter les bouteilles par type de gaz
  const allMembers = rotation.palanquees.flatMap(p => p.members)
  const airCount = allMembers.filter(m => m.gas_type === 'Air').length
  const nitroxCount = allMembers.filter(m => m.gas_type === 'Nitrox').length

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-lg shadow border border-slate-700">
      <div className="p-3 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          🔄 Rotation {rotation.number}
          <span className="text-slate-400 text-sm font-normal">
            ({allMembers.length} plongeurs)
          </span>
          {allMembers.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-normal">
              <span className="bg-blue-600/80 text-white px-1.5 py-0.5 rounded">Air: {airCount}</span>
              {nitroxCount > 0 && (
                <span className="bg-yellow-600/80 text-white px-1.5 py-0.5 rounded">Nitrox: {nitroxCount}</span>
              )}
            </span>
          )}
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
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {rotation.palanquees.map(palanquee => (
            <PalanqueeCard
              key={palanquee.id}
              palanquee={palanquee}
              isDragging={isDragging}
              draggedIsEncadrant={draggedIsEncadrant}
              onDelete={onDeletePalanquee}
              onDropGP={onDropGP}
              onDropStudent={onDropStudent}
              onRemoveMember={onRemoveMember}
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
  draggedIsEncadrant,
  onDelete,
  onDropGP,
  onDropStudent,
  onRemoveMember,
}: {
  palanquee: Palanquee
  isDragging: boolean
  draggedIsEncadrant: boolean
  onDelete: (id: string) => void
  onDropGP: (palanqueeId: string) => void
  onDropStudent: (palanqueeId: string) => void
  onRemoveMember: (memberId: string) => void
}) {
  const [gpOver, setGpOver] = useState(false)
  const [studentsOver, setStudentsOver] = useState(false)

  // Séparer GP et élèves
  const gp = palanquee.members.find(m => m.role === 'GP' || m.role === 'E')
  const students = palanquee.members.filter(m => m.role === 'P')
  const canAddStudent = students.length < MAX_STUDENTS

  return (
    <div className="rounded-lg border border-slate-600 bg-slate-700/30 overflow-hidden">
      {/* Header */}
      <div className="p-2 bg-slate-700/60 flex items-center justify-between">
        <span className="text-white font-medium text-sm">
          Palanquée {palanquee.number}
        </span>
        <button
          onClick={() => onDelete(palanquee.id)}
          className="p-1 text-red-400 hover:text-red-300 hover:bg-slate-600 rounded transition-colors"
          title="Supprimer"
        >
          ✕
        </button>
      </div>
      
      {/* Zone GP (Guide de Palanquée) */}
      <div
        onDragOver={e => { e.preventDefault(); if (!gp) setGpOver(true) }}
        onDragLeave={() => setGpOver(false)}
        onDrop={e => { e.preventDefault(); setGpOver(false); if (!gp) onDropGP(palanquee.id) }}
        className={`p-2 border-b border-slate-600 min-h-[44px] transition-colors ${
          gpOver && !gp
            ? 'bg-purple-500/20 border-purple-500'
            : isDragging && !gp && draggedIsEncadrant
            ? 'bg-slate-600/30 border-dashed'
            : ''
        }`}
      >
        <div className="text-xs text-slate-500 mb-1">Guide de Palanquée</div>
        {gp ? (
          <MemberRow
            member={gp}
            isGP
            onRemove={onRemoveMember}
          />
        ) : (
          <div className="text-slate-500 text-xs text-center py-1">
            {isDragging && draggedIsEncadrant ? '↓ Déposez ici' : '—'}
          </div>
        )}
      </div>
      
      {/* Zone Élèves (4 max) */}
      <div
        onDragOver={e => { e.preventDefault(); if (canAddStudent) setStudentsOver(true) }}
        onDragLeave={() => setStudentsOver(false)}
        onDrop={e => { e.preventDefault(); setStudentsOver(false); if (canAddStudent) onDropStudent(palanquee.id) }}
        className={`p-2 space-y-1 min-h-[100px] transition-colors ${
          studentsOver && canAddStudent
            ? 'bg-cyan-500/20'
            : isDragging && canAddStudent && !draggedIsEncadrant
            ? 'bg-slate-600/20'
            : ''
        }`}
      >
        <div className="text-xs text-slate-500 mb-1 flex items-center justify-between">
          <span>Élèves</span>
          <span className={students.length >= MAX_STUDENTS ? 'text-orange-400' : ''}>
            {students.length}/{MAX_STUDENTS}
          </span>
        </div>
        {students.length === 0 ? (
          <div className="text-slate-500 text-xs text-center py-3">
            {isDragging && !draggedIsEncadrant ? '↓ Déposez ici' : 'Aucun élève'}
          </div>
        ) : (
          students.map(member => (
            <MemberRow
              key={member.id}
              member={member}
              onRemove={onRemoveMember}
            />
          ))
        )}
        {students.length > 0 && students.length < MAX_STUDENTS && isDragging && !draggedIsEncadrant && (
          <div className="text-slate-500 text-xs text-center py-1 border border-dashed border-slate-600 rounded">
            ↓ Déposez ici
          </div>
        )}
      </div>
    </div>
  )
}

function MemberRow({
  member,
  isGP,
  onRemove,
}: {
  member: PalanqueeMember
  isGP?: boolean
  onRemove: (memberId: string) => void
}) {
  return (
    <div className={`flex items-center gap-1.5 p-1.5 rounded text-xs ${
      isGP ? 'bg-purple-900/40' : 'bg-slate-600/40'
    }`}>
      {isGP && (
        <span className="bg-purple-600 text-white px-1 rounded text-xs">GP</span>
      )}
      
      <div className="flex-1 min-w-0">
        <p className="text-white truncate">
          {member.last_name.toUpperCase()} {member.first_name}
        </p>
      </div>
      
      <button
        onClick={() => onRemove(member.id)}
        className="p-0.5 text-red-400 hover:text-red-300 rounded"
      >
        ✕
      </button>
    </div>
  )
}
