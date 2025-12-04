import { useEffect, useState } from 'react'
import { 
  peopleApi, 
  skillValidationsApi, 
  validationStagesApi,
  Person, 
  CompetencyHierarchy,
  ValidationStage,
} from '@/lib/api'
import { useAuthStore } from '@/lib/auth'

export default function MyCompetencesPage() {
  const { email, impersonating } = useAuthStore()
  const [myPerson, setMyPerson] = useState<Person | null>(null)
  const [hierarchy, setHierarchy] = useState<CompetencyHierarchy | null>(null)
  const [stages, setStages] = useState<ValidationStage[]>([])
  const [loading, setLoading] = useState(true)

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
    return <div className="text-center py-12">Chargement...</div>
  }

  if (!myPerson) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Profil non trouvé. Contactez un administrateur.</p>
      </div>
    )
  }

  const currentLevel = myPerson.diving_level_display
  const preparingLevel = myPerson.preparing_level

  // Si pas de niveau en préparation et pas de niveau actuel
  if (!preparingLevel && !currentLevel) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">🎯 Mes Compétences</h1>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg mb-4">
            Vous n'avez pas encore de niveau de plongée enregistré.
          </p>
          <p className="text-gray-400">
            Contactez un administrateur pour configurer votre niveau.
          </p>
        </div>
      </div>
    )
  }

  const displayLevel = preparingLevel || currentLevel

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">🎯 Mes Compétences</h1>
        <p className="text-gray-600 mt-1">
          Suivez votre progression vers le niveau {displayLevel}
        </p>
      </div>

      {/* Carte de niveau avec progression globale */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            {currentLevel && (
              <div className="mb-2">
                <span className="text-blue-100">Niveau actuel</span>
                <p className="text-2xl font-bold">{currentLevel}</p>
              </div>
            )}
            {preparingLevel && (
              <div>
                <span className="text-blue-100">En préparation</span>
                <p className="text-3xl font-bold flex items-center gap-2">
                  🎯 {preparingLevel}
                </p>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-5xl mb-2">🤿</div>
            <div className="bg-white/20 rounded-lg px-4 py-2">
              <div className="text-3xl font-bold">{globalPercentage}%</div>
              <div className="text-sm text-blue-100">
                {globalStats.validated}/{globalStats.total} validés
              </div>
            </div>
          </div>
        </div>

        {/* Barre de progression globale */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-blue-100 mb-1">
            <span>Progression globale</span>
            <span>{globalStats.validated} validés • {globalStats.in_progress} en cours • {globalStats.not_started} à faire</span>
          </div>
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
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
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Légende des étapes</h3>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-gray-200 rounded-full"></span>
              <span className="text-sm text-gray-600">Non commencé</span>
            </div>
            {stages.map((stage) => (
              <div key={stage.id} className="flex items-center gap-1.5">
                <span 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: stage.color }}
                ></span>
                <span className="text-sm text-gray-600">
                  {stage.icon} {stage.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste des compétences par domaine */}
      {!hierarchy || hierarchy.domains.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">
            Aucune compétence définie pour le niveau {displayLevel}.
          </p>
          <p className="text-gray-400 text-sm mt-2">
            Les compétences seront ajoutées par un administrateur.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {hierarchy.domains.map((domain) => (
            <div key={domain.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Header du domaine */}
              <div className="px-6 py-4 border-b bg-gradient-to-r from-gray-50 to-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-lg font-bold text-gray-900">{domain.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-900">
                        {Math.round(domain.progress.percentage)}%
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {domain.progress.validated}/{domain.progress.total} validés
                    </div>
                  </div>
                </div>

                {/* Barre de progression du domaine */}
                <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
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
              <div className="divide-y divide-gray-100">
                {domain.modules.map((module) => (
                  <div key={module.id}>
                    {/* Header du module */}
                    <div className="px-6 py-3 bg-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📖</span>
                        <span className="font-medium text-gray-800">{module.name}</span>
                      </div>
                      <span className="text-sm text-gray-500">
                        {module.progress.validated}/{module.progress.total}
                      </span>
                    </div>

                    {/* Acquis */}
                    <div className="px-6 py-2">
                      {module.skills.map((skill, index) => (
                        <div
                          key={skill.id}
                          className="flex items-center justify-between py-3 border-b border-gray-50 last:border-b-0"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">
                              {index + 1}
                            </span>
                            <span className="text-gray-700">{skill.name}</span>
                          </div>
                          
                          {/* Badge de validation */}
                          <div className="flex-shrink-0">
                            {skill.validation ? (
                              <div className="text-right">
                                <span 
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm gap-1"
                                  style={{ 
                                    backgroundColor: skill.validation.stage_color + '20', 
                                    color: skill.validation.stage_color 
                                  }}
                                >
                                  {skill.validation.stage_icon} {skill.validation.stage_name}
                                </span>
                                <div className="text-xs text-gray-400 mt-1">
                                  {skill.validation.validated_at} — {skill.validation.validated_by_name}
                                </div>
                                {skill.validation.notes && (
                                  <div className="text-xs text-gray-500 italic mt-0.5">
                                    "{skill.validation.notes}"
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-500">
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
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h3 className="font-medium text-amber-900">Comment ça marche ?</h3>
            <p className="text-sm text-amber-800 mt-1">
              Ces compétences sont validées par vos encadrants lors des sessions de fosse et en mer.
              Chaque acquis passe par plusieurs étapes de validation avant d'être définitivement validé.
              Une fois toutes les compétences validées, vous pourrez passer votre niveau !
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
