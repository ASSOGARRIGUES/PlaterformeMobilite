import { IconAlertTriangle, IconCheck, IconEye } from '@tabler/icons-react'

export type WearConfig = {
  wear_critical_threshold: number
  wear_alert_threshold: number
}

export type WearZoneKey = 'critical' | 'watch' | 'good'

export type WearZone = {
  label: string
  /** Libellé du bouton de saisie (l'action du garagiste), distinct du libellé de zone. */
  buttonLabel: string
  icon: typeof IconCheck
  /** Couleur Mantine (clé de thème) de l'icône et de la bordure. */
  color: string
}

export const WEAR_ZONES: Record<WearZoneKey, WearZone> = {
  critical: { label: 'Critique', buttonLabel: 'À changer', icon: IconAlertTriangle, color: 'red' },
  watch: { label: 'À surveiller', buttonLabel: 'À surveiller', icon: IconEye, color: 'orange' },
  good: { label: 'Bon état', buttonLabel: 'Bon', icon: IconCheck, color: 'teal' },
}

/** Ordre d'affichage des boutons : du plus urgent au meilleur état. */
export const WEAR_ZONE_ORDER: WearZoneKey[] = ['critical', 'watch', 'good']

/** Zone d'un niveau d'usure (0 = hors d'usage, 10 = neuf) ; `null` sans mesure. Seuils inclusifs (<=). */
export function wearZoneKey(level: number | null | undefined, config: WearConfig): WearZoneKey | null {
  if (level == null) return null
  if (level <= config.wear_critical_threshold) return 'critical'
  if (level <= config.wear_alert_threshold) return 'watch'
  return 'good'
}

/** Valeur stockée par chaque bouton : le milieu de sa zone, arrondi à l'entier inférieur (jamais hors zone). */
export function wearSegmentValues(config: WearConfig): Record<WearZoneKey, number> {
  const critical = config.wear_critical_threshold
  const alert = config.wear_alert_threshold
  return {
    critical: Math.floor(critical / 2),
    watch: Math.floor((critical + 1 + alert) / 2),
    good: Math.floor((alert + 11) / 2),
  }
}

export type WearTrackBand = { zone: WearZoneKey; from: number; to: number }

/** Bandes de la piste du curseur, en % de la piste 0-10 ; frontières à `seuil + 0,5`. */
export function wearTrackBands(config: WearConfig): WearTrackBand[] {
  const criticalEnd = (config.wear_critical_threshold + 0.5) * 10
  const watchEnd = (config.wear_alert_threshold + 0.5) * 10
  return [
    { zone: 'critical', from: 0, to: criticalEnd },
    { zone: 'watch', from: criticalEnd, to: watchEnd },
    { zone: 'good', from: watchEnd, to: 100 },
  ]
}
