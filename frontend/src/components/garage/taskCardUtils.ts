import { components } from '../../types/schema'
import { LocalTaskPart } from '../../types/garage'
import { humanizeNumber } from '../../constants'

export const FREE_TASK_LABEL = 'Tâche libre (hors catalogue)'

export type TaskCatalogItem = components['schemas']['TaskCatalog']

export function periodicityLabel(task: TaskCatalogItem): string | undefined {
  const segments: string[] = []
  if (task.km_periodicity) segments.push(`${humanizeNumber(task.km_periodicity)} km`)
  if (task.month_periodicity) {
    if (task.month_periodicity % 12 === 0) {
      const years = task.month_periodicity / 12
      segments.push(`${humanizeNumber(years)} an${years > 1 ? 's' : ''}`)
    } else {
      segments.push(`${humanizeNumber(task.month_periodicity)} mois`)
    }
  }
  return segments.length ? segments.join(' / ') : undefined
}

export type TaskPickerRow =
  | { kind: 'catalog'; task: TaskCatalogItem }
  | { kind: 'free' }

export function computePartsSubtotal(parts: LocalTaskPart[]): number {
  return parts.reduce((total, part) => total + part.unitPrice * part.quantity, 0)
}

export function buildTaskPickerRows(catalog: TaskCatalogItem[], query: string): TaskPickerRow[] {
  const normalizedQuery = query.trim().toLowerCase()
  const filtered = normalizedQuery
    ? catalog.filter((task) => task.name.toLowerCase().includes(normalizedQuery))
    : catalog

  const rows: TaskPickerRow[] = filtered.map((task) => ({ kind: 'catalog', task }))
  rows.push({ kind: 'free' })
  return rows
}

export function isWearLevelCritical(level: number, threshold = 3): boolean {
  return level <= threshold
}
