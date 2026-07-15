import { useEffect, useMemo, useRef, useState } from 'react'
import { useShow, useList, useCustomMutation, useUpdate, useGo, useInvalidate, useApiUrl } from '@refinedev/core'
import { InterventionSheet, InterventionTask, LocalTask, PatchInterventionPayload } from '../../types/garage'
import { TaskCatalogItem } from '../../components/garage/taskCardUtils'
import {
  localTaskToCreatePayload,
  localTaskToUpdatePayload,
  localTaskFromApiTask,
  hasCriticalWear,
  unresolvedPlannedTasks,
  taskIdentity,
} from './interventionStepperUtils'

type Section = 'done' | 'planned'

/** Extrait un message d'erreur lisible d'une erreur de mutation (400 backend ou HttpError Refine). */
function extractStepError(error: unknown): string {
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

export function useInterventionStepper(sheetId: number) {
  const apiUrl = useApiUrl()
  const go = useGo()
  const invalidate = useInvalidate()

  const { queryResult } = useShow<InterventionSheet>({ resource: 'garage/intervention', id: sheetId })
  const sheet = queryResult.data?.data
  const vehicle = sheet?.vehicle

  // Catalogue de tâches du véhicule (pour reconstruction + périodicités)
  const { data: catalogData } = useList<TaskCatalogItem>({
    resource: 'garage/task-catalog',
    filters: vehicle ? [{ field: 'vehicle_types', operator: 'eq', value: vehicle.type }] : [],
    pagination: { mode: 'off' },
    queryOptions: { enabled: !!vehicle },
  })
  const catalogById = useMemo(() => {
    const map = new Map<number, TaskCatalogItem>()
    ;(catalogData?.data ?? []).forEach((item) => map.set(item.id, item))
    return map
  }, [catalogData])

  // Fiches validées précédentes du véhicule → suggestions "à prévoir" (AC4)
  const { data: validatedData } = useList<InterventionSheet>({
    resource: 'garage/intervention',
    filters: vehicle
      ? [
          { field: 'vehicle', operator: 'eq', value: vehicle.id },
          { field: 'status', operator: 'eq', value: 'validated' },
        ]
      : [],
    pagination: { pageSize: 100 },
    queryOptions: { enabled: !!vehicle },
  })
  const [doneTasks, setDoneTasks] = useState<LocalTask[]>([])
  const [plannedTasks, setPlannedTasks] = useState<LocalTask[]>([])
  const [syncedDoneTasks, setSyncedDoneTasks] = useState<LocalTask[]>([])
  const [syncedPlannedTasks, setSyncedPlannedTasks] = useState<LocalTask[]>([])
  const [activeStep, setActiveStep] = useState(0)
  const [stepError, setStepError] = useState<string | null>(null)
  const [warningOpen, setWarningOpen] = useState(false)
  const [pendingTransition, setPendingTransition] = useState<{ nextStep: number; sheetValues: PatchInterventionPayload } | null>(null)
  const warningConfirmedRef = useRef(false)
  const initializedRef = useRef(false)

  // Suggestions "à prévoir" (AC4) : tâches encore en attente, exclues si déjà cochées "faites" dans la session en cours
  const suggestions = useMemo<LocalTask[]>(() => {
    if (!validatedData) return []
    const previousSheets = validatedData.data.filter((previous) => previous.id !== sheetId)
    const pending = unresolvedPlannedTasks(previousSheets, catalogById)
    const doneIdentities = new Set(doneTasks.map(taskIdentity).filter((identity): identity is string => identity != null))
    return pending.filter((task) => {
      const identity = taskIdentity(task)
      return identity == null || !doneIdentities.has(identity)
    })
  }, [validatedData, catalogById, sheetId, doneTasks])

  // Initialisation unique depuis sheet.tasks une fois la fiche ET le catalogue chargés (AC3)
  useEffect(() => {
    if (!sheet || catalogData === undefined || initializedRef.current) return
    const rebuilt = sheet.tasks.map((task) => localTaskFromApiTask(task, catalogById))
    const done = rebuilt.filter((task) => task.type === 'done')
    const planned = rebuilt.filter((task) => task.type === 'planned')
    setDoneTasks(done)
    setPlannedTasks(planned)
    setSyncedDoneTasks(done)
    setSyncedPlannedTasks(planned)
    setActiveStep(Math.max(0, (sheet.current_step ?? 1) - 1))
    initializedRef.current = true
  }, [sheet, catalogData, catalogById])

  const { mutateAsync: customMutate, isLoading: isMutating } = useCustomMutation<InterventionTask>()
  const { mutateAsync: updateSheet } = useUpdate()

  /** Création immédiate d'une tâche (POST minimal) dès la sélection dans le TaskPicker. */
  const addTask = async (picked: LocalTask, section: Section) => {
    setStepError(null)
    try {
      const response = await customMutate({
        url: `${apiUrl}/garage/intervention/${sheetId}/tasks/`,
        method: 'post',
        values: localTaskToCreatePayload({ ...picked, type: section }),
      })
      const rebuilt = { ...localTaskFromApiTask(response.data, catalogById), type: section }
      const setter = section === 'done' ? setDoneTasks : setPlannedTasks
      const syncSetter = section === 'done' ? setSyncedDoneTasks : setSyncedPlannedTasks
      setter((prev) => [...prev, rebuilt])
      syncSetter((prev) => [...prev, rebuilt])
    } catch (error) {
      setStepError(extractStepError(error))
    }
  }

  /** Édition locale (non synchronisée jusqu'à la transition d'étape). Recalcule photoIds si photos changent. */
  const updateTask = (localId: string, patch: Partial<LocalTask>, section: Section) => {
    const setter = section === 'done' ? setDoneTasks : setPlannedTasks
    setter((prev) =>
      prev.map((task) => {
        if (task.localId !== localId) return task
        const next = { ...task, ...patch }
        if (patch.photos) {
          next.photoIds = patch.photos.map((url) => {
            const index = task.photos.indexOf(url)
            return index >= 0 ? (task.photoIds?.[index] ?? null) : null
          })
        }
        return next
      }),
    )
  }

  /** Suppression immédiate (DELETE si la tâche existe côté serveur). */
  const removeTask = async (localId: string, section: Section) => {
    setStepError(null)
    const list = section === 'done' ? doneTasks : plannedTasks
    const task = list.find((item) => item.localId === localId)
    if (!task) return
    try {
      if (task.serverId) {
        await customMutate({
          url: `${apiUrl}/garage/intervention/${sheetId}/tasks/${task.serverId}/`,
          method: 'delete',
          values: {},
        })
      }
      const setter = section === 'done' ? setDoneTasks : setPlannedTasks
      const syncSetter = section === 'done' ? setSyncedDoneTasks : setSyncedPlannedTasks
      setter((prev) => prev.filter((item) => item.localId !== localId))
      syncSetter((prev) => prev.filter((item) => item.localId !== localId))
    } catch (error) {
      setStepError(extractStepError(error))
    }
  }

  /** Synchronise les éditions de la section quittée, puis PATCH la fiche, puis avance. Abandonne sur échec. */
  const performTransition = async (nextStep: number, sheetValues: PatchInterventionPayload) => {
    const leavingStep = activeStep
    const section: Section | null = leavingStep === 1 ? 'done' : leavingStep === 2 ? 'planned' : null
    try {
      if (section) {
        const tasks = section === 'done' ? doneTasks : plannedTasks
        const synced = section === 'done' ? syncedDoneTasks : syncedPlannedTasks
        const syncedById = new Map(synced.map((task) => [task.localId, task]))
        const setter = section === 'done' ? setDoneTasks : setPlannedTasks
        const syncSetter = section === 'done' ? setSyncedDoneTasks : setSyncedPlannedTasks
        for (const task of tasks) {
          if (!task.serverId) continue
          const previous = syncedById.get(task.localId)
          if (!previous) continue
          const payload = localTaskToUpdatePayload(task, previous)
          if (Object.keys(payload).length === 0) continue
          let response
          try {
            response = await customMutate({
              url: `${apiUrl}/garage/intervention/${sheetId}/tasks/${task.serverId}/`,
              method: 'patch',
              values: payload,
            })
          } catch (error) {
            throw new Error(`Échec de la synchronisation de "${task.name}" : ${extractStepError(error)}`)
          }
          const rebuilt = { ...localTaskFromApiTask(response.data, catalogById), localId: task.localId, type: section }
          setter((prev) => prev.map((item) => (item.localId === task.localId ? rebuilt : item)))
          syncSetter((prev) => prev.map((item) => (item.localId === task.localId ? rebuilt : item)))
        }
      }
      await updateSheet({
        resource: 'garage/intervention',
        id: sheetId,
        values: { current_step: nextStep + 1, ...sheetValues },
      })
      warningConfirmedRef.current = false
      setActiveStep(nextStep)
    } catch (error) {
      setStepError(extractStepError(error))
    }
  }

  /** Transition d'étape (avant/arrière). Ouvre MaintenanceWarningModal en quittant l'étape 2 si usure critique (AC7). */
  const goToStep = async (nextStep: number, sheetValues: PatchInterventionPayload = {}) => {
    setStepError(null)
    if (activeStep === 1 && hasCriticalWear(doneTasks) && !warningConfirmedRef.current) {
      setPendingTransition({ nextStep, sheetValues })
      setWarningOpen(true)
      return
    }
    await performTransition(nextStep, sheetValues)
  }

  const validateSheet = async (sheetValues: PatchInterventionPayload = {}) => {
    setStepError(null)
    if (!vehicle) return
    try {
      await updateSheet({
        resource: 'garage/intervention',
        id: sheetId,
        values: { current_step: 4, ...sheetValues },
      })
      await customMutate({
        url: `${apiUrl}/garage/intervention/${sheetId}/validate/`,
        method: 'post',
        values: {},
      })
      invalidate({ resource: 'garage/intervention', invalidates: ['list', 'detail'] })
      invalidate({ resource: 'vehicle', id: vehicle.id, invalidates: ['detail'] })
      go({ to: `/vehicle/${vehicle.id}` })
    } catch (error) {
      setStepError(extractStepError(error))
    }
  }

  const warningModalProps = {
    opened: warningOpen,
    vehicleImat: vehicle?.imat ?? '',
    cause: 'Une usure critique a été relevée sur une ou plusieurs tâches réalisées. Le véhicule devrait passer en maintenance.',
    onConfirm: async () => {
      warningConfirmedRef.current = true
      setWarningOpen(false)
      const pending = pendingTransition
      setPendingTransition(null)
      if (pending) await performTransition(pending.nextStep, pending.sheetValues)
    },
    onCancel: () => {
      setWarningOpen(false)
      setPendingTransition(null)
    },
  }

  return {
    sheet,
    vehicle,
    isLoading: queryResult.isLoading,
    isMutating,
    doneTasks,
    plannedTasks,
    suggestions,
    catalogById,
    activeStep,
    goToStep,
    addTask,
    updateTask,
    removeTask,
    validateSheet,
    warningModalProps,
    stepError,
  }
}
