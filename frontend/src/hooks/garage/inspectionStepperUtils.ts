import {
  InspectionDamage,
  InspectionSheet,
  InspectionTask,
  LocalDamage,
  LocalTask,
  MaintenanceSummary,
  PatchInspectionPayload,
} from '../../types/garage'
import { TaskCatalogItem, newLocalId } from '../../components/garage/taskCardUtils'
import { catalogPeriodicityLabel } from '../../components/garage/periodicityUtils'

/** Les 7 étapes fixes du contrôle (index 0-based dans tout le code ; `current_step` côté API est 1-based). */
export const INSPECTION_STEP_LABELS = ['Kilométrage', 'Niveaux', 'Usure', 'Éclairage', 'Dégâts', 'Essai', 'À prévoir']
export const INSPECTION_STEP_COUNT = INSPECTION_STEP_LABELS.length
export const WEAR_STEP = 2

/** Tâches d'usure par page (replié à 1 si la place manque, cf. README passation §2). */
export const WEAR_PER_PAGE = 2

/** Sous cette hauteur utile (px), deux cartes d'usure ne tiennent plus sans défilement : on passe à une carte par page. */
export const WEAR_TWO_CARDS_MIN_HEIGHT = 600

/** Nombre de cartes d'usure par page selon la hauteur visible (clavier ouvert, petit écran, police agrandie). */
export function wearPerPageFor(viewportHeight: number): number {
  return viewportHeight < WEAR_TWO_CARDS_MIN_HEIGHT ? 1 : WEAR_PER_PAGE
}

/** Saisies du garagiste sur les champs de la fiche elle-même (dégâts et « à prévoir » passent par des sous-ressources). */
export type InspectionDraft = {
  startMileage: number | null
  oil: boolean | null
  coolant: boolean | null
  washer: boolean | null
  /** id de tâche catalogue -> niveau 0-10 ; une tâche non mesurée est absente. */
  wear: Record<number, number>
  lightsOk: boolean | null
  lightsNotes: string
  roadTestDone: boolean | null
  roadTestNotes: string
}

export function emptyDraft(): InspectionDraft {
  return {
    startMileage: null,
    oil: null,
    coolant: null,
    washer: null,
    wear: {},
    lightsOk: null,
    lightsNotes: '',
    roadTestDone: null,
    roadTestNotes: '',
  }
}

export function draftFromSheet(sheet: InspectionSheet): InspectionDraft {
  return {
    startMileage: sheet.start_mileage ?? null,
    oil: sheet.oil_ok ?? null,
    coolant: sheet.coolant_ok ?? null,
    washer: sheet.washer_ok ?? null,
    wear: Object.fromEntries(sheet.wear_measurements.map((measurement) => [measurement.catalog_task, measurement.level])),
    lightsOk: sheet.lights_ok ?? null,
    lightsNotes: sheet.lights_notes ?? '',
    roadTestDone: sheet.road_test_done ?? null,
    roadTestNotes: sheet.road_test_notes ?? '',
  }
}

function sameWear(a: Record<number, number>, b: Record<number, number>): boolean {
  const keysA = Object.keys(a)
  return keysA.length === Object.keys(b).length && keysA.every((key) => a[Number(key)] === b[Number(key)])
}

/** Champs écrits quand on quitte chaque étape (index 0-based) ; les autres champs ne sont jamais renvoyés. */
function changedFields(step: number, draft: InspectionDraft, saved: InspectionDraft): PatchInspectionPayload {
  const patch: PatchInspectionPayload = {}
  if (step === 0 && draft.startMileage !== saved.startMileage && draft.startMileage != null) {
    patch.start_mileage = draft.startMileage
  }
  if (step === 1) {
    if (draft.oil !== saved.oil) patch.oil_ok = draft.oil
    if (draft.coolant !== saved.coolant) patch.coolant_ok = draft.coolant
    if (draft.washer !== saved.washer) patch.washer_ok = draft.washer
  }
  if (step === WEAR_STEP && !sameWear(draft.wear, saved.wear)) {
    // Remplacement complet côté API : toujours toute la liste mesurée, jamais la seule page affichée.
    patch.wear_measurements = Object.keys(draft.wear)
      .map(Number)
      .sort((a, b) => a - b)
      .map((catalogTask) => ({ catalog_task: catalogTask, level: draft.wear[catalogTask] }))
  }
  if (step === 3) {
    if (draft.lightsOk !== saved.lightsOk) patch.lights_ok = draft.lightsOk
    if (draft.lightsNotes !== saved.lightsNotes) patch.lights_notes = draft.lightsNotes
  }
  if (step === 5) {
    if (draft.roadTestDone !== saved.roadTestDone) patch.road_test_done = draft.roadTestDone
    if (draft.roadTestNotes !== saved.roadTestNotes) patch.road_test_notes = draft.roadTestNotes
  }
  return patch
}

/** PATCH minimal à l'envoi d'une étape : champs modifiés de l'étape quittée + `current_step` de l'étape cible. */
export function buildStepPatch(
  leavingStep: number,
  targetStep: number,
  draft: InspectionDraft,
  saved: InspectionDraft,
): PatchInspectionPayload {
  return { ...changedFields(leavingStep, draft, saved), current_step: targetStep + 1 }
}

