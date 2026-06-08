import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  sortiesApi,
  palanqueesApi,
  SortieWithDives,
  Session,
  SessionPalanquees,
  Palanquee,
  Rotation,
} from '@/lib/api'
import { useAuthStore } from '@/lib/auth'
import { useSortiesAccess } from '@/contexts/SortiesAccessContext'
import { isExternalClubGearLocation } from '@/lib/fosseLocations'
import Toast from '@/components/Toast'
import Button from '@/components/Button'

type ActualForm = { actual_time: string; actual_depth: string }

function rotationTitle(rotation: Rotation, indexInSection: number, externalGear: boolean): string {
  if (externalGear) {
    if (rotation.plongee_number === 1) return `Plongée 1 — Rota ${indexInSection + 1}`
    if (rotation.plongee_number === 2) return `Plongée 2 — Rota ${indexInSection + 1}`
  }
  return `Rotation ${rotation.number}`
}

function palanqueeMembersSummary(palanquee: Palanquee): string {
  if (palanquee.members.length === 0) return '—'
  return palanquee.members
    .map(m => `${m.last_name.toUpperCase()} ${m.first_name.charAt(0)}.`)
    .join(', ')
}

function isPalanqueeComplete(form: ActualForm | undefined): boolean {
  if (!form) return false
  const t = form.actual_time.trim()
  const d = form.actual_depth.trim()
  return t !== '' && d !== '' && !Number.isNaN(Number(t)) && !Number.isNaN(Number(d))
}

function countIncompletePalanquees(
  data: SessionPalanquees,
  forms: Record<string, ActualForm>
): number {
  let n = 0
  for (const rot of data.rotations) {
    for (const pal of rot.palanquees) {
      if (pal.members.length === 0) continue
      if (!isPalanqueeComplete(forms[pal.id])) n++
    }
  }
  return n
}

