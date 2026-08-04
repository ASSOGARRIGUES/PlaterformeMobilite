import { useEffect, useMemo, useState } from 'react'
import { useShow, useList, useCustomMutation, useUpdate, useInvalidate, useApiUrl } from '@refinedev/core'
import { InterventionSheet, InterventionTask, LocalTask } from '../../types/garage'
import { TaskCatalogItem } from '../../components/garage/taskCardUtils'
import { localTaskToUpdatePayload, localTaskFromApiTask, extractStepError } from './interventionStepperUtils'

type Section = 'done' | 'planned'

/**
 * Édition d'une fiche d'intervention déjà validée (story 2.7). Dupliquée depuis
 * useInterventionStepper plutôt que partagée : la synchronisation est immédiate ici
 * (vs. différée à goToStep côté stepper), une abstraction commune ajouterait de la
 * complexité pour deux flux qui n'ont plus grand-chose en commun une fois la fiche validée.
 */
export function useValidatedInterventionEdit(sheetId: number) {
  const apiUrl = useApiUrl()
  const invalidate = useInvalidate()

  const { queryResult } = useShow<InterventionSheet>({ resource: 'garage/intervention', id: sheetId })
  const sheet = queryResult.data?.data
  const vehicle = sheet?.vehicle

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

  const [doneTasks, setDoneTasks] = useState<LocalTask[]>([])
  const [plannedTasks, setPlannedTasks] = useState<LocalTask[]>([])
  // Dernier état connu du serveur par tâche : sert de référence pour ne PATCHer que les
  // champs réellement modifiés lors d'un commit (onBlur), sans dépendre du timing de setState.
  const [syncedDoneTasks, setSyncedDoneTasks] = useState<LocalTask[]>([])
  const [syncedPlannedTasks, setSyncedPlannedTasks] = useState<LocalTask[]>([])
  const [initialized, setInitialized] = useState(false)
  const [stepError, setStepError] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    if (!sheet || catalogData === undefined || initialized) return
    const rebuilt = sheet.tasks.map((task) => localTaskFromApiTask(task, catalogById))
    const rebuiltDone = rebuilt.filter((task) => task.type === 'done')
    const rebuiltPlanned = rebuilt.filter((task) => task.type === 'planned')
    setDoneTasks(rebuiltDone)
    setPlannedTasks(rebuiltPlanned)
    setSyncedDoneTasks(rebuiltDone.map((task) => ({ ...task })))
    setSyncedPlannedTasks(rebuiltPlanned.map((task) => ({ ...task })))
    setInitialized(true)
  }, [sheet, catalogData, catalogById, initialized])

  // Autres fiches du véhicule (tous statuts) → avertissement si une fiche plus récente existe
  const { data: siblingData } = useList<InterventionSheet>({
    resource: 'garage/intervention',
    filters: vehicle ? [{ field: 'vehicle', operator: 'eq', value: vehicle.id }] : [],
    pagination: { pageSize: 100 },
    queryOptions: { enabled: !!vehicle },
  })
  const moreRecentSheet = (siblingData?.data ?? [])
    .filter((s) => s.id !== sheetId && sheet != null && s.created_at > sheet.created_at)
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0]

  const { mutateAsync: customMutate, isLoading: isMutating } = useCustomMutation<InterventionTask>()
  const { mutateAsync: updateSheet } = useUpdate()

  const updateSheetField = async (field: 'start_date' | 'end_date', value: string | null) => {
    setStepError(null)
    try {
      await updateSheet({
        resource: 'garage/intervention',
        id: sheetId,
        values: { [field]: value },
        successNotification: false,
      })
    } catch (error) {
      setStepError(extractStepError(error))
    }
  }

  const addTask = async (picked: LocalTask, section: Section) => {
    setStepError(null)
    try {
      const response = await customMutate({
        url: `${apiUrl}/garage/intervention/${sheetId}/tasks/`,
        method: 'post',
        values: {
          type: section,
          catalog_task: picked.catalogTaskId,
          name: picked.catalogTaskId ? undefined : picked.name,
          wear_level: picked.isWearTask ? picked.wearLevel : undefined,
        },
        successNotification: false,
      })
      const rebuilt = { ...localTaskFromApiTask(response.data, catalogById), type: section }
      const setter = section === 'done' ? setDoneTasks : setPlannedTasks
      const syncedSetter = section === 'done' ? setSyncedDoneTasks : setSyncedPlannedTasks
      setter((prev) => [...prev, rebuilt])
      syncedSetter((prev) => [...prev, { ...rebuilt }])
      invalidate({ resource: 'garage/intervention', invalidates: ['list', 'detail'] })
    } catch (error) {
      setStepError(extractStepError(error))
    }
  }

  /** Met à jour l'état local (UI) sans appeler l'API — la sauvegarde se fait via `persistTask`. */
  const updateTaskLocal = (localId: string, patch: Partial<LocalTask>, section: Section) => {
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

  /** Sauvegarde (PATCH) le diff entre l'état local courant et le dernier état connu du serveur. */
  const persistTask = async (localId: string, section: Section) => {
    const list = section === 'done' ? doneTasks : plannedTasks
    const syncedList = section === 'done' ? syncedDoneTasks : syncedPlannedTasks
    const current = list.find((task) => task.localId === localId)
    const synced = syncedList.find((task) => task.localId === localId)
    if (!current || !synced || !current.serverId) return
    const payload = localTaskToUpdatePayload(current, synced)
    if (Object.keys(payload).length === 0) return
    try {
      const response = await customMutate({
        url: `${apiUrl}/garage/intervention/${sheetId}/tasks/${current.serverId}/`,
        method: 'patch',
        values: payload,
        successNotification: false,
      })
      const rebuilt = { ...localTaskFromApiTask(response.data, catalogById), localId, type: section }
      const setter = section === 'done' ? setDoneTasks : setPlannedTasks
      const syncedSetter = section === 'done' ? setSyncedDoneTasks : setSyncedPlannedTasks
      setter((prev) => prev.map((task) => (task.localId === localId ? rebuilt : task)))
      syncedSetter((prev) => prev.map((task) => (task.localId === localId ? rebuilt : task)))
    } catch (error) {
      // conserve l'ancienne valeur locale, ne pas appliquer le patch optimiste
      setStepError(extractStepError(error))
    }
  }

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
      const syncedSetter = section === 'done' ? setSyncedDoneTasks : setSyncedPlannedTasks
      setter((prev) => prev.filter((item) => item.localId !== localId))
      syncedSetter((prev) => prev.filter((item) => item.localId !== localId))
      invalidate({ resource: 'garage/intervention', invalidates: ['list'] })
    } catch (error) {
      setStepError(extractStepError(error))
    }
  }

  return {
    sheet,
    vehicle,
    isLoading: queryResult.isLoading,
    isMutating,
    doneTasks,
    plannedTasks,
    updateSheetField,
    addTask,
    updateTaskLocal,
    persistTask,
    removeTask,
    moreRecentSheet,
    stepError,
    activeStep,
    goToStep: setActiveStep,
  }
}
