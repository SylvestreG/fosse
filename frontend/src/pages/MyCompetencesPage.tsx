import { useEffect, useState } from 'react'
import { 
  peopleApi, 
  skillValidationsApi, 
  validationStagesApi,
  levelDocumentsApi,
  Person, 
  CompetencyHierarchy,
  ValidationStage,
  LevelDocumentInfo,
} from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import Button from '@/components/Button'
import Toast from '@/components/Toast'

export default function MyCompetencesPage() {
  const { email, impersonating } = useAuthStore()
  const [myPerson, setMyPerson] = useState<Person | null>(null)
  const [hierarchy, setHierarchy] = useState<CompetencyHierarchy | null>(null)
  const [stages, setStages] = useState<ValidationStage[]>([])
  const [levelDocument, setLevelDocument] = useState<LevelDocumentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Si on impersonnifie, utiliser l'email de la personne impersonnifiée
  const targetEmail = impersonating?.user_email || email

  useEffect(() => {
    loadData()
  }, [targetEmail])

  const loadData = async () => {
    try {
      // Charger les étapes de validation
      const stagesRes = await validationStagesApi.list()
      setStages(stagesRes.data)

      // Charger mon profil
      if (targetEmail) {
        const peopleRes = await peopleApi.list(targetEmail)
        const me = peopleRes.data.find(p => p.email === targetEmail)
        setMyPerson(me || null)

        // Charger les compétences pour mon niveau en préparation ou mon niveau actuel
        if (me) {
          const levelToLoad = me.preparing_level || me.diving_level_display
          if (levelToLoad) {
            try {
              const hierarchyRes = await skillValidationsApi.getMyCompetencies(levelToLoad)
              setHierarchy(hierarchyRes.data)
              
              // Check if a document template exists for this level
              try {
                const docRes = await levelDocumentsApi.get(levelToLoad)
                setLevelDocument(docRes.data)
              } catch {
                setLevelDocument(null)
              }
            } catch (error) {
              console.error('Error loading competencies:', error)
              setHierarchy(null)
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12 theme-text">Chargement...</div>
  }

  if (!myPerson) {
    return (
      <div className="text-center py-12">
        <p className="theme-text-muted">Profil non trouvé. Contactez un administrateur.</p>
      </div>
    )
  }

  const currentLevel = myPerson.diving_level_display
  const preparingLevel = myPerson.preparing_level

  // Si pas de niveau en préparation → pas de page compétences
  if (!preparingLevel) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold theme-text">🎯 Mes Compétences</h1>
        
        <div className="theme-card rounded-xl shadow-lg overflow-hidden">
          {/* Header avec illustration */}
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-8 text-white text-center">
            <div className="text-6xl mb-4">🤿</div>
            <h2 className="text-2xl font-bold">Pas de niveau en préparation</h2>
          </div>
          
          {/* Contenu */}
          <div className="p-8 text-center">
            {currentLevel ? (
              <>
                <div className="mb-6">
                  <span className="theme-text-muted">Votre niveau actuel :</span>
                  <div className="text-3xl font-bold text-blue-600 mt-2">{currentLevel}</div>
                </div>
                <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-4 max-w-md mx-auto">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <div className="text-left">
                      <p className="text-amber-300">
                        Vous n'avez pas de niveau en cours de préparation.
                      </p>
                      <p className="text-amber-200/80 text-sm mt-2">
                        Si vous souhaitez préparer un nouveau niveau, contactez un administrateur 
                        pour qu'il configure votre formation.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
          <p className="theme-text-muted text-lg mb-4">
            Vous n'avez pas encore de niveau de plongée enregistré.
          </p>
                <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-blue-300">
                    Contactez un administrateur pour configurer votre niveau et démarrer votre formation.
          </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="theme-card p-4">
          <div className="flex gap-3">
            <span className="text-2xl">📚</span>
            <div>
              <h3 className="font-medium theme-text">À propos des compétences</h3>
              <p className="text-sm theme-text-secondary mt-1">
                Lorsque vous préparez un niveau, vous aurez accès ici à la liste des compétences 
                à acquérir et pourrez suivre votre progression. Les compétences sont validées 
                par vos encadrants lors des sessions de fosse et en mer.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const displayLevel = preparingLevel

  // Calcul des stats globales
  const globalStats = hierarchy?.domains.reduce(
    (acc, domain) => ({
      total: acc.total + domain.progress.total,
      validated: acc.validated + domain.progress.validated,
      in_progress: acc.in_progress + domain.progress.in_progress,
      not_started: acc.not_started + domain.progress.not_started,
    }),
    { total: 0, validated: 0, in_progress: 0, not_started: 0 }
  ) || { total: 0, validated: 0, in_progress: 0, not_started: 0 }

  const globalPercentage = globalStats.total > 0 
    ? Math.round((globalStats.validated / globalStats.total) * 100) 
    : 0

  const handleDownloadDocument = async () => {
    if (!myPerson || !preparingLevel) return
    
    setDownloading(true)
    try {
      const res = await levelDocumentsApi.generateFilled(preparingLevel, myPerson.id)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Competences_${preparingLevel}_${myPerson.last_name}_${myPerson.first_name}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading:', error)
      setToast({ message: 'Erreur lors du téléchargement', type: 'error' })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold theme-text">🎯 Mes Compétences</h1>
          <p className="theme-text-secondary mt-1 text-sm sm:text-base">
            Suivez votre progression vers le niveau {displayLevel}
          </p>
        </div>
        {levelDocument && (
          <Button 
            variant="secondary" 
            onClick={handleDownloadDocument}
            disabled={downloading}
          >
            {downloading ? '...' : '📥 Télécharger PDF'}
          </Button>
        )}
      </div>

      {/* Carte de niveau avec progression globale */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 sm:block">
            <div className="text-4xl sm:text-5xl sm:hidden">🤿</div>
          <div>
            {currentLevel && (
                <div className="mb-1 sm:mb-2">
                  <span className="text-blue-100 text-xs sm:text-sm">Niveau actuel</span>
                  <p className="text-xl sm:text-2xl font-bold">{currentLevel}</p>
              </div>
            )}
            {preparingLevel && (
              <div>
                  <span className="text-blue-100 text-xs sm:text-sm">En préparation</span>
                  <p className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                  🎯 {preparingLevel}
                </p>
              </div>
            )}
          </div>
          </div>
          <div className="flex items-center justify-between sm:flex-col sm:text-right">
            <div className="text-4xl sm:text-5xl hidden sm:block sm:mb-2">🤿</div>
            <div className="bg-slate-800/50 backdrop-blur-xl/20 rounded-lg px-3 py-2 sm:px-4">
              <div className="text-2xl sm:text-3xl font-bold">{globalPercentage}%</div>
              <div className="text-xs sm:text-sm text-blue-100">
                {globalStats.validated}/{globalStats.total} validés
              </div>
            </div>
          </div>
        </div>

        {/* Barre de progression globale */}
        <div className="mt-4">
          <div className="flex flex-col sm:flex-row sm:justify-between text-xs sm:text-sm text-blue-100 mb-1 gap-1">
            <span>Progression globale</span>
            <span className="flex flex-wrap gap-x-2 gap-y-0.5">
              <span>{globalStats.validated} validés</span>
              <span>•</span>
              <span>{globalStats.in_progress} en cours</span>
              <span>•</span>
              <span>{globalStats.not_started} à faire</span>
            </span>
          </div>
          <div className="h-2 sm:h-3 bg-slate-800/50 backdrop-blur-xl/20 rounded-full overflow-hidden">
            <div className="h-full flex">
              <div 
                className="bg-green-400 transition-all" 
                style={{ width: `${(globalStats.validated / globalStats.total) * 100}%` }}
              />
              <div 
                className="bg-yellow-400 transition-all" 
                style={{ width: `${(globalStats.in_progress / globalStats.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Légende des étapes */}
      {stages.length > 0 && (
        <div className="theme-card p-3 sm:p-4 shadow">
          <h3 className="text-xs sm:text-sm font-medium theme-text-secondary mb-2 sm:mb-3">Légende des étapes</h3>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-gray-400 rounded-full"></span>
              <span className="text-xs sm:text-sm theme-text-secondary">Non commencé</span>
            </div>
            {stages.map((stage) => (
              <div key={stage.id} className="flex items-center gap-1 sm:gap-1.5">
                <span 
                  className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full" 
                  style={{ backgroundColor: stage.color }}
                ></span>
                <span className="text-xs sm:text-sm theme-text-secondary">
                  {stage.icon} {stage.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste des compétences par domaine */}
      {!hierarchy || hierarchy.domains.length === 0 ? (
        <div className="theme-card p-6 sm:p-8 text-center shadow">
          <p className="theme-text-muted text-sm sm:text-base">
            Aucune compétence définie pour le niveau {displayLevel}.
          </p>
          <p className="theme-text-dimmed text-xs sm:text-sm mt-2">
            Les compétences seront ajoutées par un administrateur.
          </p>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {hierarchy.domains.map((domain) => (
            <div key={domain.id} className="theme-card rounded-lg shadow overflow-hidden">
              {/* Header du domaine */}
              <div className="px-3 sm:px-6 py-3 sm:py-4 border-b theme-border theme-bg-input">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <span className="text-base sm:text-lg font-bold theme-text">{domain.name}</span>
                  </div>
                  <div className="flex items-center justify-between sm:flex-col sm:text-right">
                    <span className="text-xl sm:text-2xl font-bold theme-text">
                      {Math.round(domain.progress.percentage)}%
                    </span>
                    <span className="text-xs sm:text-sm theme-text-muted">
                      {domain.progress.validated}/{domain.progress.total} validés
                    </span>
          </div>
                </div>

                {/* Barre de progression du domaine */}
                <div className="mt-2 sm:mt-3 h-1.5 sm:h-2 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div className="h-full flex">
                    <div 
                      className="bg-green-500 transition-all" 
                      style={{ width: `${(domain.progress.validated / domain.progress.total) * 100}%` }}
                    />
                    <div 
                      className="bg-yellow-400 transition-all" 
                      style={{ width: `${(domain.progress.in_progress / domain.progress.total) * 100}%` }}
                    />
                </div>
                </div>
              </div>

              {/* Modules et acquis */}
              <div className="divide-y theme-border">
                {domain.modules.map((module) => (
                  <div key={module.id}>
                    {/* Header du module */}
                    <div className="px-3 sm:px-6 py-2 sm:py-3 theme-bg-input flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base sm:text-lg">📖</span>
                        <span className="font-medium theme-text text-sm sm:text-base">{module.name}</span>
                      </div>
                      <span className="text-xs sm:text-sm theme-text-muted">
                        {module.progress.validated}/{module.progress.total}
                      </span>
                    </div>

                    {/* Acquis */}
                    <div className="px-3 sm:px-6 py-2">
                      {module.skills.map((skill, index) => (
                        <div
                          key={skill.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 sm:py-3 border-b theme-border last:border-b-0 gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start sm:items-center gap-2 sm:gap-3">
                              <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">
                                {index + 1}
                              </span>
                              <span className="theme-text text-sm sm:text-base">{skill.name}</span>
                            </div>
                            {skill.description && (
                              <p className="text-xs theme-text-muted ml-7 sm:ml-8 mt-1 italic">
                                💡 {skill.description}
                              </p>
                            )}
                          </div>
                          
                          {/* Badge de validation */}
                          <div className="flex-shrink-0 ml-7 sm:ml-0">
                            {skill.validation ? (
                              <div className="sm:text-right">
                                <span 
                                  className="inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm gap-1"
                                  style={{ 
                                    backgroundColor: skill.validation.stage_color + '20', 
                                    color: skill.validation.stage_color 
                                  }}
                                >
                                  {skill.validation.stage_icon} {skill.validation.stage_name}
                                </span>
                                <div className="text-xs theme-text-muted mt-0.5 sm:mt-1">
                                  {skill.validation.validated_at} — {skill.validation.validated_by_name}
                                </div>
                                {skill.validation.notes && (
                                  <div className="text-xs theme-text-muted italic mt-0.5 max-w-[200px] truncate">
                                    "{skill.validation.notes}"
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm theme-bg-input theme-text-muted">
                                ⏳ Non commencé
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                </div>
              </div>
            ))}
          </div>
            </div>
          ))}
        </div>
      )}

      {/* Info sur l'évaluation */}
      <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-3 sm:p-4">
        <div className="flex gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl flex-shrink-0">💡</span>
          <div>
            <h3 className="font-medium text-amber-300 text-sm sm:text-base">Comment ça marche ?</h3>
            <p className="text-xs sm:text-sm text-amber-200/80 mt-1">
              Ces compétences sont validées par vos encadrants lors des sessions de fosse et en mer.
              Chaque acquis passe par plusieurs étapes de validation avant d'être définitivement validé.
              Une fois toutes les compétences validées, vous pourrez passer votre niveau !
            </p>
          </div>
        </div>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
