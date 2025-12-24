import { useEffect, useState, useRef } from 'react'
import { 
  levelDocumentsApi, 
  skillValidationsApi,
  LevelDocumentInfo, 
  SkillPositionWithInfo,
  SkillPosition,
  CompetencyHierarchy,
} from '@/lib/api'
import Button from '@/components/Button'
import Toast from '@/components/Toast'
import Modal from '@/components/Modal'

const DIVING_LEVELS = ['N1', 'N2', 'N3', 'N4', 'E1', 'E2', 'E3', 'E4']

export default function LevelDocumentsPage() {
  const [documents, setDocuments] = useState<LevelDocumentInfo[]>([])
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const [positions, setPositions] = useState<SkillPositionWithInfo[]>([])
  const [hierarchy, setHierarchy] = useState<CompetencyHierarchy | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showPositionModal, setShowPositionModal] = useState(false)
  const [editingPosition, setEditingPosition] = useState<{
    skillId: string
    skillName: string
    position: SkillPosition | null
  } | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadDocuments()
  }, [])

  useEffect(() => {
    if (selectedLevel) {
      loadPositions(selectedLevel)
      loadHierarchy(selectedLevel)
    }
  }, [selectedLevel])

  const loadDocuments = async () => {
    try {
      const res = await levelDocumentsApi.list()
      setDocuments(res.data)
    } catch (error) {
      console.error('Error loading documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPositions = async (level: string) => {
    try {
      const res = await levelDocumentsApi.listPositions(level)
      setPositions(res.data)
    } catch (error) {
      console.error('Error loading positions:', error)
      setPositions([])
    }
  }

  const loadHierarchy = async (level: string) => {
    try {
      // Use a dummy person ID to get the hierarchy structure
      const res = await skillValidationsApi.getMyCompetencies(level)
      setHierarchy(res.data)
    } catch (error) {
      console.error('Error loading hierarchy:', error)
      setHierarchy(null)
    }
  }

  const handleUpload = async (level: string, file: File) => {
    setUploading(true)
    try {
      await levelDocumentsApi.upload(level, file)
      setToast({ message: `Document uploadé pour ${level}`, type: 'success' })
      loadDocuments()
    } catch (error) {
      console.error('Error uploading:', error)
      setToast({ message: 'Erreur lors de l\'upload', type: 'error' })
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (level: string) => {
    try {
      const res = await levelDocumentsApi.download(level)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `template_${level}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading:', error)
      setToast({ message: 'Erreur lors du téléchargement', type: 'error' })
    }
  }

  const handleDelete = async (level: string) => {
    if (!confirm(`Supprimer le document pour ${level} ?`)) return
    
    try {
      await levelDocumentsApi.delete(level)
      setToast({ message: `Document supprimé pour ${level}`, type: 'success' })
      loadDocuments()
      if (selectedLevel === level) {
        setSelectedLevel(null)
        setPositions([])
      }
    } catch (error) {
      console.error('Error deleting:', error)
      setToast({ message: 'Erreur lors de la suppression', type: 'error' })
    }
  }

  const handleSavePosition = async (position: SkillPosition) => {
    if (!selectedLevel) return
    
    try {
      await levelDocumentsApi.setPosition(selectedLevel, position)
      setToast({ message: 'Position enregistrée', type: 'success' })
      loadPositions(selectedLevel)
      setShowPositionModal(false)
      setEditingPosition(null)
    } catch (error) {
      console.error('Error saving position:', error)
      setToast({ message: 'Erreur lors de la sauvegarde', type: 'error' })
    }
  }

  const handleDeletePosition = async (skillId: string) => {
    if (!selectedLevel) return
    
    try {
      await levelDocumentsApi.deletePosition(selectedLevel, skillId)
      setToast({ message: 'Position supprimée', type: 'success' })
      loadPositions(selectedLevel)
    } catch (error) {
      console.error('Error deleting position:', error)
      setToast({ message: 'Erreur lors de la suppression', type: 'error' })
    }
  }

  const getDocForLevel = (level: string) => documents.find(d => d.level === level)
  const getPositionForSkill = (skillId: string) => positions.find(p => p.skill_id === skillId)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">📄 Documents de Compétences</h1>
        <p className="text-slate-400 mt-1">
          Gérez les templates PDF par niveau et définissez les positions des acquis
        </p>
      </div>

      {/* Liste des niveaux */}
      <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Templates par niveau</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {DIVING_LEVELS.map(level => {
            const doc = getDocForLevel(level)
            return (
              <div 
                key={level}
                className={`p-4 rounded-lg border transition-all cursor-pointer ${
                  selectedLevel === level 
                    ? 'bg-cyan-500/20 border-cyan-500/50' 
                    : doc 
                      ? 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20' 
                      : 'bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50'
                }`}
                onClick={() => setSelectedLevel(level)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-white">{level}</span>
                  {doc ? (
                    <span className="text-green-400 text-sm">✓</span>
                  ) : (
                    <span className="text-slate-500 text-sm">—</span>
                  )}
                </div>
                {doc ? (
                  <div className="text-xs text-slate-400">
                    {doc.page_count} page{doc.page_count > 1 ? 's' : ''}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">Aucun document</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Détails du niveau sélectionné */}
      {selectedLevel && (
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">
              Niveau {selectedLevel}
            </h2>
            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(selectedLevel, file)
                }}
              />
              <Button 
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? '...' : getDocForLevel(selectedLevel) ? '🔄 Remplacer' : '📤 Uploader'}
              </Button>
              {getDocForLevel(selectedLevel) && (
                <>
                  <Button variant="secondary" onClick={() => handleDownload(selectedLevel)}>
                    📥 Télécharger
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => handleDelete(selectedLevel)}
                    className="text-red-400 hover:text-red-300"
                  >
                    🗑️
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Liste des positions */}
          {getDocForLevel(selectedLevel) && hierarchy && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white">Positions des acquis</h3>
              <p className="text-sm text-slate-400">
                Définissez les coordonnées (en points PDF) où chaque acquis sera affiché sur le document.
                Les coordonnées (0,0) sont en bas à gauche de la page.
              </p>
              
              {hierarchy.domains.map(domain => (
                <div key={domain.id} className="border border-slate-700 rounded-lg overflow-hidden">
                  <div className="bg-slate-700/30 px-4 py-2">
                    <span className="font-medium text-amber-400">{domain.name}</span>
                  </div>
                  <div className="divide-y divide-slate-700/50">
                    {domain.modules.map(module => (
                      <div key={module.id}>
                        <div className="px-4 py-2 bg-slate-700/20">
                          <span className="text-cyan-300 text-sm">{module.name}</span>
                        </div>
                        <table className="w-full">
                          <thead>
                            <tr className="text-xs text-slate-400 border-b border-slate-700/30">
                              <th className="text-left p-2 pl-4">Acquis</th>
                              <th className="text-center p-2 w-16">Page</th>
                              <th className="text-center p-2 w-16">X</th>
                              <th className="text-center p-2 w-16">Y</th>
                              <th className="text-center p-2 w-16">L</th>
                              <th className="text-center p-2 w-16">H</th>
                              <th className="text-center p-2 w-20">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {module.skills.map((skill, idx) => {
                              const pos = getPositionForSkill(skill.id)
                              return (
                                <tr key={skill.id} className="border-b border-slate-700/20 hover:bg-slate-700/20">
                                  <td className="p-2 pl-4">
                                    <div className="flex items-center gap-2">
                                      <span className="w-5 h-5 bg-cyan-500/20 text-cyan-300 rounded-full flex items-center justify-center text-xs">
                                        {idx + 1}
                                      </span>
                                      <span className="text-sm text-slate-200">{skill.name}</span>
                                    </div>
                                  </td>
                                  {pos ? (
                                    <>
                                      <td className="text-center p-2 text-sm text-slate-300">{pos.page}</td>
                                      <td className="text-center p-2 text-sm text-slate-300">{Math.round(pos.x)}</td>
                                      <td className="text-center p-2 text-sm text-slate-300">{Math.round(pos.y)}</td>
                                      <td className="text-center p-2 text-sm text-slate-300">{Math.round(pos.width)}</td>
                                      <td className="text-center p-2 text-sm text-slate-300">{Math.round(pos.height)}</td>
                                      <td className="text-center p-2">
                                        <div className="flex justify-center gap-1">
                                          <button
                                            onClick={() => {
                                              setEditingPosition({
                                                skillId: skill.id,
                                                skillName: skill.name,
                                                position: {
                                                  skill_id: skill.id,
                                                  page: pos.page,
                                                  x: pos.x,
                                                  y: pos.y,
                                                  width: pos.width,
                                                  height: pos.height,
                                                  font_size: pos.font_size,
                                                }
                                              })
                                              setShowPositionModal(true)
                                            }}
                                            className="text-cyan-400 hover:text-cyan-300 text-sm"
                                          >
                                            ✏️
                                          </button>
                                          <button
                                            onClick={() => handleDeletePosition(skill.id)}
                                            className="text-red-400 hover:text-red-300 text-sm"
                                          >
                                            🗑️
                                          </button>
                                        </div>
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td colSpan={5} className="text-center p-2 text-slate-500 text-sm">
                                        Non défini
                                      </td>
                                      <td className="text-center p-2">
                                        <button
                                          onClick={() => {
                                            setEditingPosition({
                                              skillId: skill.id,
                                              skillName: skill.name,
                                              position: null
                                            })
                                            setShowPositionModal(true)
                                          }}
                                          className="text-cyan-400 hover:text-cyan-300 text-sm"
                                        >
                                          ➕
                                        </button>
                                      </td>
                                    </>
                                  )}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!getDocForLevel(selectedLevel) && (
            <div className="text-center py-8 text-slate-400">
              <p className="mb-4">Aucun document uploadé pour ce niveau</p>
              <Button onClick={() => fileInputRef.current?.click()}>
                📤 Uploader un PDF
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modal d'édition de position */}
      {showPositionModal && editingPosition && (
        <PositionModal
          skillName={editingPosition.skillName}
          initialPosition={editingPosition.position}
          skillId={editingPosition.skillId}
          pageCount={getDocForLevel(selectedLevel!)?.page_count || 1}
          onSave={handleSavePosition}
          onClose={() => {
            setShowPositionModal(false)
            setEditingPosition(null)
          }}
        />
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}

// Modal pour éditer une position
function PositionModal({
  skillName,
  initialPosition,
  skillId,
  pageCount,
  onSave,
  onClose,
}: {
  skillName: string
  initialPosition: SkillPosition | null
  skillId: string
  pageCount: number
  onSave: (position: SkillPosition) => void
  onClose: () => void
}) {
  const [page, setPage] = useState(initialPosition?.page || 1)
  const [x, setX] = useState(initialPosition?.x || 100)
  const [y, setY] = useState(initialPosition?.y || 700)
  const [width, setWidth] = useState(initialPosition?.width || 150)
  const [height, setHeight] = useState(initialPosition?.height || 12)
  const [fontSize, setFontSize] = useState(initialPosition?.font_size || 8)

  return (
    <Modal isOpen={true} onClose={onClose} title="Définir la position">
      <div className="space-y-4">
        <div>
          <label className="text-sm text-slate-300 mb-1 block">Acquis</label>
          <p className="text-white font-medium">{skillName}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-300 mb-1 block">Page</label>
            <select
              value={page}
              onChange={(e) => setPage(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white"
            >
              {Array.from({ length: pageCount }, (_, i) => i + 1).map(p => (
                <option key={p} value={p}>Page {p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1 block">Taille police</label>
            <input
              type="number"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white"
              min={4}
              max={24}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-300 mb-1 block">X (depuis la gauche)</label>
            <input
              type="number"
              value={x}
              onChange={(e) => setX(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white"
              min={0}
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1 block">Y (depuis le bas)</label>
            <input
              type="number"
              value={y}
              onChange={(e) => setY(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white"
              min={0}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-slate-300 mb-1 block">Largeur</label>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white"
              min={10}
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1 block">Hauteur</label>
            <input
              type="number"
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white"
              min={8}
            />
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Les coordonnées sont en points PDF (1 point = 1/72 de pouce).
          Une page A4 fait environ 595 × 842 points.
        </p>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => onSave({
            skill_id: skillId,
            page,
            x,
            y,
            width,
            height,
            font_size: fontSize,
          })}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  )
}

