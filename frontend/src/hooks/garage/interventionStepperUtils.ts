import {
  LocalTask,
  LocalTaskPart,
  InterventionTask,
  InterventionSheet,
  MaintenanceSignalement,
  MaintenanceSummary,
  MaintenanceTask,
  CreateInterventionTaskPayload,
  UpdateInterventionTaskPayload,
} from '../../types/garage'
import { TaskCatalogItem, computePartsSubtotal, newLocalId } from '../../components/garage/taskCardUtils'
import { catalogPeriodicityLabel, periodicityLabel } from '../../components/garage/periodicityUtils'
import { groupMaintenanceTasks, sortedSignalements } from '../../components/garage/maintenance/maintenanceUtils'

/** Payload minimal de création (POST .../tasks/) — parts/photos passent toujours par le PATCH ensuite */
export function localTaskToCreatePayload(task: LocalTask): CreateInterventionTaskPayload {
  return {
    type: task.type,
    catalog_task: task.catalogTaskId,
    name: task.catalogTaskId ? undefined : task.name,
    wear_level: task.isWearTask ? task.wearLevel : undefined,
  }
}

function partsChanged(current: LocalTaskPart[], previous: LocalTaskPart[]): boolean {
  if (current.length !== previous.length) return true
  return current.some(
    (part, i) =>
      part.name !== previous[i].name ||
      part.unitPrice !== previous[i].unitPrice ||
      part.quantity !== previous[i].quantity,
  )
}

/** Diff minimal entre l'état courant et le dernier snapshot synchronisé serveur. {} si rien n'a changé. */
export function localTaskToUpdatePayload(current: LocalTask, previous: LocalTask): UpdateInterventionTaskPayload {
  const payload: UpdateInterventionTaskPayload = {}

  if (current.name !== previous.name) payload.name = current.name
  if ((current.description ?? '') !== (previous.description ?? '')) payload.description = current.description ?? ''
  if (current.wearLevel !== previous.wearLevel) payload.wear_level = current.wearLevel ?? null

  if (partsChanged(current.parts, previous.parts)) {
    payload.parts = current.parts.map((part) => ({
      name: part.name,
      unit_price: part.unitPrice,
      quantity: part.quantity,
    }))
  }

  const addPhotos = current.photos.filter((photo) => photo.startsWith('data:') && !previous.photos.includes(photo))
  if (addPhotos.length) payload.add_photos = addPhotos

  const removePhotoIds: number[] = []
  previous.photos.forEach((url, index) => {
    if (!current.photos.includes(url)) {
      const id = previous.photoIds?.[index]
      if (id != null) removePhotoIds.push(id)
    }
  })
  if (removePhotoIds.length) payload.remove_photo_ids = removePhotoIds

  return payload
}

/** Reconstruit une LocalTask complète depuis une tâche renvoyée par l'API (AC3/AC4). */
export function localTaskFromApiTask(
  apiTask: InterventionTask,
  catalogById: Map<number, TaskCatalogItem>,
): LocalTask {
  const catalogItem = apiTask.catalog_task != null ? catalogById.get(apiTask.catalog_task) : undefined
  return {
    localId: newLocalId(),
    catalogTaskId: apiTask.catalog_task ?? undefined,
    name: apiTask.catalog_task != null ? (catalogItem?.name ?? 'Tâche') : (apiTask.name ?? ''),
    type: apiTask.type as LocalTask['type'],
    periodicityLabel: catalogItem ? catalogPeriodicityLabel(catalogItem) : undefined,
    icon: catalogItem?.icon,
    isWearTask: !!catalogItem?.is_wear_task,
    wearLevel: apiTask.wear_level ?? undefined,
    description: apiTask.description ?? '',
    parts: apiTask.parts.map((part) => ({
      localId: newLocalId(),
      name: part.name,
      unitPrice: Number(part.unit_price),
      quantity: part.quantity ?? 1,
    })),
    photos: apiTask.photos.map((photo) => photo.url),
    serverId: apiTask.id,
    photoIds: apiTask.photos.map((photo) => photo.id),
    sheetId: apiTask.sheet,
  }
}

/**
 * Identifiant stable d'une tâche catalogue pour comparer une "à prévoir" et une "faite" à travers les
 * fiches. `null` pour une tâche libre (hors catalogue) : le nom saisi librement n'est pas un identifiant
 * fiable (deux libellés différents pour la même intervention ne doivent pas être fusionnés à tort), donc
 * les tâches libres ne sont jamais dédupliquées entre fiches.
 */
