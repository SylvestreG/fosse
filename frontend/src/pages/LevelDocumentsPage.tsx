import { useEffect, useState, useRef, useCallback } from 'react'
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
import * as pdfjsLib from 'pdfjs-dist'
// @ts-ignore - import worker as raw text
import pdfjsWorkerText from 'pdfjs-dist/build/pdf.worker.min.mjs?raw'

// Create blob URL for worker to avoid MIME type issues
const workerBlob = new Blob([pdfjsWorkerText], { type: 'application/javascript' })
pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob)

const DIVING_LEVELS = ['N1', 'N2', 'N3', 'E1', 'N4', 'E2', 'E3', 'E4']

interface SkillToPlace {
  id: string
  name: string
  moduleName: string
  domainName: string
}

export default function LevelDocumentsPage() {
  const [documents, setDocuments] = useState<LevelDocumentInfo[]>([])
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)
  const [positions, setPositions] = useState<SkillPositionWithInfo[]>([])
  const [hierarchy, setHierarchy] = useState<CompetencyHierarchy | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
  // PDF viewer state
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number } | null>(null)
  const [scale, setScale] = useState(1)
  
  // Placement mode
  const [placementMode, setPlacementMode] = useState(false)
  const [skillToPlace, setSkillToPlace] = useState<SkillToPlace | null>(null)
  
  // Drawing/editing state
  const [isDrawing, setIsDrawing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadDocuments()
  }, [])

  useEffect(() => {
    if (selectedLevel) {
      loadPositions(selectedLevel)
      loadHierarchy(selectedLevel)
      loadPdfData(selectedLevel)
    } else {
      setPdfData(null)
    }
  }, [selectedLevel])

  useEffect(() => {
    if (pdfData) {
      renderPdf()
    }
  }, [pdfData, currentPage, scale])

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
      const res = await skillValidationsApi.getMyCompetencies(level)
      setHierarchy(res.data)
    } catch (error) {
      console.error('Error loading hierarchy:', error)
      setHierarchy(null)
    }
  }

  const loadPdfData = async (level: string) => {
    try {
      const res = await levelDocumentsApi.download(level)
      // Convert Blob to ArrayBuffer for PDF.js
      const arrayBuffer = await res.data.arrayBuffer()
      setPdfData(arrayBuffer)
    } catch (error) {
      console.error('Error loading PDF:', error)
      setPdfData(null)
    }
  }

  const renderPdf = useCallback(async () => {
    if (!pdfData || !canvasRef.current) return

    try {
      // Make a copy of the ArrayBuffer since PDF.js detaches it after use
      const dataCopy = pdfData.slice(0)
      const pdf = await pdfjsLib.getDocument({ data: dataCopy }).promise
      setTotalPages(pdf.numPages)
      
      const page = await pdf.getPage(currentPage)
      const viewport = page.getViewport({ scale })
      
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (!context) return

      canvas.width = viewport.width
      canvas.height = viewport.height
      
      setPdfDimensions({ 
        width: page.getViewport({ scale: 1 }).width, 
        height: page.getViewport({ scale: 1 }).height 
      })

      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      } as any).promise
    } catch (error) {
      console.error('Error rendering PDF:', error)
    }
  }, [pdfData, currentPage, scale])

  // Convert canvas coordinates to PDF coordinates
  const canvasToPdf = (canvasX: number, canvasY: number) => {
    if (!pdfDimensions) return { x: 0, y: 0 }
    return {
      x: canvasX / scale,
      y: pdfDimensions.height - (canvasY / scale)
    }
  }

  // Convert PDF coordinates to canvas coordinates  
  const pdfToCanvas = (pdfX: number, pdfY: number) => {
    if (!pdfDimensions) return { x: 0, y: 0 }
    return {
      x: pdfX * scale,
      y: (pdfDimensions.height - pdfY) * scale
    }
  }

  // Get mouse position relative to canvas
  const getMousePos = (e: React.MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 }
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  // Check if point is near a resize handle
  const getResizeHandle = (mouseX: number, mouseY: number, position: SkillPositionWithInfo) => {
    const handleSize = 8
    const { x, y } = pdfToCanvas(position.x, position.y)
    const width = position.width * scale
    const height = position.height * scale
    
    const handles = {
      'nw': { x: x, y: y - height },
      'ne': { x: x + width, y: y - height },
      'sw': { x: x, y: y },
      'se': { x: x + width, y: y },
    }
    
    for (const [name, pos] of Object.entries(handles)) {
      if (Math.abs(mouseX - pos.x) < handleSize && Math.abs(mouseY - pos.y) < handleSize) {
        return name
      }
    }
    return null
  }

  // Check if point is inside a position rectangle
  const getPositionAtPoint = (mouseX: number, mouseY: number) => {
    const pagePositions = positions.filter(p => p.page === currentPage)
    for (const pos of pagePositions) {
      const { x, y } = pdfToCanvas(pos.x, pos.y)
      const width = pos.width * scale
      const height = pos.height * scale
      
      if (mouseX >= x && mouseX <= x + width && mouseY >= y - height && mouseY <= y) {
        return pos
      }
    }
    return null
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current || !pdfDimensions) return
    
    const { x, y } = getMousePos(e)
    
    // If not in placement mode, check for existing position interaction
    if (!placementMode) {
      const clickedPos = getPositionAtPoint(x, y)
      if (clickedPos) {
        const handle = getResizeHandle(x, y, clickedPos)
        if (handle) {
          // Start resizing
          setIsResizing(true)
          setResizeHandle(handle)
          setSelectedPositionId(clickedPos.skill_id)
          const canvasPos = pdfToCanvas(clickedPos.x, clickedPos.y)
          setCurrentRect({
            x: canvasPos.x,
            y: canvasPos.y - clickedPos.height * scale,
            width: clickedPos.width * scale,
            height: clickedPos.height * scale
          })
        } else {
          // Start dragging
          setIsDragging(true)
          setSelectedPositionId(clickedPos.skill_id)
          const canvasPos = pdfToCanvas(clickedPos.x, clickedPos.y)
          setDragOffset({
            x: x - canvasPos.x,
            y: y - (canvasPos.y - clickedPos.height * scale)
          })
          setCurrentRect({
            x: canvasPos.x,
            y: canvasPos.y - clickedPos.height * scale,
            width: clickedPos.width * scale,
            height: clickedPos.height * scale
          })
        }
        return
      }
    }
    
    // In placement mode, start drawing
    if (placementMode && skillToPlace) {
      setIsDrawing(true)
      setDrawStart({ x, y })
      setCurrentRect({ x, y, width: 0, height: 0 })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current || !pdfDimensions) return
    
    const { x, y } = getMousePos(e)
    
    // Update cursor based on hover state
    if (!isDrawing && !isDragging && !isResizing && overlayRef.current) {
      const clickedPos = getPositionAtPoint(x, y)
      if (clickedPos) {
        const handle = getResizeHandle(x, y, clickedPos)
        if (handle) {
          overlayRef.current.style.cursor = handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize'
        } else {
          overlayRef.current.style.cursor = 'move'
        }
      } else if (placementMode) {
        overlayRef.current.style.cursor = 'crosshair'
      } else {
        overlayRef.current.style.cursor = 'default'
      }
    }
    
    // Drawing
    if (isDrawing && drawStart) {
      const width = x - drawStart.x
      const height = y - drawStart.y
      setCurrentRect({
        x: width >= 0 ? drawStart.x : x,
        y: height >= 0 ? drawStart.y : y,
        width: Math.abs(width),
        height: Math.abs(height)
      })
    }
    
    // Dragging
    if (isDragging && dragOffset && currentRect) {
      setCurrentRect({
        ...currentRect,
        x: x - dragOffset.x,
        y: y - dragOffset.y
      })
    }
    
    // Resizing
    if (isResizing && resizeHandle && currentRect && selectedPositionId) {
      const pos = positions.find(p => p.skill_id === selectedPositionId)
      if (!pos) return
      
      const origCanvas = pdfToCanvas(pos.x, pos.y)
      const origX = origCanvas.x
      const origY = origCanvas.y - pos.height * scale
      const origRight = origX + pos.width * scale
      const origBottom = origCanvas.y
      
      let newX = currentRect.x
      let newY = currentRect.y
      let newWidth = currentRect.width
      let newHeight = currentRect.height
      
      if (resizeHandle.includes('w')) {
        newX = Math.min(x, origRight - 20)
        newWidth = origRight - newX
      }
      if (resizeHandle.includes('e')) {
        newWidth = Math.max(20, x - origX)
      }
      if (resizeHandle.includes('n')) {
        newY = Math.min(y, origBottom - 10)
        newHeight = origBottom - newY
      }
      if (resizeHandle.includes('s')) {
        newHeight = Math.max(10, y - origY)
      }
      
      setCurrentRect({ x: newX, y: newY, width: newWidth, height: newHeight })
    }
  }

  const handleMouseUp = async () => {
    if (!pdfDimensions || !selectedLevel) {
      resetEditState()
      return
    }
    
    // Save after drawing
    if (isDrawing && currentRect && skillToPlace && currentRect.width > 10 && currentRect.height > 5) {
      const pdfPos = canvasToPdf(currentRect.x, currentRect.y + currentRect.height)
      
      const position: SkillPosition = {
        skill_id: skillToPlace.id,
        page: currentPage,
        x: Math.round(pdfPos.x),
        y: Math.round(pdfPos.y),
        width: Math.round(currentRect.width / scale),
        height: Math.round(currentRect.height / scale),
        font_size: 8,
      }

      try {
        await levelDocumentsApi.setPosition(selectedLevel, position)
        setToast({ message: `Position définie pour "${skillToPlace.name}"`, type: 'success' })
        loadPositions(selectedLevel)
        setPlacementMode(false)
        setSkillToPlace(null)
      } catch (error) {
        console.error('Error saving position:', error)
        setToast({ message: 'Erreur lors de la sauvegarde', type: 'error' })
      }
    }
    
    // Save after dragging or resizing
    if ((isDragging || isResizing) && currentRect && selectedPositionId) {
      const pos = positions.find(p => p.skill_id === selectedPositionId)
      if (pos) {
        const pdfPos = canvasToPdf(currentRect.x, currentRect.y + currentRect.height)
        
        const position: SkillPosition = {
          skill_id: selectedPositionId,
          page: currentPage,
          x: Math.round(pdfPos.x),
          y: Math.round(pdfPos.y),
          width: Math.round(currentRect.width / scale),
          height: Math.round(currentRect.height / scale),
          font_size: pos.font_size,
        }

        try {
          await levelDocumentsApi.setPosition(selectedLevel, position)
          setToast({ message: 'Position mise à jour', type: 'success' })
          loadPositions(selectedLevel)
        } catch (error) {
          console.error('Error updating position:', error)
          setToast({ message: 'Erreur lors de la mise à jour', type: 'error' })
        }
      }
    }
    
    resetEditState()
  }
  
  const resetEditState = () => {
    setIsDrawing(false)
    setIsDragging(false)
    setIsResizing(false)
    setDrawStart(null)
    setCurrentRect(null)
    setSelectedPositionId(null)
    setDragOffset(null)
    setResizeHandle(null)
  }

  const handleUpload = async (level: string, file: File) => {
    setUploading(true)
    try {
      await levelDocumentsApi.upload(level, file)
      setToast({ message: `Document uploadé pour ${level}`, type: 'success' })
      loadDocuments()
      loadPdfData(level)
    } catch (error) {
      console.error('Error uploading:', error)
      setToast({ message: 'Erreur lors de l\'upload', type: 'error' })
    } finally {
      setUploading(false)
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
        setPdfData(null)
      }
    } catch (error) {
      console.error('Error deleting:', error)
      setToast({ message: 'Erreur lors de la suppression', type: 'error' })
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

  const startPlacement = (skill: SkillToPlace) => {
    setSkillToPlace(skill)
    setPlacementMode(true)
  }

  const cancelPlacement = () => {
    setPlacementMode(false)
    setSkillToPlace(null)
    resetEditState()
  }

  const getDocForLevel = (level: string) => documents.find(d => d.level === level)
  const getPositionForSkill = (skillId: string) => positions.find(p => p.skill_id === skillId)

  // Flatten skills from hierarchy
  const allSkills: SkillToPlace[] = hierarchy?.domains.flatMap(domain =>
    domain.modules.flatMap(module =>
      module.skills.map(skill => ({
        id: skill.id,
        name: skill.name,
        moduleName: module.name,
        domainName: domain.name,
      }))
    )
  ) || []

  const skillsWithoutPosition = allSkills.filter(s => !getPositionForSkill(s.id))
  const skillsWithPosition = allSkills.filter(s => getPositionForSkill(s.id))

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
        <h1 className="text-3xl font-bold theme-text">📄 Documents de Compétences</h1>
        <p className="theme-text-muted mt-1">
          Uploadez les templates PDF et cliquez sur le document pour placer chaque acquis
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

      {/* Éditeur visuel */}
      {selectedLevel && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* PDF Viewer - 2 colonnes */}
          <div className="xl:col-span-2 bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">
                Aperçu - {selectedLevel}
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
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? '...' : getDocForLevel(selectedLevel) ? '🔄 Remplacer' : '📤 Uploader'}
                </Button>
                {getDocForLevel(selectedLevel) && (
                  <Button 
                    variant="secondary" 
                    size="sm"
                    onClick={() => handleDelete(selectedLevel)}
                    className="text-red-400 hover:text-red-300"
                  >
                    🗑️
                  </Button>
                )}
              </div>
            </div>

            {pdfData ? (
              <>
                {/* Mode placement indicator */}
                {placementMode && skillToPlace && (
                  <div className="mb-4 p-3 bg-cyan-500/20 border border-cyan-500/50 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-cyan-300 font-medium">Mode placement actif</span>
                      <p className="text-sm text-cyan-200/80">
                        Dessinez un rectangle sur le PDF pour placer : <strong>{skillToPlace.name}</strong>
                      </p>
                      <p className="text-xs text-cyan-300/60 mt-1">
                        Cliquez et glissez pour dessiner la zone
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={cancelPlacement}>
                      ✕ Annuler
                    </Button>
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                    >
                      ←
                    </Button>
                    <span className="text-slate-300 text-sm">
                      Page {currentPage} / {totalPages}
                    </span>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      →
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => setScale(s => Math.max(0.5, s - 0.25))}
                    >
                      -
                    </Button>
                    <span className="text-slate-300 text-sm w-16 text-center">
                      {Math.round(scale * 100)}%
                    </span>
                    <Button 
                      variant="secondary" 
                      size="sm"
                      onClick={() => setScale(s => Math.min(2, s + 0.25))}
                    >
                      +
                    </Button>
                  </div>
                </div>

                {/* Canvas with interactive overlay */}
                <div 
                  ref={containerRef}
                  className="overflow-auto max-h-[600px] border border-slate-600 rounded-lg bg-slate-900"
                >
                  <div className="relative inline-block mx-auto">
                    <canvas
                      ref={canvasRef}
                      className="block"
                    />
                    {/* Interactive overlay */}
                    <div
                      ref={overlayRef}
                      className="absolute top-0 left-0 w-full h-full"
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={() => {
                        if (isDrawing || isDragging || isResizing) {
                          handleMouseUp()
                        }
                      }}
                    >
                      {/* Position rectangles overlay */}
                      {positions.filter(p => p.page === currentPage).map(pos => {
                        const canvasPos = pdfToCanvas(pos.x, pos.y)
                        const isSelected = selectedPositionId === pos.skill_id
                        const isBeingEdited = isSelected && (isDragging || isResizing)
                        
                        if (isBeingEdited) return null // Will be shown as currentRect
                        
                        return (
                          <div
                            key={pos.skill_id}
                            className={`absolute border-2 ${isSelected ? 'border-amber-400' : 'border-cyan-400'} bg-cyan-500/10 pointer-events-none`}
                            style={{
                              left: canvasPos.x,
                              top: canvasPos.y - pos.height * scale,
                              width: pos.width * scale,
                              height: pos.height * scale,
                            }}
                          >
                            {/* Label */}
                            <div 
                              className="absolute -top-5 left-0 px-1 text-[10px] bg-cyan-500 text-slate-900 whitespace-nowrap rounded-sm"
                            >
                              {pos.skill_name.substring(0, 25)}{pos.skill_name.length > 25 ? '...' : ''}
                            </div>
                            {/* Resize handles */}
                            <div className="absolute -top-1 -left-1 w-2 h-2 bg-cyan-400 border border-slate-900 pointer-events-auto cursor-nwse-resize" />
                            <div className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 border border-slate-900 pointer-events-auto cursor-nesw-resize" />
                            <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-cyan-400 border border-slate-900 pointer-events-auto cursor-nesw-resize" />
                            <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-cyan-400 border border-slate-900 pointer-events-auto cursor-nwse-resize" />
                          </div>
                        )
                      })}
                      
                      {/* Current drawing/editing rectangle */}
                      {currentRect && (
                        <div
                          className={`absolute border-2 ${isDrawing ? 'border-amber-400 bg-amber-500/20' : 'border-cyan-400 bg-cyan-500/20'}`}
                          style={{
                            left: currentRect.x,
                            top: currentRect.y,
                            width: currentRect.width,
                            height: currentRect.height,
                          }}
                        >
                          {/* Resize handles for editing */}
                          {(isDragging || isResizing) && (
                            <>
                              <div className="absolute -top-1 -left-1 w-2 h-2 bg-amber-400 border border-slate-900" />
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 border border-slate-900" />
                              <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-amber-400 border border-slate-900" />
                              <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-amber-400 border border-slate-900" />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-4 flex items-center gap-6 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-cyan-400 rounded"></span>
                    <span>Position définie</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-amber-400 bg-amber-500/20 rounded"></span>
                    <span>En cours d'édition</span>
                  </div>
                  <div className="text-slate-500">
                    💡 Glissez pour déplacer • Coins pour redimensionner
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-600 rounded-lg">
                <p className="mb-4">Aucun document uploadé pour ce niveau</p>
                <Button onClick={() => fileInputRef.current?.click()}>
                  📤 Uploader un PDF
                </Button>
              </div>
            )}
          </div>

          {/* Liste des acquis - 1 colonne */}
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6 max-h-[800px] overflow-y-auto">
            <h2 className="text-lg font-semibold text-white mb-4">Acquis à placer</h2>
            
            {!pdfData ? (
              <p className="text-slate-500 text-sm">Uploadez d'abord un PDF</p>
            ) : (
              <>
                {/* Skills without position */}
                {skillsWithoutPosition.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-amber-400 mb-2">
                      ⏳ Non placés ({skillsWithoutPosition.length})
                    </h3>
                    <div className="space-y-2">
                      {skillsWithoutPosition.map(skill => (
                        <div 
                          key={skill.id}
                          className={`p-3 rounded-lg border transition-all ${
                            skillToPlace?.id === skill.id
                              ? 'bg-cyan-500/20 border-cyan-500/50'
                              : 'bg-slate-700/30 border-slate-600/50 hover:bg-slate-700/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium truncate">{skill.name}</p>
                              <p className="text-xs text-slate-500 truncate">{skill.domainName} › {skill.moduleName}</p>
                            </div>
                            <Button 
                              variant="secondary" 
                              size="sm"
                              onClick={() => startPlacement(skill)}
                              disabled={placementMode && skillToPlace?.id !== skill.id}
                            >
                              📍
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skills with position */}
                {skillsWithPosition.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-green-400 mb-2">
                      ✓ Placés ({skillsWithPosition.length})
                    </h3>
                    <div className="space-y-2">
                      {skillsWithPosition.map(skill => {
                        const pos = getPositionForSkill(skill.id)!
                        return (
                          <div 
                            key={skill.id}
                            className="p-3 rounded-lg border bg-green-500/10 border-green-500/30"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white font-medium truncate">{skill.name}</p>
                                <p className="text-xs text-slate-400">
                                  Page {pos.page} • X:{Math.round(pos.x)} Y:{Math.round(pos.y)}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <Button 
                                  variant="secondary" 
                                  size="sm"
                                  onClick={() => startPlacement(skill)}
                                  title="Repositionner"
                                >
                                  📍
                                </Button>
                                <Button 
                                  variant="secondary" 
                                  size="sm"
                                  onClick={() => handleDeletePosition(skill.id)}
                                  className="text-red-400 hover:text-red-300"
                                  title="Supprimer"
                                >
                                  🗑️
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {allSkills.length === 0 && (
                  <p className="text-slate-500 text-sm">Aucun acquis défini pour ce niveau</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
