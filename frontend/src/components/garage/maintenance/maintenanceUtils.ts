import dayjs from 'dayjs'
import {
  MaintenanceCounts,
  MaintenanceOtherWork,
  MaintenanceSignalement,
  MaintenanceSummary,
  MaintenanceTask,
} from '../../../types/garage'
import {
  MaintenanceAxisEnum,
  MaintenanceSourceEnum,
  MaintenanceStatusEnum,
} from '../../../types/schema.d'
import { humanizeNumber } from '../../../constants'

// Aucune règle de statut ici : status, source, main_axis, remaining, progress et counts
// viennent de GET /api/garage/maintenance/{id}/ (story 2.10). On groupe, trie et formate.

export type MaintenanceSectionKind = 'overdue' | 'toPlan' | 'upToDate' | 'notRecorded'

export const MAINTENANCE_SECTION_COLORS: Record<MaintenanceSectionKind, string> = {
  overdue: 'red',
  toPlan: 'orange',
  upToDate: 'teal',
  notRecorded: 'gray',
}

/** Hauteur de l'en-tête de groupe (20px) + écart avec la première carte (8px) : sert à aligner la colonne de droite sur desktop. */
export const MAINTENANCE_SECTION_HEADER_HEIGHT = 20
export const MAINTENANCE_SECTION_HEADER_OFFSET = MAINTENANCE_SECTION_HEADER_HEIGHT + 8

export type MaintenanceGroups = {
  overdue: MaintenanceTask[]
  toPlan: MaintenanceTask[]
  upToDate: MaintenanceTask[]
  notRecorded: MaintenanceTask[]
}

/** Progression brute (non bornée) de l'axe principal, ou null. */
export function mainAxisProgress(task: MaintenanceTask): number | null {
  if (task.main_axis === MaintenanceAxisEnum.km) return task.km?.progress ?? null
  if (task.main_axis === MaintenanceAxisEnum.months) return task.months?.progress ?? null
  return null
}

const compareNames = (a: string, b: string) => a.localeCompare(b, 'fr', { sensitivity: 'base' })

/** Le plus urgent d'abord (progress brut décroissant), sans progression à la fin, puis par nom. */
function compareByUrgency(a: MaintenanceTask, b: MaintenanceTask): number {
  const pa = mainAxisProgress(a)
  const pb = mainAxisProgress(b)
  if (pa != null && pb != null && pa !== pb) return pb - pa
  if (pa == null && pb != null) return 1
  if (pa != null && pb == null) return -1
  return compareNames(a.name, b.name)
}

export function groupMaintenanceTasks(summary: MaintenanceSummary): MaintenanceGroups {
  const byStatus = (status: MaintenanceStatusEnum) => summary.tasks.filter((task) => task.status === status)
  return {
    overdue: byStatus(MaintenanceStatusEnum.overdue).sort(compareByUrgency),
    toPlan: byStatus(MaintenanceStatusEnum.to_plan).sort(compareByUrgency),
    upToDate: byStatus(MaintenanceStatusEnum.up_to_date).sort(compareByUrgency),
    notRecorded: byStatus(MaintenanceStatusEnum.not_recorded).sort((a, b) => compareNames(a.name, b.name)),
  }
}

const byMostRecent = (a: MaintenanceSignalement, b: MaintenanceSignalement) => b.sheet_date.localeCompare(a.sheet_date)

/** Signalements autonomes, rendus après les lignes du groupe À prévoir. */
export function sortedSignalements(summary: MaintenanceSummary): MaintenanceSignalement[] {
  return [...summary.signalements].sort(byMostRecent)
}

/** Le backend ne borne pas progress : < 0 (saisie hors ordre) ou > 1 (dépassé). */
export function clampProgress(progress: number): number {
  return Math.min(1, Math.max(0, progress))
}

const DAYS_PER_MONTH = 30.4375

