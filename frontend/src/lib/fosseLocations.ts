/**
 * Fosses partenaires : le club ne fournit pas l’air ni le matériel.
 * Jusqu’à 2 palanquées pour le groupe (une rotation, pal. 1 et 2).
 * Valeurs alignées sur le sélecteur de lieu (SessionsPage).
 */
export const EXTERNAL_CLUB_GEAR_LOCATIONS = ['Le Puy-en-Velay', 'Montluçon'] as const

export type ExternalClubGearLocation = (typeof EXTERNAL_CLUB_GEAR_LOCATIONS)[number]

export function isExternalClubGearLocation(location: string | null | undefined): boolean {
  if (!location) return false
  return (EXTERNAL_CLUB_GEAR_LOCATIONS as readonly string[]).includes(location.trim())
}
