/**
 * Fosses partenaires : le club ne fournit pas l’air ni le matériel.
 * Organisation type Plongée 1 / Plongée 2, chacune avec des rotas puis des palanquées.
 * Valeurs alignées sur le sélecteur de lieu (SessionsPage).
 */
export const EXTERNAL_CLUB_GEAR_LOCATIONS = ['Le Puy-en-Velay', 'Montluçon'] as const

export type ExternalClubGearLocation = (typeof EXTERNAL_CLUB_GEAR_LOCATIONS)[number]

export function isExternalClubGearLocation(location: string | null | undefined): boolean {
  if (!location) return false
  return (EXTERNAL_CLUB_GEAR_LOCATIONS as readonly string[]).includes(location.trim())
}

/** Fosse piscine Coubertin : matériel et transport (Issoire / Clermont, voiture) dans l’app. */
export function isCoubertinClubFosseLocation(location: string | null | undefined): boolean {
  const t = (location ?? '').trim()
  // Anciennes sessions sans lieu : comportement historique = fosse club Coubertin
  if (t === '') return true
  return t === 'Coubertin'
}