/** « 10 jours », « 4 mois », « 13 mois », « 3 ans » (valeur absolue) : mois sous 730 jours, années au-delà. */
export function formatDuration(days: number): string {
  const abs = Math.abs(days)
  if (abs < 31) {
    const d = Math.max(1, Math.round(abs))
    return `${d} jour${d > 1 ? 's' : ''}`
  }
  if (abs < 730) return `${Math.max(1, Math.round(abs / DAYS_PER_MONTH))} mois`
  const years = Math.round(abs / (12 * DAYS_PER_MONTH))
  return `${years} an${years > 1 ? 's' : ''}`
}

/** « il y a 4 mois », par rapport à la date serveur. */
export function sinceLabel(date: string, today: string): string {
  const days = dayjs(today).diff(dayjs(date), 'day')
  return days <= 0 ? "aujourd'hui" : `il y a ${formatDuration(days)}`
}

/** Texte d'un axe ; le signe de remaining ne sert qu'à formuler la phrase. */
export function axisPhrase(task: MaintenanceTask, axis: MaintenanceAxisEnum): string | null {
  if (axis === MaintenanceAxisEnum.km) {
    if (!task.km) return null
    const { remaining } = task.km
    if (remaining > 0) return `dans ${humanizeNumber(remaining)} km`
    if (remaining === 0) return 'échéance atteinte'
    return `${humanizeNumber(-remaining)} km de retard`
  }
  if (!task.months) return null
  const { remaining_days } = task.months
  if (remaining_days > 0) return `dans ${formatDuration(remaining_days)}`
  if (remaining_days === 0) return 'échéance atteinte'
  return `${formatDuration(remaining_days)} de retard`
}

function mainAxis(task: MaintenanceTask): MaintenanceAxisEnum | null {
  if (task.main_axis === MaintenanceAxisEnum.km) return MaintenanceAxisEnum.km
  if (task.main_axis === MaintenanceAxisEnum.months) return MaintenanceAxisEnum.months
  return null
}

export function mainFigure(task: MaintenanceTask): string | null {
  const axis = mainAxis(task)
  return axis ? axisPhrase(task, axis) : null
}

/** L'autre axe en petit : « ou dans 8 mois », ou « et 2 000 km » si les deux axes sont dépassés. */
export function secondaryFigure(task: MaintenanceTask): string | null {
  const axis = mainAxis(task)
  if (!axis || !task.km || !task.months) return null
  const bothOver = task.km.remaining <= 0 && task.months.remaining_days <= 0
  if (axis === MaintenanceAxisEnum.km) {
    if (!bothOver) return `ou ${axisPhrase(task, MaintenanceAxisEnum.months)}`
    return task.months.remaining_days === 0 ? 'et échéance atteinte' : `et ${formatDuration(task.months.remaining_days)}`
  }
  if (!bothOver) return `ou ${axisPhrase(task, MaintenanceAxisEnum.km)}`
  return task.km.remaining === 0 ? 'et échéance atteinte' : `et ${humanizeNumber(-task.km.remaining)} km`
}

export type ToPlanReason = 'echeance' | 'usure' | 'signalement'

/** Élément encadré qui explique la présence dans « À prévoir » (lecture de source, pas un calcul de statut).
 * Un signalement imbriqué est assez explicite : rien n'est encadré. Source inconnue, ou usure sans état connu → échéance (garde-fou). */
export function toPlanReason(task: MaintenanceTask): ToPlanReason | null {
  if (task.status !== MaintenanceStatusEnum.to_plan) return null
  if (task.source === MaintenanceSourceEnum.signalement && task.signalements.length > 0) return 'signalement'
  if (task.source === MaintenanceSourceEnum.usure && task.last_realization?.wear_level != null) return 'usure'
  return 'echeance'
}

/** « Tous les 30 000 km ou 2 ans », pour une tâche jamais enregistrée. */
export function periodicityLabel(task: MaintenanceTask): string | null {
  const parts: string[] = []
  if (task.periodicity.km) parts.push(`${humanizeNumber(task.periodicity.km)} km`)
  if (task.periodicity.months) parts.push(formatDuration(task.periodicity.months * DAYS_PER_MONTH))
  return parts.length ? `Tous les ${parts.join(' ou ')}` : null
}