export default function SortieFichesPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isAdminUI = useAuthStore(s => s.isAdminView())
  const { directorSorties, loadingDirectorSorties } = useSortiesAccess()
  const canEdit =
    isAdminUI || (!!id && directorSorties.some(s => s.id === id))
  const accessReady = isAdminUI || !loadingDirectorSorties

  const [sortie, setSortie] = useState<SortieWithDives | null>(null)
  const [divePalanquees, setDivePalanquees] = useState<Record<string, SessionPalanquees>>({})
  const [forms, setForms] = useState<Record<string, ActualForm>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [downloadingDiveId, setDownloadingDiveId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const [ficheOptions, setFicheOptions] = useState({
    club: 'USI Plongée',
    position: '',
    securite_surface: '',
    observations: '',
  })

  const loadData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const sortieRes = await sortiesApi.get(id)
      const s = sortieRes.data
      setSortie(s)

      const palMap: Record<string, SessionPalanquees> = {}
      const nextForms: Record<string, ActualForm> = {}

      await Promise.all(
        s.dives.map(async dive => {
          try {
            const res = await palanqueesApi.getSessionPalanquees(dive.id)
            palMap[dive.id] = res.data
            for (const rot of res.data.rotations) {
              for (const pal of rot.palanquees) {
                nextForms[pal.id] = {
                  actual_time: pal.actual_time?.toString() ?? '',
                  actual_depth: pal.actual_depth?.toString() ?? '',
                }
              }
            }
          } catch {
            palMap[dive.id] = { session_id: dive.id, rotations: [], unassigned_participants: [] }
          }
        })
      )

      setDivePalanquees(palMap)
      setForms(nextForms)
    } catch {
      setToast({ message: 'Erreur lors du chargement', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id && accessReady) loadData()
  }, [id, accessReady, loadData])

  const updateForm = (palanqueeId: string, patch: Partial<ActualForm>) => {
    setForms(prev => ({
      ...prev,
      [palanqueeId]: { ...prev[palanqueeId], ...patch },
    }))
  }

  const savePalanquee = async (palanqueeId: string) => {
    const form = forms[palanqueeId]
    if (!form) return
    setSavingId(palanqueeId)
    try {
      await palanqueesApi.updatePalanquee(palanqueeId, {
        actual_time: form.actual_time.trim() ? parseInt(form.actual_time, 10) : undefined,
        actual_depth: form.actual_depth.trim() ? parseInt(form.actual_depth, 10) : undefined,
      })
      setToast({ message: 'Paramètres enregistrés', type: 'success' })
    } catch {
      setToast({ message: 'Erreur lors de l’enregistrement', type: 'error' })
    } finally {
      setSavingId(null)
    }
  }

  const persistDiveForms = async (diveId: string): Promise<boolean> => {
    const data = divePalanquees[diveId]
    if (!data) return false
    const updates: Promise<unknown>[] = []
    for (const rot of data.rotations) {
      for (const pal of rot.palanquees) {
        if (pal.members.length === 0) continue
        const form = forms[pal.id]
        if (!form) continue
        updates.push(
          palanqueesApi.updatePalanquee(pal.id, {
            actual_time: form.actual_time.trim() ? parseInt(form.actual_time, 10) : undefined,
            actual_depth: form.actual_depth.trim() ? parseInt(form.actual_depth, 10) : undefined,
          })
        )
      }
    }
    if (updates.length === 0) return true
    await Promise.all(updates)
    return true
  }

  const saveAllForDive = async (diveId: string) => {
    setSavingId(`all-${diveId}`)
    try {
      await persistDiveForms(diveId)
      setToast({ message: 'Tous les paramètres enregistrés', type: 'success' })
    } catch {
      setToast({ message: 'Erreur lors de l’enregistrement', type: 'error' })
    } finally {
      setSavingId(null)
    }
  }

  const downloadFiche = async (dive: Session) => {
    const data = divePalanquees[dive.id]
    if (!data) return
    const missing = countIncompletePalanquees(data, forms)
    if (missing > 0) {
      const ok = confirm(
        `${missing} palanquée(s) n’ont pas encore durée et profondeur réalisées. Télécharger quand même le PDF ?`
      )
      if (!ok) return
    }

    setDownloadingDiveId(dive.id)
    try {
      await persistDiveForms(dive.id)
      const res = await palanqueesApi.downloadFicheSecurite(dive.id, {
        date: dive.start_date?.slice(0, 10),
        club: ficheOptions.club,
        site: dive.location || sortie?.location,
        position: ficheOptions.position,
        securite_surface: ficheOptions.securite_surface,
        observations: ficheOptions.observations,
      })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Fiche_Securite_${sortie?.name || dive.name}_${dive.dive_number ?? ''}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      setToast({ message: 'Erreur lors du téléchargement du PDF', type: 'error' })
    } finally {
      setDownloadingDiveId(null)
    }
  }

  if (!accessReady || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (!sortie) {
    return (
      <div className="text-center py-8">
        <p className="theme-text-secondary">Sortie non trouvée</p>
        <Button className="mt-4" onClick={() => navigate('/dashboard/sorties')}>
          Retour aux sorties
        </Button>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="text-center py-8 space-y-4">
        <p className="theme-text-secondary">Accès réservé au directeur de plongée de la sortie.</p>
        <Link to={`/dashboard/sorties/${id}`} className="text-cyan-400 hover:underline">
          ← Retour à la sortie
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div>
        <Link
          to={`/dashboard/sorties/${id}`}
          className="text-sm theme-text-secondary hover:theme-text mb-2 inline-block"
        >
          ← Retour à la sortie
        </Link>
        <h1 className="text-2xl font-bold theme-text">📄 Bilan — Fiches de sécurité</h1>
        <p className="theme-text-secondary mt-1">
          {sortie.name} — Saisissez les paramètres <strong>réalisés</strong> par palanquée, puis téléchargez le PDF complet.
        </p>
      </div>

      <div className="theme-card p-4 sm:p-6 rounded-lg shadow space-y-4">
        <h2 className="text-lg font-semibold theme-text">En-tête PDF (commun)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs theme-text-secondary mb-1">Club</label>
            <input
              type="text"
              value={ficheOptions.club}
              onChange={e => setFicheOptions(p => ({ ...p, club: e.target.value }))}
              className="w-full px-3 py-2 theme-bg-input rounded-lg theme-text text-sm"
            />
          </div>
          <div>
            <label className="block text-xs theme-text-secondary mb-1">Position</label>
            <input
              type="text"
              value={ficheOptions.position}
              onChange={e => setFicheOptions(p => ({ ...p, position: e.target.value }))}
              className="w-full px-3 py-2 theme-bg-input rounded-lg theme-text text-sm"
            />
          </div>
          <div>
            <label className="block text-xs theme-text-secondary mb-1">Sécurité surface</label>
            <input
              type="text"
              value={ficheOptions.securite_surface}
              onChange={e => setFicheOptions(p => ({ ...p, securite_surface: e.target.value }))}
              className="w-full px-3 py-2 theme-bg-input rounded-lg theme-text text-sm"
            />
          </div>
          <div>
            <label className="block text-xs theme-text-secondary mb-1">Observations</label>
            <input
              type="text"
              value={ficheOptions.observations}
              onChange={e => setFicheOptions(p => ({ ...p, observations: e.target.value }))}
              className="w-full px-3 py-2 theme-bg-input rounded-lg theme-text text-sm"
            />
          </div>
        </div>
      </div>

      {sortie.dives.map(dive => {
        const data = divePalanquees[dive.id]
        const externalGear = isExternalClubGearLocation(dive.location)
        const missing = data ? countIncompletePalanquees(data, forms) : 0
        const rotaIndexByPlongee: Record<string, number> = {}

        return (
          <div key={dive.id} className="theme-card p-4 sm:p-6 rounded-lg shadow space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold theme-text">
                  Plongée {dive.dive_number ?? '—'} — {dive.name}
                </h2>
                <p className="text-sm theme-text-secondary">
                  {new Date(dive.start_date).toLocaleDateString('fr-FR')}
                  {dive.location ? ` • ${dive.location}` : ''}
                  {missing > 0 && (
                    <span className="text-amber-400 ml-2">
                      ({missing} palanquée{missing > 1 ? 's' : ''} incomplète{missing > 1 ? 's' : ''})
                    </span>
                  )}
                  {data && missing === 0 && data.rotations.some(r => r.palanquees.some(p => p.members.length > 0)) && (
                    <span className="text-green-400 ml-2">✓ Prêt pour PDF</span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => saveAllForDive(dive.id)}
                  disabled={!data || savingId === `all-${dive.id}`}
                >
                  {savingId === `all-${dive.id}` ? '…' : 'Enregistrer tout'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => downloadFiche(dive)}
                  disabled={downloadingDiveId === dive.id || !data}
                >
                  {downloadingDiveId === dive.id ? '…' : '📥 PDF'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/dashboard/palanquees/${dive.id}`)}
                >
                  Palanquées
                </Button>
              </div>
            </div>

            {!data || data.rotations.length === 0 ? (
              <p className="text-sm theme-text-muted">Aucune rotation / palanquée pour cette plongée.</p>
            ) : (
              <div className="space-y-4">
                {data.rotations.map(rotation => {
                  const pKey = rotation.plongee_number != null ? String(rotation.plongee_number) : 'other'
                  const idx = rotaIndexByPlongee[pKey] ?? 0
                  rotaIndexByPlongee[pKey] = idx + 1
                  const title = rotationTitle(rotation, idx, externalGear)

                  if (rotation.palanquees.length === 0) {
                    return (
                      <div key={rotation.id} className="text-sm theme-text-muted">
                        {title} — aucune palanquée
                      </div>
                    )
                  }

                  return (
                    <div key={rotation.id} className="border theme-border rounded-lg overflow-hidden">
                      <div className="px-3 py-2 theme-bg-input text-sm font-medium theme-text-secondary">
                        {title}
                      </div>
                      <div className="divide-y theme-border">
                        {rotation.palanquees.map((pal, palIdx) => {
                          const form = forms[pal.id] ?? { actual_time: '', actual_depth: '' }
                          const complete = pal.members.length > 0 && isPalanqueeComplete(form)
                          const hasMembers = pal.members.length > 0

                          return (
                            <div
                              key={pal.id}
                              className={`p-3 grid grid-cols-1 lg:grid-cols-12 gap-3 items-start ${
                                hasMembers && !complete ? 'bg-amber-500/5' : ''
                              }`}
                            >
                              <div className="lg:col-span-4">
                                <p className="text-sm font-medium theme-text">
                                  Palanquée {palIdx + 1}
                                  {complete && <span className="text-green-400 ml-2 text-xs">✓</span>}
                                </p>
                                <p className="text-xs theme-text-muted mt-0.5 truncate" title={palanqueeMembersSummary(pal)}>
                                  {palanqueeMembersSummary(pal)}
                                </p>
                                {(pal.planned_time || pal.planned_depth) && (
                                  <p className="text-xs text-cyan-400/90 mt-1">
                                    Prévu :{' '}
                                    {pal.planned_time ? `${pal.planned_time}'` : '—'} /{' '}
                                    {pal.planned_depth ? `${pal.planned_depth} m` : '—'}
                                  </p>
                                )}
                              </div>
                              <div className="lg:col-span-4 grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] theme-text-dimmed block mb-0.5">
                                    Durée réalisée (min)
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={180}
                                    disabled={!hasMembers}
                                    value={form.actual_time}
                                    onChange={e => updateForm(pal.id, { actual_time: e.target.value })}
                                    placeholder="45"
                                    className="w-full px-2 py-1.5 theme-bg-input rounded text-sm disabled:opacity-50"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] theme-text-dimmed block mb-0.5">
                                    Prof. réalisée (m)
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={120}
                                    disabled={!hasMembers}
                                    value={form.actual_depth}
                                    onChange={e => updateForm(pal.id, { actual_depth: e.target.value })}
                                    placeholder="25"
                                    className="w-full px-2 py-1.5 theme-bg-input rounded text-sm disabled:opacity-50"
                                  />
                                </div>
                              </div>
                              <div className="lg:col-span-4 flex lg:justify-end">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={!hasMembers || savingId === pal.id}
                                  onClick={() => savePalanquee(pal.id)}
                                >
                                  {savingId === pal.id ? '…' : 'Enregistrer'}
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
