import { useShow } from '@refinedev/core'
import { InterventionSheet } from '../../types/garage'

/** Lecture seule d'une fiche d'intervention validée (story 2.7). */
export function useInterventionSheetShow(sheetId: number) {
  const { queryResult } = useShow<InterventionSheet>({ resource: 'garage/intervention', id: sheetId })
  const sheet = queryResult.data?.data
  const vehicle = sheet?.vehicle

  return {
    sheet,
    vehicle,
    isLoading: queryResult.isLoading,
  }
}