/** DD/MM si l'année est celle de today (date serveur), DD/MM/YYYY sinon. */
export function formatShortDate(date: string, today: string): string {
  const d = dayjs(date)
  return d.format(d.year() === dayjs(today).year() ? 'DD/MM' : 'DD/MM/YYYY')
}

/** Initiales pour l'avatar d'un signalement : « Jean Dupont » → « JD ». */
export function initials(name: string): string {
  return name.split(/[\s.]+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

/** Auteur d'un signalement = auteur de sa fiche (summary.sheets). */
export function sheetAuthor(summary: MaintenanceSummary, sheetId: number): string {
  return summary.sheets.find((sheet) => sheet.id === sheetId)?.created_by_display ?? ''
}

export function maintenanceBadge(counts: MaintenanceCounts): { count: number; color: 'red' | 'orange' } | null {
  const count = counts.overdue + counts.to_plan
  if (count === 0) return null
  return { count, color: counts.overdue > 0 ? 'red' : 'orange' }
}

/** Ligne à jour la plus avancée sur son axe principal (sélection, pas un calcul de statut). */
export function nextDueTask(summary: MaintenanceSummary): MaintenanceTask | null {
  return groupMaintenanceTasks(summary).upToDate[0] ?? null
}

/** Bloc « Rien à prévoir » : rien de dépassé ni à prévoir, et au moins une tâche à jour. */
export function showNothingToPlan(summary: MaintenanceSummary): boolean {
  const { overdue, to_plan, up_to_date } = summary.counts
  return overdue + to_plan === 0 && up_to_date > 0
}

const plural = (count: number, singular: string, pluralForm: string) => (count > 1 ? pluralForm : singular)

export type ReferentSummary = { color: 'red' | 'orange'; title: string; detail: string | null }

/** Encadré de synthèse de la vue référent, seulement s'il y a quelque chose à faire. */
export function referentSummary(summary: MaintenanceSummary): ReferentSummary | null {
  const { overdue } = summary.counts
  const looseCount = summary.signalements.length
  const toPlanTasks = summary.counts.to_plan - looseCount
  if (overdue + toPlanTasks + looseCount === 0) return null

  const title = overdue > 0
    ? `${overdue} ${plural(overdue, 'entretien en retard', 'entretiens en retard')}.`
    : 'Entretien à prévoir prochainement.'
  const parts: string[] = []
  const critical = summary.tasks.filter((task) => task.status === MaintenanceStatusEnum.overdue && task.is_critical)
  if (critical.length) parts.push(`Tâche critique : ${critical.map((task) => task.name.toLowerCase()).join(', ')}`)
  if (toPlanTasks > 0) parts.push(`${toPlanTasks} à faire bientôt`)
  if (looseCount > 0) parts.push(`${looseCount} ${plural(looseCount, 'signalement', 'signalements')} à vérifier`)
  return { color: overdue > 0 ? 'red' : 'orange', title, detail: parts.length ? `${parts.join(' · ')}.` : null }
}

/** Ligne « Entretien » du bloc Informations. */
export type MaintenanceInfo =
  | { kind: 'noHistory' }
  | { kind: 'upToDate' }
  | { kind: 'notRecorded' }
  | { kind: 'items'; items: { color: string; label: string }[] }

export function maintenanceInfo(summary: MaintenanceSummary): MaintenanceInfo {
  if (summary.sheets.length === 0) return { kind: 'noHistory' }
  const { overdue, to_plan, up_to_date } = summary.counts
  if (overdue + to_plan === 0) return up_to_date > 0 ? { kind: 'upToDate' } : { kind: 'notRecorded' }
  const items: { color: string; label: string }[] = []
  if (overdue > 0) items.push({ color: 'red', label: `${overdue} ${plural(overdue, 'dépassé', 'dépassés')}` })
  if (to_plan > 0) items.push({ color: 'orange', label: `${to_plan} à prévoir` })
  return { kind: 'items', items }
}

const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function filterOtherWork(items: MaintenanceOtherWork[], query: string): MaintenanceOtherWork[] {
  const normalizedQuery = normalize(query.trim())
  if (!normalizedQuery) return items
  return items.filter((item) => normalize(item.name).includes(normalizedQuery))
}
