import { useEffect, useState, DragEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
  palanqueesApi, 
  sessionsApi,
  questionnairesApi,
  sortiesApi,
  SessionPalanquees, 
  Rotation, 
  Palanquee, 
  PalanqueeMember,
  UnassignedParticipant,
  Session,
  SessionSummary,
  QuestionnaireDetail,
  DiveDirector
} from '../lib/api'
import { useAuthStore } from '../lib/auth'

const MAX_STUDENTS = 4
const MAX_GPS = 2

export default function PalanqueesPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { email, impersonating, isAdmin } = useAuthStore()
  const [session, setSession] = useState<Session | null>(null)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [data, setData] = useState<SessionPalanquees | null>(null)
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireDetail[]>([])
  const [diveDirectors, setDiveDirectors] = useState<DiveDirector[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draggedParticipant, setDraggedParticipant] = useState<UnassignedParticipant | null>(null)
  
  // Mobile: participant sélectionné pour ajout tactile
  const [selectedParticipant, setSelectedParticipant] = useState<UnassignedParticipant | null>(null)
  
  // L'email de l'utilisateur actuel (impersonnifié ou non)
  const currentEmail = impersonating?.user_email || email
  
  // Déterminer si l'utilisateur peut éditer
  // Peut éditer si: admin (non impersonnifié) OU DP de la session (via questionnaire ou dive_directors pour les sorties)
  const myQuestionnaire = questionnaires.find(q => q.email === currentEmail)
  const isCurrentUserDP = !!(myQuestionnaire?.is_directeur_plongee) || 
    !!(myQuestionnaire && diveDirectors.some(dp => dp.questionnaire_id === myQuestionnaire.id))
  const canEdit = (isAdmin && !impersonating) || isCurrentUserDP
  
  // Modal states
  const [showFicheModal, setShowFicheModal] = useState(false)
  const [ficheOptions, setFicheOptions] = useState({
    date: '',
    club: 'USI Plongée',
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
    
    let hasData = false
    let loadedSession: Session | null = null
    
    // Charger la session
    try {
      const sessionRes = await sessionsApi.get(sessionId)
      loadedSession = sessionRes.data
      setSession(loadedSession)
      setFicheOptions(prev => ({
        ...prev,
        site: sessionRes.data.location || '',
        date: sessionRes.data.start_date || '',
      }))
    } catch (sessionErr: unknown) {
      console.log('Session non accessible:', sessionErr)
      // Continuer même si la session n'est pas accessible
    }
    
    // Charger les palanquées (essentiel pour cette page)
    try {
      const palanqueesRes = await palanqueesApi.getSessionPalanquees(sessionId)
      setData(palanqueesRes.data)
      hasData = true
    } catch (palanqueesErr: unknown) {
      console.log('Palanquées non accessibles:', palanqueesErr)
      setData(null)
    }
    
    // Essayer de charger le summary (peut échouer pour les élèves sans permissions)
    try {
      const summaryRes = await sessionsApi.getSummary(sessionId)
      setSummary(summaryRes.data)
    } catch (summaryErr) {
      console.log('Summary non accessible (permissions limitées)')
      setSummary(null)
    }
    
    // Charger les questionnaires - depuis la sortie si la session en fait partie
    try {
      if (loadedSession?.sortie_id) {
        // Session fait partie d'une sortie - charger les participants de la sortie
        const questionnairesRes = await sortiesApi.getQuestionnaires(loadedSession.sortie_id)
        setQuestionnaires(questionnairesRes.data)
      } else {
        // Session classique (fosse) - charger les questionnaires de la session
        const questionnairesRes = await questionnairesApi.listDetail(sessionId)
        setQuestionnaires(questionnairesRes.data)
      }
    } catch (questErr) {
      // Si l'utilisateur n'a pas les permissions, on continue avec un tableau vide
      // L'utilisateur sera en lecture seule (canEdit = false)
      console.log('Questionnaires non accessibles (permissions limitées)')
      setQuestionnaires([])
    }
    
    // Charger les dive directors (pour les sorties)
    try {
      const dpRes = await sessionsApi.getDiveDirectors(sessionId)
      setDiveDirectors(dpRes.data)
    } catch (dpErr) {
      console.log('Dive directors non accessibles')
      setDiveDirectors([])
    }
    
    if (!hasData) {
      setError('Impossible de charger les palanquées')
    } else {
      setError(null)
    }
    
    setLoading(false)
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

  const handleUpdatePalanqueeParams = async (
    palanqueeId: string,
    params: { planned_time?: number; planned_depth?: number }
  ) => {
    try {
      await palanqueesApi.updatePalanquee(palanqueeId, params)
      loadData()
    } catch (err) {
      console.error('Erreur mise à jour params:', err)
    }
  }

  // Mobile: sélectionner un participant
  const handleSelectParticipant = (participant: UnassignedParticipant) => {
    if (selectedParticipant?.questionnaire_id === participant.questionnaire_id) {
      setSelectedParticipant(null) // Désélectionner si déjà sélectionné
    } else {
      setSelectedParticipant(participant)
    }
  }

  // Mobile: ajouter le participant sélectionné à une palanquée
  const handleTapAddToGP = (palanqueeId: string, rotation: Rotation, currentGPCount: number) => {
    if (!selectedParticipant || currentGPCount >= MAX_GPS) return
    
    // Vérifier si l'encadrant est déjà dans cette rotation
    if (selectedParticipant.is_encadrant) {
      const alreadyInRotation = rotation.palanquees.some(p => 
        p.members.some(m => m.questionnaire_id === selectedParticipant.questionnaire_id)
      )
      if (alreadyInRotation) {
        alert('Cet encadrant est déjà assigné à une palanquée dans cette rotation')
        setSelectedParticipant(null)
        return
      }
    }
    
    handleAddMember(palanqueeId, selectedParticipant, 'GP')
    setSelectedParticipant(null)
  }

  const handleTapAddToStudents = (palanqueeId: string, rotation: Rotation, currentStudentCount: number) => {
    if (!selectedParticipant || currentStudentCount >= MAX_STUDENTS) return
    
    // Vérifier si l'encadrant est déjà dans cette rotation
    if (selectedParticipant.is_encadrant) {
      const alreadyInRotation = rotation.palanquees.some(p => 
        p.members.some(m => m.questionnaire_id === selectedParticipant.questionnaire_id)
      )
      if (alreadyInRotation) {
        alert('Cet encadrant est déjà assigné à une palanquée dans cette rotation')
        setSelectedParticipant(null)
        return
      }
    }
    
    handleAddMember(palanqueeId, selectedParticipant, 'P')
    setSelectedParticipant(null)
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

  const handleDropGP = (palanqueeId: string, rotation: Rotation, currentGPCount: number) => {
    if (draggedParticipant) {
      // Vérifier si on peut encore ajouter un GP
      if (currentGPCount >= MAX_GPS) {
        alert('Cette palanquée a déjà 2 guides de palanquée')
        setDraggedParticipant(null)
        return
      }
      
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
    
    // Formation Nitrox (base)
    const nitroxTraining = students.filter(p => p.nitrox_training && !p.nitrox_confirmed_formation)
    // Formation Nitrox Confirmé
    const nitroxConfirmed = students.filter(p => p.nitrox_confirmed_formation)
    const remainingStudents = students.filter(p => !p.nitrox_training && !p.nitrox_confirmed_formation)
    
    const preparingLevels = ['N1', 'N2', 'N3', 'N4']
    const byPreparingLevel: Record<string, UnassignedParticipant[]> = {}
    preparingLevels.forEach(level => {
      byPreparingLevel[level] = remainingStudents.filter(p => p.preparing_level === level)
    })
    
    const others = remainingStudents.filter(
      p => !p.preparing_level || !preparingLevels.includes(p.preparing_level)
    )
    
    return { encadrants, nitroxTraining, nitroxConfirmed, byPreparingLevel, others }
  }

  if (loading) {
    return (
      <div className="min-h-screen theme-bg-gradient flex items-center justify-center">
        <div className="theme-text text-xl">Chargement...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen theme-bg-gradient p-8">
        <div className="text-red-500 text-xl">{error || 'Données non disponibles'}</div>
      </div>
    )
  }

  const grouped = groupParticipants(data.unassigned_participants)

  return (
    <div className="min-h-screen theme-bg-gradient py-4 sm:py-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
        
        {/* Header */}
        <div className="theme-card p-4 sm:p-6 shadow">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold theme-text mb-1 sm:mb-2">🤿 Palanquées</h1>
              <p className="theme-text-secondary text-sm sm:text-base">
                {session?.name}
                {canEdit ? (
                  <>
                    <span className="theme-text-muted hidden sm:inline"> — Glissez-déposez les participants</span>
                    <span className="text-cyan-500 sm:hidden"> — Touchez pour sélectionner</span>
                  </>
                ) : (
                  <span className="text-yellow-500"> — Lecture seule</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to={session?.sortie_id ? `/dashboard/sorties/${session.sortie_id}` : `/dashboard/sessions`}
                className="px-3 py-1.5 sm:px-4 sm:py-2 theme-btn-secondary rounded-lg transition-colors text-sm sm:text-base"
              >
                ← <span className="hidden sm:inline">Retour</span>
              </Link>
              <button
                onClick={() => setShowFicheModal(true)}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-1 sm:gap-2 text-sm sm:text-base"
              >
                📄 <span className="hidden sm:inline">Fiche de Sécurité</span><span className="sm:hidden">PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile: Bannière participant sélectionné */}
        {selectedParticipant && canEdit && (
          <div className="sm:hidden bg-cyan-600/90 backdrop-blur rounded-lg p-3 flex items-center justify-between gap-2 sticky top-0 z-10 shadow-lg">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-white text-sm font-medium truncate">
                {selectedParticipant.is_encadrant ? '🏅' : '👤'} {selectedParticipant.last_name.toUpperCase()} {selectedParticipant.first_name.charAt(0)}.
              </span>
              {selectedParticipant.is_encadrant && (
                <span className="bg-purple-600 text-white text-xs px-1.5 py-0.5 rounded flex-shrink-0">E</span>
              )}
            </div>
            <button
              onClick={() => setSelectedParticipant(null)}
              className="bg-white/20 text-white px-3 py-1 rounded text-sm hover:bg-white/30 flex-shrink-0"
            >
              ✕ Annuler
            </button>
          </div>
        )}

        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
          
          {/* Participants non assignés - groupés */}
          <div className="theme-card p-3 sm:p-4 shadow h-fit lg:sticky lg:top-4 max-h-[50vh] lg:max-h-[85vh] overflow-y-auto order-2 lg:order-1">
            <h2 className="text-base sm:text-lg font-semibold theme-text mb-2 sm:mb-3 flex items-center gap-2">
              👥 Non assignés
              <span className="theme-bg-input theme-text-secondary px-2 py-0.5 rounded-full text-xs sm:text-sm">
                {data.unassigned_participants.length}
              </span>
            </h2>
            
            {data.unassigned_participants.length === 0 ? (
              <p className="theme-text-muted text-sm text-center py-4">✅ Tous assignés !</p>
            ) : (
              <div className="space-y-4">
                {/* Encadrants */}
                {grouped.encadrants.length > 0 && (
                  <ParticipantGroup
                    title="🏅 Encadrants"
                    participants={grouped.encadrants}
                    color="purple"
                    canEdit={canEdit}
                    selectedParticipant={selectedParticipant}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onSelect={handleSelectParticipant}
                  />
                )}
                
                {/* Formation Nitrox */}
                {grouped.nitroxTraining.length > 0 && (
                  <ParticipantGroup
                    title="⚡ Formation Nitrox"
                    participants={grouped.nitroxTraining}
                    color="yellow"
                    canEdit={canEdit}
                    selectedParticipant={selectedParticipant}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onSelect={handleSelectParticipant}
                  />
                )}
                
                {/* Formation Nitrox Confirmé */}
                {grouped.nitroxConfirmed.length > 0 && (
                  <ParticipantGroup
                    title="🔥 Nitrox Confirmé"
                    participants={grouped.nitroxConfirmed}
                    color="yellow"
                    canEdit={canEdit}
                    selectedParticipant={selectedParticipant}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onSelect={handleSelectParticipant}
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
                      canEdit={canEdit}
                      selectedParticipant={selectedParticipant}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onSelect={handleSelectParticipant}
                    />
                  )
                })}
                
                {/* Autres */}
                {grouped.others.length > 0 && (
                  <ParticipantGroup
                    title="📋 Autres"
                    participants={grouped.others}
                    color="slate"
                    canEdit={canEdit}
                    selectedParticipant={selectedParticipant}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onSelect={handleSelectParticipant}
                  />
                )}
              </div>
            )}
          </div>

          {/* Rotations et Palanquées */}
          <div className="lg:col-span-2 space-y-3 sm:space-y-4 order-1 lg:order-2">
            
            {/* Actions */}
            {canEdit && (
              <div className="flex justify-end">
                <button
                  onClick={handleCreateRotation}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors text-sm sm:text-base"
                >
                  ➕ <span className="hidden sm:inline">Rotation</span><span className="sm:hidden">Rot.</span>
                </button>
              </div>
            )}

            {/* Indicateur des bouteilles disponibles (seulement si summary accessible et pas une sortie) */}
            {summary && !session?.sortie_id && (() => {
              // Calcul identique à SummaryPage pour les bouteilles optimisées
              const studentsAirCount = summary.students_count - summary.nitrox_training_count
              const studentsNitroxCount = summary.nitrox_training_count
              const backupTank = 1
              
              const studentsAirPlusBackup = studentsAirCount + backupTank
              const optimizedStudentAirPlusBackup = session?.optimization_mode 
                ? Math.ceil(studentsAirPlusBackup / 2) 
                : studentsAirPlusBackup
              const optimizedStudentNitroxBottles = session?.optimization_mode 
                ? Math.ceil(studentsNitroxCount / 2) 
                : studentsNitroxCount
              
              const encadrantsNitroxCount = summary.nitrox_count
              const optimizedNitroxBottles = encadrantsNitroxCount + optimizedStudentNitroxBottles
              
              const encadrantsAirCount = summary.encadrants_count - summary.nitrox_count
              const optimizedAirBottles = encadrantsAirCount + optimizedStudentAirPlusBackup

              return (
                <div className="theme-card p-2 sm:p-3 shadow flex flex-wrap items-center gap-2 sm:gap-4">
                  <span className="theme-text-secondary text-xs sm:text-sm">Bouteilles :</span>
                  <span className="bg-blue-600/80 text-white px-1.5 sm:px-2 py-0.5 rounded text-xs sm:text-sm">
                    Air: {optimizedAirBottles}
                  </span>
                  {optimizedNitroxBottles > 0 && (
                    <span className="bg-yellow-600/80 text-white px-1.5 sm:px-2 py-0.5 rounded text-xs sm:text-sm">
                      Nx: {optimizedNitroxBottles}
                    </span>
                  )}
                  {session?.optimization_mode && (
                    <span className="text-green-400 text-xs">🔄 <span className="hidden sm:inline">Mode</span> 2 rot.</span>
                  )}
                </div>
              )
            })()}

            {/* Rotations et palanquées */}
            {data.rotations.length === 0 ? (
              <div className="theme-card p-4 sm:p-8 shadow text-center">
                <p className="theme-text-muted mb-1 sm:mb-2 text-sm sm:text-base">Aucune rotation</p>
                <p className="theme-text-dimmed text-xs sm:text-sm">
                  {canEdit ? 'Créez une rotation puis ajoutez des palanquées.' : 'Aucune palanquée créée pour cette session.'}
                </p>
              </div>
            ) : (
              data.rotations.map(rotation => {
                // Calculer les bouteilles disponibles (valeurs par défaut si pas de summary)
                const availableAir = summary ? (() => {
                  const studentsAirCount = summary.students_count - summary.nitrox_training_count
                  const backupTank = 1
                  const studentsAirPlusBackup = studentsAirCount + backupTank
                  const optimizedStudentAirPlusBackup = session?.optimization_mode 
                    ? Math.ceil(studentsAirPlusBackup / 2) 
                    : studentsAirPlusBackup
                  const encadrantsAirCount = summary.encadrants_count - summary.nitrox_count
                  return encadrantsAirCount + optimizedStudentAirPlusBackup
                })() : 999 // Valeur haute pour ne pas bloquer l'affichage
                
                const availableNitrox = summary ? (() => {
                  const studentsNitroxCount = summary.nitrox_training_count
                  const optimizedStudentNitroxBottles = session?.optimization_mode 
                    ? Math.ceil(studentsNitroxCount / 2) 
                    : studentsNitroxCount
                  return summary.nitrox_count + optimizedStudentNitroxBottles
                })() : 999

                return (
                  <RotationCard
                    key={rotation.id}
                    rotation={rotation}
                    isDragging={!!draggedParticipant && canEdit}
                    draggedIsEncadrant={draggedParticipant?.is_encadrant || false}
                    selectedParticipant={selectedParticipant}
                    availableAir={availableAir}
                    availableNitrox={availableNitrox}
                    isSortie={!!session?.sortie_id}
                    canEdit={canEdit}
                    onCreatePalanquee={handleCreatePalanquee}
                    onDeleteRotation={handleDeleteRotation}
                    onDeletePalanquee={handleDeletePalanquee}
                    onDropGP={(palanqueeId, gpCount) => handleDropGP(palanqueeId, rotation, gpCount)}
                    onDropStudent={(palanqueeId) => handleDropStudent(palanqueeId, rotation)}
                    onTapAddGP={(palanqueeId, gpCount) => handleTapAddToGP(palanqueeId, rotation, gpCount)}
                    onTapAddStudent={(palanqueeId, studentCount) => handleTapAddToStudents(palanqueeId, rotation, studentCount)}
                    onRemoveMember={handleRemoveMember}
                    onUpdateParams={handleUpdatePalanqueeParams}
                  />
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Modal Fiche de Sécurité */}
      {showFicheModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="theme-modal-bg rounded-lg shadow-xl max-w-lg w-full p-4 sm:p-6 border theme-border max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold theme-text mb-3 sm:mb-4">📄 Fiche de Sécurité</h3>
            
            <div className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium theme-text-secondary mb-1">Date</label>
                  <input
                    type="date"
                    value={ficheOptions.date}
                    onChange={e => setFicheOptions(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 theme-bg-input rounded-lg theme-text text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium theme-text-secondary mb-1">Club</label>
                  <input
                    type="text"
                    value={ficheOptions.club}
                    onChange={e => setFicheOptions(prev => ({ ...prev, club: e.target.value }))}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 theme-bg-input rounded-lg theme-text text-sm"
                    placeholder="PALME Issoire"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium theme-text-secondary mb-1">Site</label>
                  <input
                    type="text"
                    value={ficheOptions.site}
                    onChange={e => setFicheOptions(prev => ({ ...prev, site: e.target.value }))}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 theme-bg-input rounded-lg theme-text text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium theme-text-secondary mb-1">Position</label>
                  <input
                    type="text"
                    value={ficheOptions.position}
                    onChange={e => setFicheOptions(prev => ({ ...prev, position: e.target.value }))}
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 theme-bg-input rounded-lg theme-text text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-medium theme-text-secondary mb-1">Sécurité Surface</label>
                <input
                  type="text"
                  value={ficheOptions.securite_surface}
                  onChange={e => setFicheOptions(prev => ({ ...prev, securite_surface: e.target.value }))}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 theme-bg-input rounded-lg theme-text text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-medium theme-text-secondary mb-1">Observations</label>
                <textarea
                  value={ficheOptions.observations}
                  onChange={e => setFicheOptions(prev => ({ ...prev, observations: e.target.value }))}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 theme-bg-input rounded-lg theme-text text-sm"
                  rows={2}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 sm:gap-3 mt-4 sm:mt-6">
              <button
                onClick={() => setShowFicheModal(false)}
                className="px-3 py-1.5 sm:px-4 sm:py-2 theme-btn-secondary rounded-lg transition-colors text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleDownloadFiche}
                disabled={downloading}
                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 text-sm"
              >
                {downloading ? '...' : '📥 PDF'}
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
  canEdit,
  selectedParticipant,
  onDragStart,
  onDragEnd,
  onSelect,
}: {
  title: string
  participants: UnassignedParticipant[]
  color: 'purple' | 'yellow' | 'cyan' | 'slate'
  canEdit: boolean
  selectedParticipant: UnassignedParticipant | null
  onDragStart: (p: UnassignedParticipant) => void
  onDragEnd: () => void
  onSelect: (p: UnassignedParticipant) => void
}) {
  const colorClasses = {
    purple: 'border-purple-600/50 bg-purple-900/20 dark:bg-purple-900/20 light:bg-purple-100/50',
    yellow: 'border-yellow-600/50 bg-yellow-900/20 dark:bg-yellow-900/20 light:bg-yellow-100/50',
    cyan: 'border-cyan-600/50 bg-cyan-900/20 dark:bg-cyan-900/20 light:bg-cyan-100/50',
    slate: 'border-slate-600/50 bg-slate-700/20 dark:bg-slate-700/20 light:bg-gray-100/50',
  }

  return (
    <div className={`rounded-lg border p-1.5 sm:p-2 ${colorClasses[color]}`}>
      <h3 className="text-xs sm:text-sm font-medium theme-text-secondary mb-1.5 sm:mb-2 flex items-center justify-between">
        {title}
        <span className="text-xs theme-text-dimmed">{participants.length}</span>
      </h3>
      <div className="space-y-0.5 sm:space-y-1">
        {participants.map(p => (
          <DraggableParticipant
            key={p.questionnaire_id}
            participant={p}
            canEdit={canEdit}
            isSelected={selectedParticipant?.questionnaire_id === p.questionnaire_id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

function DraggableParticipant({
  participant,
  canEdit,
  isSelected,
  onDragStart,
  onDragEnd,
  onSelect,
}: {
  participant: UnassignedParticipant
  canEdit: boolean
  isSelected: boolean
  onDragStart: (p: UnassignedParticipant) => void
  onDragEnd: () => void
  onSelect: (p: UnassignedParticipant) => void
}) {
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    if (!canEdit) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    onDragStart(participant)
  }

  const handleClick = () => {
    if (canEdit) {
      onSelect(participant)
    }
  }

  // Extraire le niveau d'affichage (instructor_level pour encadrants, sinon diving_level le plus haut)
  const displayLevel = participant.is_encadrant 
    ? participant.instructor_level 
    : participant.diving_level?.split(',').filter(l => !l.startsWith('preparing_'))[0]

  return (
    <div
      draggable={canEdit}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={handleClick}
      className={`p-1.5 sm:p-2 rounded border transition-all select-none text-xs sm:text-sm ${
        canEdit ? 'cursor-pointer sm:cursor-grab active:cursor-grabbing' : 'cursor-default'
      } ${
        isSelected
          ? 'bg-cyan-600/60 border-cyan-400 ring-2 ring-cyan-400/50'
          : participant.is_encadrant
          ? 'bg-purple-900/40 border-purple-600/50 hover:bg-purple-900/60 dark:bg-purple-900/40 dark:hover:bg-purple-900/60'
          : 'theme-bg-card border theme-border theme-hover'
      }`}
    >
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        <div className="flex items-center gap-1 min-w-0">
          {displayLevel && (
            <span className={`text-[10px] sm:text-xs px-1 rounded font-medium flex-shrink-0 ${
              participant.is_encadrant ? 'bg-purple-500/30 text-purple-300' : 'bg-cyan-500/30 text-cyan-300'
            }`}>
              {displayLevel}
            </span>
          )}
          <span className="theme-text truncate">
            {participant.last_name.toUpperCase()} {participant.first_name.charAt(0)}.
          </span>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          {participant.is_encadrant && (
            <span className="bg-purple-600 text-white text-[10px] sm:text-xs px-0.5 sm:px-1 rounded">E</span>
          )}
          {(participant.wants_nitrox || participant.nitrox_training || participant.nitrox_confirmed_formation) && (
            <span className="bg-yellow-600 text-white text-[10px] sm:text-xs px-0.5 sm:px-1 rounded">Nx</span>
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
  selectedParticipant,
  availableAir,
  availableNitrox,
  isSortie,
  canEdit,
  onCreatePalanquee,
  onDeleteRotation,
  onDeletePalanquee,
  onDropGP,
  onDropStudent,
  onTapAddGP,
  onTapAddStudent,
  onRemoveMember,
  onUpdateParams,
}: {
  rotation: Rotation
  isDragging: boolean
  draggedIsEncadrant: boolean
  selectedParticipant: UnassignedParticipant | null
  availableAir: number
  availableNitrox: number
  isSortie: boolean
  canEdit: boolean
  onCreatePalanquee: (rotationId: string) => void
  onDeleteRotation: (id: string) => void
  onDeletePalanquee: (id: string) => void
  onDropGP: (palanqueeId: string, gpCount: number) => void
  onDropStudent: (palanqueeId: string) => void
  onTapAddGP: (palanqueeId: string, gpCount: number) => void
  onTapAddStudent: (palanqueeId: string, studentCount: number) => void
  onRemoveMember: (memberId: string) => void
  onUpdateParams: (palanqueeId: string, params: { planned_time?: number; planned_depth?: number }) => void
}) {
  // Compter les bouteilles par type de gaz
  const allMembers = rotation.palanquees.flatMap(p => p.members)
  const airCount = allMembers.filter(m => m.gas_type === 'Air').length
  const nitroxCount = allMembers.filter(m => m.gas_type === 'Nitrox').length

  // Vérifier si on dépasse les bouteilles disponibles
  const airExceeded = airCount > availableAir
  const nitroxExceeded = nitroxCount > availableNitrox

  return (
    <div className={`theme-card shadow ${
      !isSortie && (airExceeded || nitroxExceeded) ? 'border-red-500' : ''
    }`}>
      <div className="p-2 sm:p-3 border-b theme-border">
        <div className="flex items-start sm:items-center justify-between gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 flex-wrap">
            <h3 className="text-sm sm:text-base font-semibold theme-text flex items-center gap-1 sm:gap-2">
              🔄 Rot. {rotation.number}
              <span className="theme-text-muted text-xs sm:text-sm font-normal">
                ({allMembers.length})
              </span>
            </h3>
            {allMembers.length > 0 && !isSortie && (
              <div className="flex items-center gap-1 text-xs font-normal">
                <span className={`px-1 sm:px-1.5 py-0.5 rounded ${
                  airExceeded ? 'bg-red-600 text-white' : 'bg-blue-600/80 text-white'
                }`}>
                  Air: {airCount}/{availableAir}
                </span>
                {(nitroxCount > 0 || availableNitrox > 0) && (
                  <span className={`px-1 sm:px-1.5 py-0.5 rounded ${
                    nitroxExceeded ? 'bg-red-600 text-white' : 'bg-yellow-600/80 text-white'
                  }`}>
                    Nx: {nitroxCount}/{availableNitrox}
                  </span>
                )}
                {(airExceeded || nitroxExceeded) && (
                  <span className="text-red-400 text-xs">⚠️</span>
                )}
              </div>
            )}
          </div>
          {canEdit && (
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => onCreatePalanquee(rotation.id)}
                className="px-2 py-1 sm:px-2.5 bg-green-600/80 text-white rounded hover:bg-green-600 transition-colors text-xs sm:text-sm"
              >
                + <span className="hidden sm:inline">Palanquée</span><span className="sm:hidden">Pal.</span>
              </button>
              <button
                onClick={() => onDeleteRotation(rotation.id)}
                className="p-1 sm:p-1.5 text-red-400 hover:text-red-300 theme-hover rounded transition-colors"
                title="Supprimer rotation"
              >
                🗑️
              </button>
            </div>
          )}
        </div>
      </div>
      
      {rotation.palanquees.length === 0 ? (
        <div className="p-3 sm:p-4 text-center theme-text-dimmed text-xs sm:text-sm">
          <span className="hidden sm:inline">Cliquez sur "+ Palanquée" pour créer une palanquée</span>
          <span className="sm:hidden">+ Pal. pour créer</span>
        </div>
      ) : (
        <div className="p-2 sm:p-3 grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {rotation.palanquees.map(palanquee => (
            <PalanqueeCard
              key={palanquee.id}
              palanquee={palanquee}
              isDragging={isDragging}
              draggedIsEncadrant={draggedIsEncadrant}
              hasSelectedParticipant={!!selectedParticipant}
              selectedIsEncadrant={selectedParticipant?.is_encadrant || false}
              canEdit={canEdit}
              onDelete={onDeletePalanquee}
              onDropGP={onDropGP}
              onDropStudent={onDropStudent}
              onTapAddGP={onTapAddGP}
              onTapAddStudent={onTapAddStudent}
              onRemoveMember={onRemoveMember}
              onUpdateParams={onUpdateParams}
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
  hasSelectedParticipant,
  selectedIsEncadrant,
  canEdit,
  onDelete,
  onDropGP,
  onDropStudent,
  onTapAddGP,
  onTapAddStudent,
  onRemoveMember,
  onUpdateParams,
}: {
  palanquee: Palanquee
  isDragging: boolean
  draggedIsEncadrant: boolean
  hasSelectedParticipant: boolean
  selectedIsEncadrant: boolean
  canEdit: boolean
  onDelete: (id: string) => void
  onDropGP: (palanqueeId: string, gpCount: number) => void
  onDropStudent: (palanqueeId: string) => void
  onTapAddGP: (palanqueeId: string, gpCount: number) => void
  onTapAddStudent: (palanqueeId: string, studentCount: number) => void
  onRemoveMember: (memberId: string) => void
  onUpdateParams: (palanqueeId: string, params: { planned_time?: number; planned_depth?: number }) => void
}) {
  const [gpOver, setGpOver] = useState(false)
  const [studentsOver, setStudentsOver] = useState(false)
  const [showParams, setShowParams] = useState(false)
  const [localParams, setLocalParams] = useState({
    planned_time: palanquee.planned_time?.toString() || '',
    planned_depth: palanquee.planned_depth?.toString() || '',
  })

  // Séparer GP et élèves - maintenant on peut avoir jusqu'à 2 GP
  const gps = palanquee.members.filter(m => m.role === 'GP' || m.role === 'E')
  const students = palanquee.members.filter(m => m.role === 'P')
  const canAddGP = gps.length < MAX_GPS
  const canAddStudent = students.length < MAX_STUDENTS

  const hasParams = palanquee.planned_time || palanquee.planned_depth

  const handleSaveParams = () => {
    onUpdateParams(palanquee.id, {
      planned_time: localParams.planned_time ? parseInt(localParams.planned_time) : undefined,
      planned_depth: localParams.planned_depth ? parseInt(localParams.planned_depth) : undefined,
    })
    setShowParams(false)
  }

  return (
    <div className="rounded-lg border theme-border theme-bg-card overflow-hidden">
      {/* Header */}
      <div className="p-1.5 sm:p-2 theme-bg-input flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="theme-text font-semibold text-xs sm:text-sm">
            Pal. {palanquee.number}
          </span>
          {canEdit && (
            <button
              onClick={() => setShowParams(!showParams)}
              className={`p-0.5 sm:p-1 rounded transition-colors text-xs ${
                hasParams ? 'text-cyan-400 hover:text-cyan-300' : 'theme-text-muted hover:theme-text-secondary'
              } theme-hover`}
              title="Paramètres prévus"
            >
              ⚙️
            </button>
          )}
          {!canEdit && hasParams && (
            <span className="text-cyan-400 text-[10px]" title="Paramètres définis">⚙️</span>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => onDelete(palanquee.id)}
            className="p-0.5 sm:p-1 text-red-400 hover:text-red-300 hover:bg-slate-600 rounded transition-colors text-xs"
            title="Supprimer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Panneau des paramètres prévus */}
      {showParams && canEdit && (
        <div className="p-2 theme-bg-card border-b theme-border space-y-2">
          <div className="text-[10px] sm:text-xs theme-text-muted font-medium">Params Prévus</div>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[9px] sm:text-[10px] theme-text-dimmed block mb-0.5">Durée (min)</label>
              <input
                type="number"
                value={localParams.planned_time}
                onChange={e => setLocalParams(p => ({ ...p, planned_time: e.target.value }))}
                placeholder="40"
                min="0"
                max="120"
                className="w-full px-1 py-0.5 theme-bg-input rounded text-[10px] sm:text-xs"
              />
            </div>
            <div>
              <label className="text-[9px] sm:text-[10px] theme-text-dimmed block mb-0.5">Prof. (m)</label>
              <input
                type="number"
                value={localParams.planned_depth}
                onChange={e => setLocalParams(p => ({ ...p, planned_depth: e.target.value }))}
                placeholder="20"
                min="0"
                max="60"
                className="w-full px-1 py-0.5 theme-bg-input rounded text-[10px] sm:text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end gap-1">
            <button
              onClick={() => setShowParams(false)}
              className="px-2 py-0.5 theme-text-muted hover:theme-text-secondary text-[10px] sm:text-xs"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveParams}
              className="px-2 py-0.5 bg-cyan-600 text-white rounded hover:bg-cyan-500 text-[10px] sm:text-xs"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Affichage des paramètres prévus (quand définis et panneau fermé) */}
      {hasParams && !showParams && (
        <div className="px-2 py-1 bg-cyan-900/30 border-b theme-border flex items-center gap-2 text-[10px] sm:text-xs text-cyan-300">
          {palanquee.planned_time && (
            <span>⏱️ {palanquee.planned_time}'</span>
          )}
          {palanquee.planned_depth && (
            <span>📏 {palanquee.planned_depth}m</span>
          )}
        </div>
      )}
      
      {/* Zone GP (Guide de Palanquée) - jusqu'à 2 */}
      <div
        onDragOver={e => { if (canEdit && canAddGP) { e.preventDefault(); setGpOver(true) } }}
        onDragLeave={() => setGpOver(false)}
        onDrop={e => { if (canEdit && canAddGP) { e.preventDefault(); setGpOver(false); onDropGP(palanquee.id, gps.length) } }}
        onClick={() => { if (canEdit && canAddGP && hasSelectedParticipant) onTapAddGP(palanquee.id, gps.length) }}
        className={`p-1.5 sm:p-2 border-b theme-border min-h-[36px] sm:min-h-[44px] transition-colors ${
          gpOver && canAddGP && canEdit
            ? 'bg-purple-500/20 border-purple-500'
            : (isDragging && canAddGP && draggedIsEncadrant && canEdit) || (hasSelectedParticipant && canAddGP && selectedIsEncadrant && canEdit)
            ? 'bg-slate-600/30 border-dashed sm:bg-transparent sm:border-solid'
            : ''
        } ${hasSelectedParticipant && canAddGP && canEdit ? 'cursor-pointer sm:cursor-default' : ''}`}
      >
        <div className="text-[10px] sm:text-xs theme-text-dimmed mb-0.5 sm:mb-1 flex items-center justify-between">
          <span>GP</span>
          <span className={gps.length >= MAX_GPS ? 'text-orange-400' : ''}>{gps.length}/{MAX_GPS}</span>
        </div>
        {gps.length > 0 ? (
          <div className="space-y-0.5 sm:space-y-1">
            {gps.map(gp => (
              <MemberRow
                key={gp.id}
                member={gp}
                isGP
                canEdit={canEdit}
                onRemove={onRemoveMember}
              />
            ))}
            {canAddGP && (isDragging && draggedIsEncadrant && canEdit) && (
              <div className="theme-text-dimmed text-[10px] sm:text-xs text-center py-0.5 border border-dashed theme-border rounded hidden sm:block">
                ↓
              </div>
            )}
            {canAddGP && hasSelectedParticipant && selectedIsEncadrant && canEdit && (
              <div className="text-cyan-400 text-[10px] sm:text-xs text-center py-1 border border-dashed border-cyan-500/50 rounded sm:hidden">
                + Ajouter ici
              </div>
            )}
          </div>
        ) : (
          <div className={`text-[10px] sm:text-xs text-center py-0.5 sm:py-1 ${
            hasSelectedParticipant && selectedIsEncadrant && canEdit 
              ? 'text-cyan-400 border border-dashed border-cyan-500/50 rounded sm:border-none sm:theme-text-dimmed' 
              : 'theme-text-dimmed'
          }`}>
            {isDragging && draggedIsEncadrant && canEdit ? '↓' : 
             hasSelectedParticipant && selectedIsEncadrant && canEdit ? <span className="sm:hidden">+ Ajouter ici</span> : '—'}
            <span className="hidden sm:inline">{isDragging && draggedIsEncadrant && canEdit ? '' : '—'}</span>
          </div>
        )}
      </div>
      
      {/* Zone Élèves (4 max) */}
      <div
        onDragOver={e => { if (canEdit && canAddStudent) { e.preventDefault(); setStudentsOver(true) } }}
        onDragLeave={() => setStudentsOver(false)}
        onDrop={e => { if (canEdit && canAddStudent) { e.preventDefault(); setStudentsOver(false); onDropStudent(palanquee.id) } }}
        onClick={() => { if (canEdit && canAddStudent && hasSelectedParticipant) onTapAddStudent(palanquee.id, students.length) }}
        className={`p-1.5 sm:p-2 space-y-0.5 sm:space-y-1 min-h-[70px] sm:min-h-[100px] transition-colors ${
          studentsOver && canAddStudent && canEdit
            ? 'bg-cyan-500/20'
            : (isDragging && canAddStudent && !draggedIsEncadrant && canEdit) || (hasSelectedParticipant && canAddStudent && !selectedIsEncadrant && canEdit)
            ? 'bg-slate-600/20 sm:bg-transparent'
            : ''
        } ${hasSelectedParticipant && canAddStudent && canEdit ? 'cursor-pointer sm:cursor-default' : ''}`}
      >
        <div className="text-[10px] sm:text-xs theme-text-dimmed mb-0.5 sm:mb-1 flex items-center justify-between">
          <span>Élèves</span>
          <span className={students.length >= MAX_STUDENTS ? 'text-orange-400' : ''}>
            {students.length}/{MAX_STUDENTS}
          </span>
        </div>
        {students.length === 0 ? (
          <div className={`text-[10px] sm:text-xs text-center py-2 sm:py-3 ${
            hasSelectedParticipant && !selectedIsEncadrant && canEdit 
              ? 'text-cyan-400 border border-dashed border-cyan-500/50 rounded sm:border-none sm:theme-text-dimmed' 
              : 'theme-text-dimmed'
          }`}>
            {isDragging && !draggedIsEncadrant && canEdit ? '↓' : 
             hasSelectedParticipant && !selectedIsEncadrant && canEdit ? <span className="sm:hidden">+ Ajouter ici</span> : '—'}
            <span className="hidden sm:inline">{isDragging && !draggedIsEncadrant && canEdit ? '' : '—'}</span>
          </div>
        ) : (
          <>
            {students.map(member => (
              <MemberRow
                key={member.id}
                member={member}
                canEdit={canEdit}
                onRemove={onRemoveMember}
              />
            ))}
          </>
        )}
        {students.length > 0 && canAddStudent && isDragging && !draggedIsEncadrant && canEdit && (
          <div className="theme-text-dimmed text-[10px] sm:text-xs text-center py-0.5 sm:py-1 border border-dashed theme-border rounded hidden sm:block">
            ↓
          </div>
        )}
        {students.length > 0 && canAddStudent && hasSelectedParticipant && !selectedIsEncadrant && canEdit && (
          <div className="text-cyan-400 text-[10px] sm:text-xs text-center py-1 border border-dashed border-cyan-500/50 rounded sm:hidden">
            + Ajouter ici
          </div>
        )}
      </div>
    </div>
  )
}

function MemberRow({
  member,
  isGP,
  canEdit,
  onRemove,
}: {
  member: PalanqueeMember
  isGP?: boolean
  canEdit: boolean
  onRemove: (memberId: string) => void
}) {
  // Niveau d'affichage : instructor_level pour GP/E, sinon diving_level
  const displayLevel = isGP || member.is_encadrant
    ? member.instructor_level
    : member.diving_level?.split(',').filter(l => !l.startsWith('preparing_'))[0]
  
  return (
    <div className={`flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 rounded text-[11px] sm:text-xs ${
      isGP ? 'bg-purple-900/40' : 'theme-bg-card'
    }`}>
      {displayLevel && (
        <span className={`px-0.5 sm:px-1 rounded text-[9px] sm:text-[10px] font-medium flex-shrink-0 ${
          isGP ? 'bg-purple-500/30 text-purple-300' : 'bg-cyan-500/30 text-cyan-300'
        }`}>
          {displayLevel}
        </span>
      )}
      {isGP && (
        <span className="bg-purple-600 text-white px-0.5 sm:px-1 rounded text-[10px] sm:text-xs flex-shrink-0">GP</span>
      )}
      
      <div className="flex-1 min-w-0">
        <p className="theme-text truncate font-medium">
          {member.last_name.toUpperCase()} {member.first_name.charAt(0)}.
        </p>
      </div>
      
      {canEdit && (
        <button
          onClick={() => onRemove(member.id)}
          className="p-0.5 text-red-400 hover:text-red-300 rounded flex-shrink-0"
        >
          ✕
        </button>
      )}
    </div>
  )
}
