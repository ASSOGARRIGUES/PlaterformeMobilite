import { useApiUrl, useCustomMutation, useInvalidate } from '@refinedev/core'
import { openConfirmModal } from '@mantine/modals'
import { Text } from '@mantine/core'
import { showNotification } from '@mantine/notifications'
import { MaintenanceSignalement } from '../../types/garage'

/** « Écarter » un signalement (story 2.13) : confirmation, POST …/dismiss/, puis rechargement de la synthèse d'entretien. */
export function useDismissSignalement(vehicleId: number) {
  const apiUrl = useApiUrl()
  const invalidate = useInvalidate()
  const { mutateAsync } = useCustomMutation()

  const dismiss = async (signalement: MaintenanceSignalement) => {
    try {
      await mutateAsync({
        url: `${apiUrl}/garage/intervention/${signalement.sheet_id}/tasks/${signalement.task_id}/dismiss/`,
        method: 'post',
        values: {},
        successNotification: false,
        errorNotification: false,
      })
    } catch {
      showNotification({ color: 'red', message: "Impossible d'écarter ce signalement" })
    } finally {
      invalidate({ resource: 'garage/maintenance', id: vehicleId, invalidates: ['detail'] })
    }
  }

  const confirmDismiss = (signalement: MaintenanceSignalement) =>
    openConfirmModal({
      title: 'Écarter ce signalement ?',
      children: (
        <Text size="sm">
          Le signalement disparaîtra de « À prévoir ». L&apos;action est tracée (auteur et date).
        </Text>
      ),
      labels: { confirm: 'Écarter', cancel: 'Annuler' },
      onConfirm: () => dismiss(signalement),
    })

  return { confirmDismiss }
}
