import { humanizeNumber, plural } from '../../constants'
import { TaskCatalogItem } from './taskCardUtils'

/** « Tous les 15 000 km ou 1 an », « Tous les 6 mois » : un seul format pour toute l'application. */
export function periodicityLabel({ km, months }: { km?: number | null; months?: number | null }): string | null {
  const parts: string[] = []
  if (km) parts.push(`${humanizeNumber(km)} km`)
  if (months) {
    const years = months / 12
    parts.push(Number.isInteger(years) ? `${years} ${plural(years, 'an', 'ans')}` : `${months} mois`)
  }
  if (!km && (months === 12 || months === 1)) return months === 12 ? 'Tous les ans' : 'Tous les mois'
  return parts.length ? `Tous les ${parts.join(' ou ')}` : null
}

/** Périodicité d'une tâche du catalogue, `undefined` si aucune. */
export function catalogPeriodicityLabel(task: TaskCatalogItem): string | undefined {
  return periodicityLabel({ km: task.km_periodicity, months: task.month_periodicity }) ?? undefined
}
