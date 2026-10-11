import { useEffect, useMemo, useRef, useState } from 'react'
import { useShow, useList, useOne, useCustomMutation, useUpdate, useGo, useInvalidate, useApiUrl } from '@refinedev/core'
import { showNotification } from '@mantine/notifications'
import { InterventionSheet, InterventionTask, LocalTask, MaintenanceSummary, PatchInterventionPayload, ValidateInterventionResponse } from '../../types/garage'
import { TaskCatalogItem } from '../../components/garage/taskCardUtils'
import {
  localTaskToCreatePayload,
  localTaskToUpdatePayload,
  localTaskFromApiTask,
  pendingSuggestions,
  extractStepError,
} from './interventionStepperUtils'

type Section = 'done' | 'planned'

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

  // Fiches validées précédentes du véhicule → carte "Historique" du panneau latéral
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
  const initializedRef = useRef(false)

  // Fiches validées précédentes (hors fiche courante) — réutilisées pour
  // la carte "Historique" du panneau latéral desktop (story 2.8, pas de nouvel appel réseau)
  const previousSheets = useMemo(
    () => (validatedData?.data ?? []).filter((previous) => previous.id !== sheetId),
    [validatedData, sheetId],
  )
  const history = useMemo(
    () => [...previousSheets].sort((a, b) => (a.created_at > b.created_at ? -1 : 1)),
    [previousSheets],
  )

  // Suggestions : groupes « Dépassé » et « À prévoir » de la synthèse d'entretien (story 2.10). Absente
  // (403, erreur) → aucune suggestion, sans bloquer le stepper.
  const { data: maintenanceData } = useOne<MaintenanceSummary>({
    resource: 'garage/maintenance',
    id: vehicle?.id,
    queryOptions: { enabled: !!vehicle },
  })
  // Vue dérivée de la synthèse et des tâches faites, sans état propre ni identifiant local : les clés React viennent de catalog_task_id / task_id
  const suggestions = useMemo(() => pendingSuggestions(maintenanceData?.data, doneTasks), [maintenanceData, doneTasks])

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
  const { mutateAsync: customMutateValidate } = useCustomMutation<ValidateInterventionResponse>()
  const { mutateAsync: updateSheet, isLoading: isSavingStep } = useUpdate()

  /** Création immédiate d'une tâche (POST minimal) dès la sélection dans le TaskPicker. */
  const addTask = async (picked: LocalTask, section: Section) => {
    setStepError(null)
    try {
      const response = await customMutate({
        url: `${apiUrl}/garage/intervention/${sheetId}/tasks/`,
        method: 'post',
        values: localTaskToCreatePayload({ ...picked, type: section }),
        successNotification: false,
      })
      const rebuilt = { ...localTaskFromApiTask(response.data, catalogById), type: section, sourceSignalementId: picked.sourceSignalementId }
      const setter = section === 'done' ? setDoneTasks : setPlannedTasks
      const syncSetter = section === 'done' ? setSyncedDoneTasks : setSyncedPlannedTasks
      setter((prev) => [rebuilt, ...prev])
      syncSetter((prev) => [rebuilt, ...prev])
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
          successNotification: false,
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
              successNotification: false,
            })
          } catch (error) {
            throw new Error(`Échec de la synchronisation de "${task.name}" : ${extractStepError(error)}`)
          }
          const rebuilt = { ...localTaskFromApiTask(response.data, catalogById), localId: task.localId, type: section, sourceSignalementId: task.sourceSignalementId }
          setter((prev) => prev.map((item) => (item.localId === task.localId ? rebuilt : item)))
          syncSetter((prev) => prev.map((item) => (item.localId === task.localId ? rebuilt : item)))
        }
      }
      await updateSheet({
        resource: 'garage/intervention',
        id: sheetId,
        values: { current_step: nextStep + 1, ...sheetValues },
        successNotification: false,
      })
      setActiveStep(nextStep)
    } catch (error) {
      setStepError(extractStepError(error))
    }
  }

  /** Transition d'étape (avant/arrière). Une usure refusée par le backend bloque la transition via stepError (story 2.10). */
  const goToStep = async (nextStep: number, sheetValues: PatchInterventionPayload = {}) => {
    setStepError(null)
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
      const { data } = await customMutateValidate({
        url: `${apiUrl}/garage/intervention/${sheetId}/validate/`,
        method: 'post',
        values: {},
      })
      invalidate({ resource: 'garage/intervention', invalidates: ['list', 'detail'] })
      invalidate({ resource: 'vehicle', id: vehicle.id, invalidates: ['detail'] })
      // Filet de sécurité : l'encart du formulaire prévient déjà ce cas, mais un relevé peut
      // avoir été saisi entre-temps.
      const warning = data?.warnings?.[0]
      if (warning) {
        showNotification({
          color: 'orange',
          title: 'Kilométrage du véhicule non mis à jour',
          message: warning.message,
          autoClose: false,
        })
      }
      go({ to: `/vehicle/${vehicle.id}` })
    } catch (error) {
      setStepError(extractStepError(error))
    }
  }

  return {
    sheet,
    vehicle,
    isLoading: queryResult.isLoading,
    isMutating,
    isSavingStep,
    doneTasks,
    plannedTasks,
    suggestions,
    maintenanceSummary: maintenanceData?.data,
    history,
    catalogById,
    activeStep,
    goToStep,
    addTask,
    updateTask,
    removeTask,
    validateSheet,
    stepError,
  }
}
