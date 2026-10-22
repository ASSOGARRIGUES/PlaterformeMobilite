import { useEffect, useMemo, useRef, useState } from 'react'
import { useApiUrl, useCustom, useCustomMutation, useInvalidate, useList } from '@refinedev/core'
import { openConfirmModal } from '@mantine/modals'
import { Text } from '@mantine/core'
import { InspectionSheet, LocalDamage, LocalTask, MeasurableTask } from '../../types/garage'
import { TaskCatalogItem, newLocalId } from '../../components/garage/taskCardUtils'
import { WearConfig, WEAR_ZONES, wearZoneKey } from '../../components/garage/wearUtils'
import { localTaskToUpdatePayload } from './interventionStepperUtils'
import {
  InspectionDraft,
  damageToCreatePayload,
  damageToUpdatePayload,
  draftFromSheet,
  localDamageFromApi,
  localPlannedTaskFromApi,
} from './inspectionStepperUtils'
import { SLIDER_DEBOUNCE_MS, useSaveEngine } from './useSaveEngine'
import { WearInput } from '../../components/garage/WearTaskCard'

export type EditValues = Omit<InspectionDraft, 'startMileage'> & { damages: LocalDamage[]; planned: LocalTask[] }

type ScalarKey = 'oil' | 'coolant' | 'washer' | 'lightsOk' | 'lightsNotes' | 'roadTestDone' | 'roadTestNotes'
type Scalars = Pick<EditValues, ScalarKey>

const API_FIELD: Record<ScalarKey, string> = {
  oil: 'oil_ok',
  coolant: 'coolant_ok',
  washer: 'washer_ok',
  lightsOk: 'lights_ok',
  lightsNotes: 'lights_notes',
  roadTestDone: 'road_test_done',
  roadTestNotes: 'road_test_notes',
}

const okText = (value: boolean | null) => (value === true ? 'OK' : value === false ? 'Défaut' : 'Non vérifié')
const doneText = (value: boolean | null) => (value === true ? 'Réalisé' : value === false ? 'Non réalisé' : 'Non renseigné')
const textOf = (value: string) => (value ? `« ${value} »` : 'vide')
const countText = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

/** Zone + niveau pour l'alerte : « 5/10 · À surveiller », ou « Non mesuré ». */
export function wearText(level: number | undefined, config: WearConfig): string {
  if (level == null) return 'Non mesuré'
  const zone = wearZoneKey(level, config)
  return `${level}/10${zone ? ` · ${WEAR_ZONES[zone].label}` : ''}`
}

export function confirmRemoval(title: string, message: string, onConfirm: () => void) {
  openConfirmModal({
    title,
    children: <Text size="sm">{message}</Text>,
    labels: { confirm: 'Supprimer', cancel: 'Annuler' },
    confirmProps: { color: 'red' },
    onConfirm,
  })
}

type Options = { wearConfig: WearConfig; vehicleType: string; onForbidden?: (message: string) => void }

/**
 * Édition d'une fiche de contrôle validée (story 3.3) : chaque changement est enregistré aussitôt, champ par champ, via l'API
 * de la 3.1. Pas d'invalidation pendant l'édition (elle réinitialiserait la saisie) : `finish()` rafraîchit liste, détail et
 * synthèse d'entretien. Les valeurs vivent dans `values` ; `saved` est le dernier état connu du serveur.
 */
