import { components } from '../../types/schema'
import { LocalTaskPart } from '../../types/garage'

export const FREE_TASK_LABEL = 'Tâche libre (hors catalogue)'

export type TaskCatalogItem = components['schemas']['TaskCatalog']

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
