import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { InspectionSheet } from '../../../types/garage'
import { WearConfig, wearZoneKey } from '../wearUtils'
import { plural } from '../../../constants'

export type FindingSection = 'wear' | 'levels' | 'lighting' | 'damages' | 'ops'

export type Finding = {
  section: FindingSection
  /** Clé d'icône de tâche du catalogue (usure) ; absente pour les autres constats. */
  icon?: string
  title: string
  detail?: string
  /** Forme courte pour la ligne de liste (« Niveau lave-glace » plutôt que « Niveau lave-glace en défaut »). */
  short?: string
}

export type InspectionFindings = {
  red: Finding[]
  orange: Finding[]
  watchCount: number
  damageCount: number
  opsCount: number
  tone: 'red' | 'orange' | 'teal'
  /** Fiche sans aucun constat ni opération à prévoir. */
  ras: boolean
}

const LEVELS: { field: 'oil_ok' | 'coolant_ok' | 'washer_ok'; name: string }[] = [
  { field: 'oil_ok', name: 'huile' },
  { field: 'coolant_ok', name: 'refroidissement' },
  { field: 'washer_ok', name: 'lave-glace' },
]

type SheetForFindings = Pick<
  InspectionSheet,
  'wear_measurements' | 'oil_ok' | 'coolant_ok' | 'washer_ok' | 'lights_ok' | 'lights_notes' | 'damages' | 'tasks'
>

/**
 * Constats d'une fiche validée : rouge = usure critique, niveau ou éclairage en défaut ; orange = usure à surveiller,
 * dégâts ; « à prévoir » n'est jamais un défaut. L'essai routier non réalisé n'en est pas un non plus. Les seuils viennent
 * de la configuration garage (jamais en dur).
 */
export function inspectionFindings(sheet: SheetForFindings, config: WearConfig): InspectionFindings {
  const red: Finding[] = []
  const orange: Finding[] = []
  let watchCount = 0

  sheet.wear_measurements.forEach((measurement) => {
    const zone = wearZoneKey(measurement.level, config)
    const base = { section: 'wear' as const, icon: measurement.catalog_task_icon, detail: `${measurement.level}/10` }
    if (zone === 'critical') red.push({ ...base, title: `${measurement.catalog_task_name} critique` })
    if (zone === 'watch') {
      watchCount += 1
      orange.push({ ...base, title: `${measurement.catalog_task_name} à surveiller` })
    }
  })

  LEVELS.forEach(({ field, name }) => {
    if (sheet[field] === false) {
      red.push({ section: 'levels', title: `Niveau ${name} en défaut`, short: `Niveau ${name}` })
    }
  })
  if (sheet.lights_ok === false) {
    red.push({
      section: 'lighting',
      title: 'Éclairage en défaut',
      detail: sheet.lights_notes || undefined,
      short: 'Éclairage',
    })
  }

  const damageCount = sheet.damages.length
  if (damageCount) {
    orange.push({
      section: 'damages',
      title: `${damageCount} ${plural(damageCount, 'dégât signalé', 'dégâts signalés')}`,
      short: `${damageCount} ${plural(damageCount, 'dégât', 'dégâts')}`,
    })
  }
  const opsCount = sheet.tasks.length

  return {
    red,
    orange,
    watchCount,
    damageCount,
    opsCount,
    tone: red.length ? 'red' : orange.length ? 'orange' : 'teal',
    ras: !red.length && !orange.length && !opsCount,
  }
}

/** Ligne 2 de la liste : constats du niveau le plus grave, nommés. */
export function findingsLine(findings: InspectionFindings): string {
  if (findings.ras) return 'RAS'
  const lead = findings.red.length ? findings.red : findings.orange
  return lead.length ? lead.map((finding) => finding.short ?? finding.title).join(' · ') : 'Aucun défaut relevé'
}

/** Compteurs de la ligne 3 (le reste des constats, quand il y a du rouge) et opérations à prévoir. */
export function findingsMeta(findings: InspectionFindings): string[] {
  const parts: string[] = []
  if (findings.red.length) {
    if (findings.watchCount) parts.push(`${findings.watchCount} à surveiller`)
    if (findings.damageCount) parts.push(`${findings.damageCount} ${plural(findings.damageCount, 'dégât', 'dégâts')}`)
  }
  if (findings.opsCount) parts.push(`${findings.opsCount} à prévoir`)
  return parts
}

export function authorName(sheet: Pick<InspectionSheet, 'created_by'>): string {
  return `${sheet.created_by.first_name ?? ''} ${sheet.created_by.last_name ?? ''}`.trim() || sheet.created_by.email
}

type EditRights = {
  /** Résultat de `isAuthorized('garage.manage_inspection')`. */
  canManage: boolean
  /** Résultat de `isAuthorized('garage.edit_validated_inspection')`. */
  canEditValidated: boolean
}

export type EditAccess = 'allowed' | 'locked' | 'none'

/**
 * Qui peut modifier une fiche validée : `manage_inspection` pendant `inspection_edit_days` jours après la validation,
 * au-delà `edit_validated_inspection` seule. L'API reste l'arbitre (403) ; « locked » = délai dépassé sans la permission
 * (texte discret), « none » = pas de droit de gestion (rien à afficher). Fiche ancienne sans `validated_at` : `updated_at`.
 */
export function editAccess(
  sheet: Pick<InspectionSheet, 'status' | 'validated_at' | 'updated_at'>,
  editDays: number | undefined,
  rights: EditRights,
  now: Date = new Date(),
): EditAccess {
  if (sheet.status !== 'validated' || !rights.canManage) return 'none'
  if (rights.canEditValidated) return 'allowed'
  if (editDays === undefined) return 'locked'
  const deadline = dayjs(sheet.validated_at ?? sheet.updated_at).add(editDays, 'day')
  return dayjs(now).isAfter(deadline) ? 'locked' : 'allowed'
}

export const canEditInspection = (...args: Parameters<typeof editAccess>) => editAccess(...args) === 'allowed'

/** « 3 oct. » pour la ligne d'usure de l'onglet Entretien. */
export function formatMeasuredAt(date: string): string {
  return dayjs(date).locale('fr').format('D MMM')
}
