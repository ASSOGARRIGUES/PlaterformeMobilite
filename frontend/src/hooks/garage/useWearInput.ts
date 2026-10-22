import { useApiUrl, useCustomMutation, useGetIdentity } from '@refinedev/core'
import { WearInput } from '../../components/garage/WearTaskCard'
import { WhoAmI } from '../../types/auth'

/** Saisie d'usure préférée du compte (`slider` par défaut, y compris tant que l'identité charge). */
export function useWearInput() {
  const apiUrl = useApiUrl()
  const { data: identity, refetch: refetchIdentity } = useGetIdentity<WhoAmI>()
  const { mutateAsync } = useCustomMutation()

  const value: WearInput = identity?.inspection_wear_input === 'segments' ? 'segments' : 'slider'

  const setValue = async (next: WearInput) => {
    await mutateAsync({
      url: `${apiUrl}/whoami/preferences/`,
      method: 'patch',
      values: { inspection_wear_input: next },
      successNotification: false,
    })
    // L'identité est mise en cache par Refine : sans relecture, le choix semblerait sans effet.
    await refetchIdentity()
  }

  return { value, setValue }
}
