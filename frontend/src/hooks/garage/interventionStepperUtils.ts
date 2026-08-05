import {
  LocalTask,
  LocalTaskPart,
  InterventionTask,
  InterventionSheet,
  CreateInterventionTaskPayload,
  UpdateInterventionTaskPayload,
} from '../../types/garage'
import { TaskCatalogItem, periodicityLabel, isWearLevelCritical } from '../../components/garage/taskCardUtils'

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
    localId: crypto.randomUUID(),
    catalogTaskId: apiTask.catalog_task ?? undefined,
    name: apiTask.catalog_task != null ? (catalogItem?.name ?? 'Tâche') : (apiTask.name ?? ''),
    type: apiTask.type as LocalTask['type'],
    periodicityLabel: catalogItem ? periodicityLabel(catalogItem) : undefined,
    isWearTask: !!catalogItem?.is_wear_task,
    wearLevel: apiTask.wear_level ?? undefined,
    description: apiTask.description ?? '',
    parts: apiTask.parts.map((part) => ({
      localId: crypto.randomUUID(),
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

/**
 * Tâches "à prévoir" encore en attente parmi un ensemble de fiches validées : exclut celles
 * déjà réalisées ("done") dans une fiche postérieure (retour story 2.6, points 2-3).
 */
export function unresolvedPlannedTasks(
  sheets: { created_at: string; tasks: InterventionTask[] }[],
  catalogById: Map<number, TaskCatalogItem>,
): LocalTask[] {
  const latestDoneAt = new Map<string, string>()
  sheets.forEach((sheet) => {
    sheet.tasks
      .filter((task) => task.type === 'done')
      .forEach((task) => {
        const identity = taskIdentity(localTaskFromApiTask(task, catalogById))
        if (identity == null) return
        const current = latestDoneAt.get(identity)
        if (!current || sheet.created_at > current) latestDoneAt.set(identity, sheet.created_at)
      })
  })

  const pending: LocalTask[] = []
  sheets.forEach((sheet) => {
    sheet.tasks
      .filter((task) => task.type === 'planned')
      .forEach((task) => {
        const local = localTaskFromApiTask(task, catalogById)
        const identity = taskIdentity(local)
        const resolvedAt = identity != null ? latestDoneAt.get(identity) : undefined
        if (!resolvedAt || sheet.created_at > resolvedAt) pending.push(local)
      })
  })
  return pending
}

/** Vrai si au moins une tâche d'usure est ≤ au seuil critique (stopgap frontend, story 2.5). */
export function hasCriticalWear(tasks: LocalTask[], threshold?: number): boolean {
  return tasks.some(
    (task) => task.isWearTask && task.wearLevel !== undefined && isWearLevelCritical(task.wearLevel, threshold),
  )
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
      (total, task) => total + task.parts.reduce((sum, part) => sum + Number(part.unit_price) * (part.quantity ?? 1), 0),
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

/** Extrait un message d'erreur lisible d'une erreur de mutation (400 backend ou HttpError Refine). */
export function extractStepError(error: unknown): string {
  const err = error as { response?: { data?: Record<string, unknown> }; message?: string }
  const data = err?.response?.data
  if (data && typeof data === 'object') {
    const firstKey = Object.keys(data)[0]
    const value = firstKey ? data[firstKey] : undefined
    if (Array.isArray(value) && value.length) return String(value[0])
    if (typeof value === 'string') return value
  }
  return err?.message ?? 'Une erreur est survenue.'
}
