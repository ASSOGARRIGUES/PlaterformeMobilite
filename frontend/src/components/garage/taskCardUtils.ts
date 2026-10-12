import { components } from '../../types/schema'
import { LocalTaskPart } from '../../types/garage'

export const FREE_TASK_LABEL = 'Tâche libre (hors catalogue)'

/**
 * Identifiant local unique. `crypto.randomUUID` n'existe que dans un contexte sécurisé (HTTPS/localhost) :
 * en HTTP sur le réseau local d'atelier, on retombe sur `getRandomValues` (disponible partout).
 */
export function newLocalId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

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