export function useValidatedInspectionEdit(sheet: InspectionSheet, { wearConfig, vehicleType, onForbidden }: Options) {
  const apiUrl = useApiUrl()
  const invalidate = useInvalidate()
  const { mutateAsync } = useCustomMutation()
  const engine = useSaveEngine(onForbidden)
  const base = `${apiUrl}/garage/inspection/${sheet.id}`

  const { data: catalogData } = useList<TaskCatalogItem>({
    resource: 'garage/task-catalog',
    filters: [{ field: 'vehicle_types', operator: 'eq', value: vehicleType }],
    pagination: { mode: 'off' },
  })
  const catalogById = useMemo(() => new Map((catalogData?.data ?? []).map((item) => [item.id, item])), [catalogData])
  const { data: measurableData } = useCustom<MeasurableTask[]>({
    url: `${apiUrl}/garage/inspection/measurable-tasks/`,
    method: 'get',
    config: { query: { vehicle: sheet.vehicle.id } },
  })
  const measurableTasks = useMemo(() => measurableData?.data ?? [], [measurableData])

  const initial = useMemo<EditValues>(() => {
    const { startMileage: _ignored, ...scalars } = draftFromSheet(sheet) // eslint-disable-line @typescript-eslint/no-unused-vars
    return { ...scalars, damages: sheet.damages.map(localDamageFromApi), planned: [] }
    // Initialisation unique : la fiche ne doit plus réécraser la saisie en cours.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [values, setValues] = useState<EditValues>(initial)
  const valuesRef = useRef(values)
  /** Met à jour l'état ET sa copie synchrone : `execute` lit `valuesRef` dans la même tick que `apply`. */
  const update = (change: (current: EditValues) => EditValues) => {
    valuesRef.current = change(valuesRef.current)
    setValues(valuesRef.current)
  }
  const savedRef = useRef<EditValues>(initial)

  // Les opérations à prévoir ont besoin du catalogue (nom, périodicité, icône) : construites dès qu'il est chargé.
  const plannedReady = useRef(false)
  useEffect(() => {
    if (plannedReady.current || catalogData === undefined) return
    plannedReady.current = true
    const planned = sheet.tasks.map((task) => localPlannedTaskFromApi(task, catalogById))
    savedRef.current = { ...savedRef.current, planned }
    update((current) => ({ ...current, planned: planned.map((task) => ({ ...task })) }))
  }, [catalogData, catalogById, sheet.tasks])

  const request = (url: string, method: 'post' | 'patch' | 'delete', payload: Record<string, unknown> = {}) =>
    mutateAsync({ url: `${base}/${url}`, method, values: payload, successNotification: false, errorNotification: false })

  // ── Champs de la fiche (niveaux, éclairage, essai) ────────────────────────

  /** Un appel = un groupe de champs ; `changes` à 2 champs partent et reviennent ensemble (éclairage OK efface la note). */
  const commitScalars = (group: string, label: string, changes: Partial<Scalars>, texts: { attempted: string; restored: (saved: Scalars) => string }) => {
    const keys = Object.keys(changes) as ScalarKey[]
    engine.run({
      group,
      channel: 'sheet',
      label,
      attempted: texts.attempted,
      restored: () => texts.restored(savedRef.current),
      apply: () => update((current) => ({ ...current, ...changes })),
      execute: async () => {
        await request('', 'patch', Object.fromEntries(keys.map((key) => [API_FIELD[key], changes[key]])))
        savedRef.current = { ...savedRef.current, ...changes }
      },
      restore: () => update((current) => ({ ...current, ...Object.fromEntries(keys.map((key) => [key, savedRef.current[key]])) })),
    })
  }

  const setLevel = (key: 'oil' | 'coolant' | 'washer', label: string, next: boolean | null) =>
    commitScalars(`levels.${key}`, label, { [key]: next }, { attempted: okText(next), restored: (saved) => okText(saved[key]) })

  const setLights = (ok: boolean) => {
    const saved = savedRef.current
    const clearsNote = ok && saved.lightsNotes !== ''
    commitScalars('lights', 'Éclairage', clearsNote ? { lightsOk: ok, lightsNotes: '' } : { lightsOk: ok }, {
      attempted: okText(ok),
      restored: (s) => (clearsNote ? `${okText(s.lightsOk)}, ${textOf(s.lightsNotes)}` : okText(s.lightsOk)),
    })
  }

  const setText = (key: 'lightsNotes' | 'roadTestNotes', group: string, label: string, text: string) => {
    if (text === savedRef.current[key]) return
    commitScalars(group, label, { [key]: text }, { attempted: textOf(text), restored: (saved) => textOf(saved[key]) })
  }

  const setRoadTest = (done: boolean) =>
    commitScalars('roadtest', 'Essai routier', { roadTestDone: done }, { attempted: doneText(done), restored: (saved) => doneText(saved.roadTestDone) })

  /** Saisie locale d'un texte (sans envoi) : l'envoi se fait à la sortie du champ. */
  const typeText = (key: 'lightsNotes' | 'roadTestNotes', text: string) => update((current) => ({ ...current, [key]: text }))

  // ── Usure : liste complète de la fiche, remplacée à chaque envoi ──────────

  const setWear = (task: MeasurableTask, level: number | null, input: WearInput) => {
    if (level == null || level === valuesRef.current.wear[task.id]) return // retirer une mesure d'une fiche validée est refusé par l'API
    engine.run({
      group: `wear.${task.id}`,
      channel: 'wear',
      label: task.name,
      attempted: wearText(level, wearConfig),
      restored: () => wearText(savedRef.current.wear[task.id], wearConfig),
      apply: () => update((current) => ({ ...current, wear: { ...current.wear, [task.id]: level } })),
      delay: input === 'slider' ? SLIDER_DEBOUNCE_MS : undefined,
      execute: async () => {
        // Base = ce que le serveur connaît + cette tâche : une autre mesure encore en vol ne peut pas être écrasée.
        const sent = valuesRef.current.wear[task.id]
        const list = { ...savedRef.current.wear, [task.id]: sent }
        await request('', 'patch', {
          wear_measurements: Object.keys(list).map(Number).sort((a, b) => a - b).map((catalog_task) => ({ catalog_task, level: list[catalog_task] })),
        })
        savedRef.current = { ...savedRef.current, wear: list }
      },
      restore: () => update((current) => {
        const wear = { ...current.wear }
        const was = savedRef.current.wear[task.id]
        if (was === undefined) delete wear[task.id]
        else wear[task.id] = was
        return { ...current, wear }
      }),
    })
  }

  // ── Dégâts ────────────────────────────────────────────────────────────────

  const damageIndex = (localId: string) => valuesRef.current.damages.findIndex((damage) => damage.localId === localId)
  const savedDamage = (localId: string) => savedRef.current.damages.find((damage) => damage.localId === localId)
  const patchDamage = (localId: string, patch: Partial<LocalDamage>) =>
    update((current) => ({ ...current, damages: current.damages.map((damage) => (damage.localId === localId ? { ...damage, ...patch } : damage)) }))
  const damageLabel = (localId: string, suffix: string) => `Dégât ${damageIndex(localId) + 1} · ${suffix}`

  /** Écrit un dégât (création si jamais envoyé, sinon diff minimal) ; `fields` : ce que restaure un échec. */
  const persistDamage = (localId: string, group: string, suffix: string, fields: ('description' | 'photos')[], attempted: string, restoredText: () => string) =>
    engine.run({
      group,
      channel: `damage.${localId}`,
      label: damageLabel(localId, suffix),
      attempted,
      restored: restoredText,
      apply: () => undefined,
      execute: async () => {
        const current = valuesRef.current.damages.find((damage) => damage.localId === localId)
        if (!current) return
        const previous = savedDamage(localId)
        const response = previous && current.serverId
          ? await request(`damages/${current.serverId}/`, 'patch', damageToUpdatePayload(current, previous))
          : await request('damages/', 'post', damageToCreatePayload(current))
        const rebuilt = { ...localDamageFromApi(response.data as never), localId }
        savedRef.current = {
          ...savedRef.current,
          damages: previous ? savedRef.current.damages.map((damage) => (damage.localId === localId ? rebuilt : damage)) : [...savedRef.current.damages, rebuilt],
        }
        patchDamage(localId, { serverId: rebuilt.serverId, photos: rebuilt.photos, photoIds: rebuilt.photoIds })
      },
      restore: () => {
        const previous = savedDamage(localId)
        if (!previous) return // jamais enregistré : la carte reste en brouillon local
        patchDamage(localId, {
          ...(fields.includes('description') ? { description: previous.description } : {}),
          ...(fields.includes('photos') ? { photos: previous.photos, photoIds: previous.photoIds } : {}),
        })
      },
    })

  const addDamage = () =>
    update((current) => ({ ...current, damages: [...current.damages, { localId: newLocalId(), description: '', photos: [], photoIds: [] }] }))

  const typeDamageDescription = (localId: string, description: string) => patchDamage(localId, { description })

  /** À la sortie du champ : une description vide n'est jamais envoyée pour un nouveau dégât (brouillon local). */
  const commitDamageDescription = (localId: string) => {
    const current = valuesRef.current.damages.find((damage) => damage.localId === localId)
    if (!current) return
    const previous = savedDamage(localId)
    if (!previous && !current.description.trim()) return
    if (previous && current.description === previous.description) return
    persistDamage(localId, `damage.${localId}.description`, 'Description', ['description'], textOf(current.description), () => textOf(previous?.description ?? ''))
  }

  const addDamagePhoto = (localId: string, dataUrl: string) => {
    const current = valuesRef.current.damages.find((damage) => damage.localId === localId)
    if (!current) return
    patchDamage(localId, { photos: [...current.photos, dataUrl], photoIds: [...(current.photoIds ?? current.photos.map(() => null)), null] })
    // Un dégât jamais envoyé garde ses photos en local ; elles partent avec sa description.
    if (!savedDamage(localId)) return
    const count = current.photos.length + 1
    persistDamage(localId, `damage.${localId}.photos`, 'Photos', ['photos'], countText(count, 'photo', 'photos'), () => countText(savedDamage(localId)?.photos.length ?? 0, 'photo', 'photos'))
  }

  const removeDamagePhoto = (localId: string, index: number) =>
    confirmRemoval('Supprimer cette photo ?', 'La photo sera retirée du dégât. Cette action est tracée.', () => {
      const current = valuesRef.current.damages.find((damage) => damage.localId === localId)
      if (!current) return
      patchDamage(localId, {
        photos: current.photos.filter((_, i) => i !== index),
        photoIds: (current.photoIds ?? current.photos.map(() => null)).filter((_, i) => i !== index),
      })
      if (!savedDamage(localId)) return
      const count = current.photos.length - 1
      persistDamage(localId, `damage.${localId}.photos`, 'Photos', ['photos'], countText(count, 'photo', 'photos'), () => countText(savedDamage(localId)?.photos.length ?? 0, 'photo', 'photos'))
    })

  const removeDamage = (localId: string) =>
    confirmRemoval('Supprimer ce dégât ?', 'Le dégât et ses photos seront supprimés de la fiche. Cette action est tracée.', () => {
      const current = valuesRef.current.damages.find((damage) => damage.localId === localId)
      if (!current) return
      const drop = () => {
        update((cur) => ({ ...cur, damages: cur.damages.filter((damage) => damage.localId !== localId) }))
        savedRef.current = { ...savedRef.current, damages: savedRef.current.damages.filter((damage) => damage.localId !== localId) }
      }
      if (!current.serverId) return drop()
      engine.run({
        group: 'damages',
        channel: `damage.${localId}`,
        label: 'Dégâts',
        attempted: 'dégât supprimé',
        restored: () => 'dégât conservé',
        apply: drop,
        execute: async () => { await request(`damages/${current.serverId}/`, 'delete') },
        restore: () => {
          update((cur) => ({ ...cur, damages: [...cur.damages, current] }))
          savedRef.current = { ...savedRef.current, damages: [...savedRef.current.damages, current] }
        },
      })
    })

  // ── Opérations à prévoir ──────────────────────────────────────────────────

  const addPlanned = (picked: LocalTask) =>
    engine.run({
      group: 'ops',
      channel: 'ops',
      label: 'À prévoir',
      attempted: `ajout de « ${picked.name} »`,
      restored: () => 'aucun ajout',
      apply: () => undefined,
      execute: async () => {
        const response = await request('tasks/', 'post', picked.catalogTaskId ? { catalog_task: picked.catalogTaskId } : { name: picked.name })
        const rebuilt = localPlannedTaskFromApi(response.data as never, catalogById)
        savedRef.current = { ...savedRef.current, planned: [rebuilt, ...savedRef.current.planned] }
        update((current) => ({ ...current, planned: [{ ...rebuilt }, ...current.planned] }))
      },
      restore: () => undefined,
    })

  const changePlannedLocal = (task: LocalTask) =>
    update((current) => ({ ...current, planned: current.planned.map((item) => (item.localId === task.localId ? task : item)) }))

  /** `committed` : la tâche transmise par `onCommit` (le state de la closure peut être en retard). */
  const persistPlanned = (committed: LocalTask) => {
    const previous = savedRef.current.planned.find((task) => task.localId === committed.localId)
    if (!previous || !committed.serverId) return
    const payload = localTaskToUpdatePayload(committed, previous)
    const fields = Object.keys(payload)
    if (!fields.length) return
    const photos = fields.some((field) => field === 'add_photos' || field === 'remove_photo_ids')
    engine.run({
      group: `ops.${committed.localId}`,
      channel: `ops.${committed.localId}`,
      label: `À prévoir · ${committed.name}`,
      attempted: photos ? countText(committed.photos.length, 'photo', 'photos') : textOf(committed.description ?? ''),
      restored: () => (photos ? countText(previous.photos.length, 'photo', 'photos') : textOf(savedRef.current.planned.find((task) => task.localId === committed.localId)?.description ?? '')),
      apply: () => changePlannedLocal(committed),
      execute: async () => {
        const response = await request(`tasks/${committed.serverId}/`, 'patch', payload)
        const rebuilt = { ...localPlannedTaskFromApi(response.data as never, catalogById), localId: committed.localId }
        savedRef.current = { ...savedRef.current, planned: savedRef.current.planned.map((task) => (task.localId === committed.localId ? rebuilt : task)) }
        changePlannedLocal(rebuilt)
      },
      // Seuls les champs du payload rejeté reprennent leur valeur enregistrée.
      restore: () => {
        const saved = savedRef.current.planned.find((task) => task.localId === committed.localId) ?? previous
        update((current) => ({
          ...current,
          planned: current.planned.map((task) => task.localId !== committed.localId ? task : {
            ...task,
            ...(fields.includes('description') ? { description: saved.description } : {}),
            ...(fields.includes('name') ? { name: saved.name } : {}),
            ...(photos ? { photos: saved.photos, photoIds: saved.photoIds } : {}),
          }),
        }))
      },
    })
  }

  const removePlanned = (localId: string) =>
    confirmRemoval('Supprimer cette opération ?', "L'opération sera retirée de la fiche. Cette action est tracée.", () => {
      const task = valuesRef.current.planned.find((item) => item.localId === localId)
      if (!task) return
      const drop = () => {
        update((current) => ({ ...current, planned: current.planned.filter((item) => item.localId !== localId) }))
        savedRef.current = { ...savedRef.current, planned: savedRef.current.planned.filter((item) => item.localId !== localId) }
      }
      if (!task.serverId) return drop()
      engine.run({
        group: 'ops',
        channel: `ops.${localId}`,
        label: 'À prévoir',
        attempted: `retrait de « ${task.name} »`,
        restored: () => 'opération conservée',
        apply: drop,
        execute: async () => { await request(`tasks/${task.serverId}/`, 'delete') },
        restore: () => {
          update((current) => ({ ...current, planned: [task, ...current.planned] }))
          savedRef.current = { ...savedRef.current, planned: [task, ...savedRef.current.planned] }
        },
      })
    })

  /** Sortie du mode édition : liste, détail et synthèse d'entretien sont rafraîchis (les saisies ne sont plus en vol). */
  const finish = () => {
    invalidate({ resource: 'garage/inspection', invalidates: ['list', 'detail'] })
    invalidate({ resource: 'garage/maintenance', id: sheet.vehicle.id, invalidates: ['detail'] })
  }

  return {
    values,
    engine,
    measurableTasks,
    catalogReady: catalogData !== undefined,
    setLevel,
    setLights,
    setRoadTest,
    typeText,
    setText,
    setWear,
    addDamage,
    typeDamageDescription,
    commitDamageDescription,
    addDamagePhoto,
    removeDamagePhoto,
    removeDamage,
    addPlanned,
    changePlannedLocal,
    persistPlanned,
    removePlanned,
    finish,
  }
}