/** Copie dans `saved` les champs de l'étape quittée une fois le PATCH accepté. */
export function markStepSaved(step: number, draft: InspectionDraft, saved: InspectionDraft): InspectionDraft {
  const fieldsByStep: Record<number, (keyof InspectionDraft)[]> = {
    0: ['startMileage'],
    1: ['oil', 'coolant', 'washer'],
    [WEAR_STEP]: ['wear'],
    3: ['lightsOk', 'lightsNotes'],
    5: ['roadTestDone', 'roadTestNotes'],
  }
  const next = { ...saved }
  const target = next as Record<string, unknown>
  ;(fieldsByStep[step] ?? []).forEach((key) => {
    target[key] = draft[key]
  })
  return next
}

/** Découpe les tâches mesurables en pages (2 + 1 pour 3 tâches, 2 + 2 + 1 pour 5, aucune page pour 0). */
export function chunkWearTasks<T>(tasks: T[], perPage: number): T[][] {
  const pages: T[][] = []
  for (let i = 0; i < tasks.length; i += perPage) pages.push(tasks.slice(i, i + perPage))
  return pages
}

const FIELD_STEPS: Record<string, { step: number; label: string }> = {
  start_mileage: { step: 0, label: 'Kilométrage' },
  start_date: { step: 0, label: 'Date' },
  oil_ok: { step: 1, label: 'Huile' },
  coolant_ok: { step: 1, label: 'Refroidissement' },
  washer_ok: { step: 1, label: 'Lave-glace' },
  wear_measurements: { step: WEAR_STEP, label: 'Usure' },
  lights_ok: { step: 3, label: 'Éclairage' },
  lights_notes: { step: 3, label: 'Éclairage' },
  road_test_done: { step: 5, label: 'Essai routier' },
  road_test_notes: { step: 5, label: 'Essai routier' },
}

/** Étape (0-based) à rouvrir pour corriger un champ refusé par l'API ; null si le champ n'a pas d'étape propre. */
export function fieldErrorStep(field: string): number | null {
  return FIELD_STEPS[field]?.step ?? null
}

export type GroupedFieldError = { field: string; label: string | null; message: string; step: number | null }

export function groupFieldErrors(errors: { field: string; message: string }[]): GroupedFieldError[] {
  return errors.map(({ field, message }) => ({
    field,
    label: FIELD_STEPS[field]?.label ?? null,
    message,
    step: fieldErrorStep(field),
  }))
}

// ── Dégâts (étape 5) ─────────────────────────────────────────────────────────

export function localDamageFromApi(damage: InspectionDamage): LocalDamage {
  return {
    localId: newLocalId(),
    serverId: damage.id,
    description: damage.description,
    photos: damage.photos.map((photo) => photo.url),
    photoIds: damage.photos.map((photo) => photo.id),
  }
}

export function damageToCreatePayload(damage: LocalDamage): { description: string; photos: string[] } {
  return { description: damage.description, photos: damage.photos.filter((photo) => photo.startsWith('data:')) }
}

/** Diff minimal d'un dégât déjà enregistré : description, photos ajoutées (base64), photos retirées (par id). */
export function damageToUpdatePayload(
  current: LocalDamage,
  previous: LocalDamage,
): { description?: string; add_photos?: string[]; remove_photo_ids?: number[] } {
  const payload: { description?: string; add_photos?: string[]; remove_photo_ids?: number[] } = {}
  if (current.description !== previous.description) payload.description = current.description
  const addPhotos = current.photos.filter((photo) => photo.startsWith('data:') && !previous.photos.includes(photo))
  if (addPhotos.length) payload.add_photos = addPhotos
  const removeIds: number[] = []
  previous.photos.forEach((url, index) => {
    const id = previous.photoIds?.[index]
    if (!current.photos.includes(url) && id != null) removeIds.push(id)
  })
  if (removeIds.length) payload.remove_photo_ids = removeIds
  return payload
}

// ── Opérations à prévoir (étape 7) ───────────────────────────────────────────

/** Tâche « à prévoir » d'une fiche de contrôle : ni pièces, ni prix, ni usure (description et photos seulement). */
export function localPlannedTaskFromApi(task: InspectionTask, catalogById: Map<number, TaskCatalogItem>): LocalTask {
  const catalogItem = task.catalog_task != null ? catalogById.get(task.catalog_task) : undefined
  return {
    localId: newLocalId(),
    serverId: task.id,
    sheetId: task.sheet,
    catalogTaskId: task.catalog_task ?? undefined,
    name: task.catalog_task != null ? (catalogItem?.name ?? 'Tâche') : (task.name ?? ''),
    type: 'planned',
    periodicityLabel: catalogItem ? catalogPeriodicityLabel(catalogItem) : undefined,
    icon: catalogItem?.icon,
    isWearTask: false,
    description: task.description ?? '',
    parts: [],
    photos: task.photos.map((photo) => photo.url),
    photoIds: task.photos.map((photo) => photo.id),
  }
}

// ── Dernier relevé d'usure (carte « aérée » d'une tâche unique) ──────────────

/** Dernière mesure par tâche : la mesure d'un contrôle, sinon l'état de la pièce posée à la dernière réalisation. */
export function lastWearByTask(summary: MaintenanceSummary | undefined): Record<number, { level: number; date: string | null }> {
  const result: Record<number, { level: number; date: string | null }> = {}
  summary?.tasks.forEach((task) => {
    if (task.last_measurement) {
      result[task.catalog_task_id] = { level: task.last_measurement.level, date: task.last_measurement.date }
    } else if (task.last_realization?.wear_level != null) {
      result[task.catalog_task_id] = { level: task.last_realization.wear_level, date: task.last_realization.date }
    }
  })
  return result
}
