import { useApiUrl, useCustom } from '@refinedev/core'
import { GarageConfig } from '../../types/garage'
import { WearConfig } from '../../components/garage/wearUtils'

/**
 * Seuils d'usure de la configuration garage (`GET /api/garage/config/`). `config` reste `undefined` tant que
 * la configuration n'est pas chargée : l'appelant n'affiche alors aucune zone plutôt qu'une zone fausse.
 */
export function useGarageConfig() {
  const apiUrl = useApiUrl()
  const { data, isLoading, isError, refetch } = useCustom<GarageConfig>({
    url: `${apiUrl}/garage/config/`,
    method: 'get',
    queryOptions: { staleTime: 5 * 60 * 1000 },
  })
  const raw = data?.data
  const config: WearConfig | undefined =
    raw?.wear_critical_threshold != null && raw?.wear_alert_threshold != null
      ? { wear_critical_threshold: raw.wear_critical_threshold, wear_alert_threshold: raw.wear_alert_threshold }
      : undefined
  return { config, isLoading, isError, refetch }
}
