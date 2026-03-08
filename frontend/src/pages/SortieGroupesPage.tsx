import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  sortiesApi,
  skillValidationsApi,
  validationStagesApi,
  Sortie,
  QuestionnaireDetail,
  CompetencyHierarchy,
  CompetencySkillWithValidation,
  ValidationStage,
} from '@/lib/api'
import Button from '@/components/Button'
import Toast from '@/components/Toast'

const LEVEL_ORDER = ['N1', 'N2', 'N3']

type StudentWithCompetencies = {
  questionnaire: QuestionnaireDetail
  competencies: CompetencyHierarchy | null
}

// Flatten all skills from hierarchy for filter list
function collectSkills(h: CompetencyHierarchy): CompetencySkillWithValidation[] {
  const skills: CompetencySkillWithValidation[] = []
  for (const domain of h.domains) {
    for (const mod of domain.modules) {
      for (const skill of mod.skills) {
        skills.push(skill)
      }
    }
  }
  return skills
}

export default function SortieGroupesPage() {
  const [sorties, setSorties] = useState<Sortie[]>([])
  const [selectedSortieId, setSelectedSortieId] = useState<string>('')
  const [selectedLevel, setSelectedLevel] = useState<string>('N2')
  const [studentsWithComp, setStudentsWithComp] = useState<StudentWithCompetencies[]>([])
  const [stages, setStages] = useState<ValidationStage[]>([])
  const [allSkillsForLevel, setAllSkillsForLevel] = useState<CompetencySkillWithValidation[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Filtres
  const [filterSkillIds, setFilterSkillIds] = useState<Set<string>>(new Set())
  const [filterStageId, setFilterStageId] = useState<string>('')
  const [searchName, setSearchName] = useState('')

  useEffect(() => {
    sortiesApi.list().then((r) => setSorties(r.data)).catch(() => setToast({ message: 'Erreur chargement sorties', type: 'error' }))
    validationStagesApi.list().then((r) => setStages(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedSortieId) {
      setStudentsWithComp([])
      setAllSkillsForLevel([])
      return
    }
    loadSortieData()
  }, [selectedSortieId, selectedLevel])

  const loadSortieData = async () => {
    if (!selectedSortieId) return
    setLoading(true)
    try {
      const res = await sortiesApi.getQuestionnaires(selectedSortieId)
      const all = res.data
      const students = all.filter((q) => !q.is_encadrant)

      if (students.length === 0) {
        setStudentsWithComp([])
        setAllSkillsForLevel([])
        setLoading(false)
        return
      }

      const level = selectedLevel
      const withComp: StudentWithCompetencies[] = []
      for (const q of students) {
        try {
          const compRes = await skillValidationsApi.getPersonCompetencies(q.person_id, level)
          withComp.push({ questionnaire: q, competencies: compRes.data })
        } catch {
          withComp.push({ questionnaire: q, competencies: null })
        }
      }
      setStudentsWithComp(withComp)

      const firstWithComp = withComp.find((s) => s.competencies != null)
      setAllSkillsForLevel(firstWithComp?.competencies ? collectSkills(firstWithComp.competencies) : [])
    } catch {
      setToast({ message: 'Erreur chargement participants', type: 'error' })
      setStudentsWithComp([])
      setAllSkillsForLevel([])
    } finally {
      setLoading(false)
    }
  }

  const filteredStudents = useMemo(() => {
    // Toujours limiter aux élèves qui préparent ce niveau
    let list = studentsWithComp.filter((s) => s.questionnaire.preparing_level === selectedLevel)

    if (searchName.trim()) {
      const term = searchName.trim().toLowerCase()
      list = list.filter(
        (s) =>
          s.questionnaire.last_name.toLowerCase().includes(term) ||
          s.questionnaire.first_name.toLowerCase().includes(term)
      )
    }

    // Filtre compétences : garder uniquement les élèves qui ont validé (au moins une étape) chaque compétence sélectionnée
    if (filterSkillIds.size > 0) {
      list = list.filter((s) => {
        if (!s.competencies) return false
        const skills = collectSkills(s.competencies)
        const validatedSkillIds = new Set(
          skills.filter((sk) => sk.validation != null).map((sk) => sk.id)
        )
        return [...filterSkillIds].every((id) => validatedSkillIds.has(id))
      })
    }

    if (filterStageId) {
      list = list.filter((s) => {
        if (!s.competencies) return false
        const skills = collectSkills(s.competencies)
        return skills.some(
          (sk) => sk.validation && sk.validation.stage_id === filterStageId
        )
      })
    }

    return list
  }, [studentsWithComp, selectedLevel, searchName, filterSkillIds, filterStageId])

  const toggleSkillFilter = (skillId: string) => {
    setFilterSkillIds((prev) => {
      const next = new Set(prev)
      if (next.has(skillId)) next.delete(skillId)
      else next.add(skillId)
      return next
    })
  }

  const clearFilters = () => {
    setFilterSkillIds(new Set())
    setFilterStageId('')
    setSearchName('')
  }

  const hasActiveFilters = filterSkillIds.size > 0 || filterStageId !== '' || searchName.trim() !== ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold theme-text">Groupes par sortie et niveau</h1>
        <p className="theme-text-secondary mt-1 text-sm">
          Afficher les élèves d&apos;une sortie, filtrer par compétences et étape de validation pour constituer des groupes de niveau.
        </p>
      </div>

      {/* Sélection sortie + niveau */}
      <div className="theme-card p-4 shadow flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium theme-text-secondary mb-1">Sortie</label>
          <select
            value={selectedSortieId}
            onChange={(e) => setSelectedSortieId(e.target.value)}
            className="w-full rounded-lg border theme-border theme-bg theme-text px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
          >
            <option value="">Choisir une sortie</option>
            {sorties
              .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {new Date(s.start_date).toLocaleDateString('fr-FR')}
                </option>
              ))}
          </select>
        </div>
        <div className="w-32">
          <label className="block text-sm font-medium theme-text-secondary mb-1">Niveau préparé</label>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="w-full rounded-lg border theme-border theme-bg theme-text px-3 py-2 focus:ring-2 focus:ring-cyan-500"
          >
            {LEVEL_ORDER.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
        {selectedSortieId && (
          <Button variant="secondary" onClick={loadSortieData} disabled={loading}>
            {loading ? 'Chargement…' : 'Actualiser'}
          </Button>
        )}
      </div>

      {!selectedSortieId && (
        <div className="theme-card p-8 text-center theme-text-muted">
          Choisissez une sortie pour afficher les élèves et filtrer par compétences.
        </div>
      )}

      {selectedSortieId && (
        <>
          {/* Filtres */}
          <div className="theme-card p-4 shadow space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium theme-text">Filtres</span>
              <input
                type="text"
                placeholder="Rechercher par nom..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="rounded-lg border theme-border theme-bg theme-text px-3 py-1.5 text-sm w-48"
              />
              <select
                value={filterStageId}
                onChange={(e) => setFilterStageId(e.target.value)}
                className="rounded-lg border theme-border theme-bg theme-text px-3 py-1.5 text-sm"
              >
                <option value="">Toutes les étapes</option>
                {stages.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.icon} {st.name}
                  </option>
                ))}
              </select>
              {hasActiveFilters && (
                <Button variant="secondary" onClick={clearFilters} className="text-sm">
                  Réinitialiser les filtres
                </Button>
              )}
            </div>
            <div>
              <p className="text-xs theme-text-muted mb-2">Compétences (sélection multiple — afficher les élèves qui ont au moins ces compétences)</p>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {allSkillsForLevel.map((sk) => (
                  <button
                    key={sk.id}
                    type="button"
                    onClick={() => toggleSkillFilter(sk.id)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      filterSkillIds.has(sk.id)
                        ? 'bg-cyan-500/30 border-cyan-500 text-cyan-200'
                        : 'theme-border theme-text-secondary hover:theme-bg-hover'
                    }`}
                  >
                    {sk.name}
                  </button>
                ))}
                {allSkillsForLevel.length === 0 && !loading && (
                  <span className="text-sm theme-text-muted">Aucune compétence pour ce niveau</span>
                )}
              </div>
            </div>
          </div>

          {/* Résumé */}
          <p className="text-sm theme-text-secondary">
            <strong>{filteredStudents.length}</strong> élève{filteredStudents.length !== 1 ? 's' : ''} affiché
            {studentsWithComp.length !== filteredStudents.length && ` (sur ${studentsWithComp.length})`}
          </p>

          {/* Liste des élèves */}
          <div className="space-y-3">
            {loading ? (
              <div className="theme-card p-8 text-center theme-text-muted">Chargement des compétences…</div>
            ) : filteredStudents.length === 0 ? (
              <div className="theme-card p-8 text-center theme-text-muted">
                Aucun élève ne correspond aux critères.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredStudents.map(({ questionnaire, competencies }) => (
                  <div
                    key={questionnaire.id}
                    className="theme-card p-4 shadow rounded-lg border theme-border"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold theme-text">
                        {questionnaire.last_name.toUpperCase()} {questionnaire.first_name}
                      </div>
                      <Link
                        to={`/dashboard/competences/student/${questionnaire.person_id}`}
                        className="text-xs text-cyan-400 hover:text-cyan-300 whitespace-nowrap"
                      >
                        Fiche →
                      </Link>
                    </div>
                    <div className="text-xs theme-text-muted mt-0.5">
                      {questionnaire.preparing_level ? `Prép. ${questionnaire.preparing_level}` : questionnaire.diving_level || '—'}
                    </div>
                    {competencies && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {collectSkills(competencies)
                          .filter((sk) => sk.validation)
                          .map((sk) => (
                            <span
                              key={sk.id}
                              className="text-xs px-1.5 py-0.5 rounded border"
                              style={{
                                borderColor: sk.validation!.stage_color + '60',
                                backgroundColor: sk.validation!.stage_color + '20',
                                color: sk.validation!.stage_color,
                              }}
                              title={`${sk.name} — ${sk.validation!.stage_name}`}
                            >
                              {sk.validation!.stage_icon} {sk.name.slice(0, 20)}{sk.name.length > 20 ? '…' : ''}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

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