export function taskIdentity(task: Pick<LocalTask, 'catalogTaskId'>): string | null {
  return task.catalogTaskId != null ? `cat:${task.catalogTaskId}` : null
}

export type PendingSuggestions = {
  overdue: MaintenanceTask[]
  toPlan: MaintenanceTask[]
  signalements: MaintenanceSignalement[]
}

/**
 * Suggestions du stepper : vue dérivée de la synthèse d'entretien, dans l'ordre et avec les statuts de l'onglet
 * Entretien (aucune règle de statut ici). Une tâche déjà ajoutée en « Réalisées » n'est plus suggérée.
 */
export function pendingSuggestions(summary: MaintenanceSummary | undefined, doneTasks: LocalTask[]): PendingSuggestions {
  if (!summary) return { overdue: [], toPlan: [], signalements: [] }
  const doneIdentities = new Set(doneTasks.map(taskIdentity).filter((identity): identity is string => identity != null))
  const consumedSignalementIds = new Set(doneTasks.map((task) => task.sourceSignalementId).filter((id): id is number => id != null))
  const isDone = (catalogTaskId: number | null | undefined) => {
    const identity = taskIdentity({ catalogTaskId: catalogTaskId ?? undefined })
    return identity != null && doneIdentities.has(identity)
  }
  const { overdue, toPlan } = groupMaintenanceTasks(summary)
  return {
    overdue: overdue.filter((task) => !isDone(task.catalog_task_id)),
    toPlan: toPlan.filter((task) => !isDone(task.catalog_task_id)),
    signalements: sortedSignalements(summary).filter(
      (signalement) => !consumedSignalementIds.has(signalement.task_id) && !isDone(signalement.catalog_task_id),
    ),
  }
}

/** Tâche « réalisée » créée au clic sur « + » : rien du signalement (description, photos) n'est copié. */
export function localTaskFromSuggestion(
  source: MaintenanceTask | MaintenanceSignalement,
  catalogById: Map<number, TaskCatalogItem>,
): LocalTask {
  const base = { localId: newLocalId(), name: source.name, type: 'done' as const, description: '', parts: [], photos: [] }
  if ('task_id' in source) {
    const catalogItem = source.catalog_task_id != null ? catalogById.get(source.catalog_task_id) : undefined
    return {
      ...base,
      catalogTaskId: source.catalog_task_id ?? undefined,
      sourceSignalementId: source.task_id,
      icon: catalogItem?.icon,
      periodicityLabel: catalogItem ? catalogPeriodicityLabel(catalogItem) : undefined,
      isWearTask: !!catalogItem?.is_wear_task,
      wearLevel: catalogItem?.is_wear_task ? 10 : undefined,
    }
  }
  return {
    ...base,
    catalogTaskId: source.catalog_task_id,
    icon: source.icon,
    periodicityLabel: periodicityLabel(source.periodicity) ?? undefined,
    isWearTask: source.is_wear_task,
    wearLevel: source.is_wear_task ? 10 : undefined,
  }
}

export type SidePanelCardVisibility = {
  vehicle: boolean
  upcoming: boolean
  history: boolean
}

/**
 * Visibilité des cards du panneau latéral desktop (story 2.8) selon l'étape active desktop
 * (0=Kilométrage, 1=Tâches réalisées, 2=À prévoir, 3=Dates, 4=Récapitulatif). Cf. table Dev Notes.
 * Pas de card "coût pièces" dans le panneau — le total pièces n'apparaît que sur l'écran Récapitulatif.
 */
export function sidePanelCardVisibility(desktopStep: number): SidePanelCardVisibility {
  return {
    vehicle: true,
    upcoming: desktopStep === 0 || desktopStep === 1,
    history: desktopStep === 0 || desktopStep === 1,
  }
}

export type HistorySummary = {
  id: number
  date: string
  mileage: number | null
  taskNames: string
  partsCost: number
}

/**
 * Résumés d'historique pour le panneau latéral desktop (story 2.8), dédupliqués par tâche catalogue :
 * une tâche déjà réalisée sur une fiche plus récente n'est plus listée sur les fiches plus anciennes
 * (ex. "Bougies" faites deux fois ne doit apparaître que sur l'occurrence la plus récente). Une fiche
 * dont toutes les tâches réalisées sont ainsi supersédées est retirée de la liste retournée.
 * `sheets` doit être trié du plus récent au plus ancien.
 */
export function dedupedHistorySummaries(
  sheets: InterventionSheet[],
  catalogById: Map<number, TaskCatalogItem>,
): HistorySummary[] {
  const seen = new Set<string>()
  const summaries: HistorySummary[] = []
  sheets.forEach((sheet) => {
    const doneTasks = sheet.tasks.filter((task) => task.type === 'done')
    const kept = doneTasks.filter((task) => {
      const identity = taskIdentity(localTaskFromApiTask(task, catalogById))
      return identity == null || !seen.has(identity)
    })
    doneTasks.forEach((task) => {
      const identity = taskIdentity(localTaskFromApiTask(task, catalogById))
      if (identity != null) seen.add(identity)
    })
    if (doneTasks.length > 0 && kept.length === 0) return
    const partsCost = doneTasks.reduce(
      (total, task) => total + computePartsSubtotal(localTaskFromApiTask(task, catalogById).parts),
      0,
    )
    summaries.push({
      id: sheet.id,
      date: sheet.start_date ?? sheet.created_at,
      mileage: sheet.start_mileage ?? null,
      taskNames: kept.map((task) => localTaskFromApiTask(task, catalogById).name).join(', ') || 'Aucune tâche réalisée',
      partsCost,
    })
  })
  return summaries
}

type HttpLikeError = { response?: { status?: number; data?: unknown }; statusCode?: number | string; code?: string; message?: string }

const NETWORK_ERROR_MESSAGE = 'La connexion a échoué. Vos saisies sont gardées sur cet écran.'
const SERVER_ERROR_MESSAGE = 'Le serveur a rencontré un problème. Réessayez dans un instant.'
const GENERIC_ERROR_MESSAGE = 'Une erreur est survenue.'

/** Statut HTTP numérique de l'erreur, `undefined` sans réponse du serveur. */
export function errorStatus(error: unknown): number | undefined {
  const err = error as HttpLikeError
  const status = err?.response?.status ?? err?.statusCode
  return typeof status === 'number' ? status : undefined
}

/** Pas de réponse HTTP du serveur (axios : `code` ERR_NETWORK, ECONNABORTED… ; le data provider le copie dans `statusCode`). */
function isNetworkError(error: unknown): boolean {
  const err = error as HttpLikeError
  if (errorStatus(error) !== undefined) return false
  const code = typeof err?.statusCode === 'string' ? err.statusCode : err?.code
  return (typeof code === 'string' && /^(ERR_|ECONN|ETIMEDOUT)/.test(code)) || err?.message === 'Network Error'
}

/** Aplatit une valeur d'erreur DRF (chaîne, liste, objet imbriqué) en messages lisibles. */
function flattenMessages(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(flattenMessages)
  if (value && typeof value === 'object') return Object.values(value).flatMap(flattenMessages)
  return []
}

/** Échec réseau (pas de réponse) ou 5xx : la saisie est valide, on peut réessayer telle quelle. */
export function isRetryableError(error: unknown): boolean {
  const status = errorStatus(error)
  return status === undefined ? isNetworkError(error) : status >= 500
}

/** Erreurs de validation 400 par champ ; vide pour un échec réseau, un 5xx ou un corps non JSON. */
export function extractFieldErrors(error: unknown): { field: string; message: string }[] {
  if (isRetryableError(error)) return []
  const data = (error as HttpLikeError).response?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return []
  return Object.entries(data)
    .map(([field, value]) => ({ field, message: flattenMessages(value).join(' ') }))
    .filter((entry) => entry.message)
}

/** Message lisible pour une erreur de mutation : champ unique, multi-champs, imbriquée, 5xx/HTML ou réseau. */
export function extractStepError(error: unknown): string {
  if (isNetworkError(error)) return NETWORK_ERROR_MESSAGE
  if (isRetryableError(error)) return SERVER_ERROR_MESSAGE
  const plainMessage = errorStatus(error) === undefined ? (error as HttpLikeError)?.message : undefined
  if (plainMessage) return plainMessage
  const data = (error as HttpLikeError).response?.data
  const messages = typeof data === 'string' ? [] : flattenMessages(data)
  return messages.length ? messages.join(' ') : GENERIC_ERROR_MESSAGE
}
