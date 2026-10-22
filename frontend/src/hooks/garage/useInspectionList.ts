import { useList } from '@refinedev/core'
import { InspectionSheet } from '../../types/garage'

export const INSPECTION_PAGE_SIZE = 10

type Scope = { vehicleId: number; contractId?: never } | { contractId: number; vehicleId?: never }

/**
 * Fiches de contrôle validées d'un véhicule, ou d'un contrat (le backend borne alors la période : remise -> restitution).
 * Pagination serveur (10 par page, plus récente en tête). Mobile « Voir plus » : on agrandit `pageSize` (pas de scroll
 * infini : l'ordre est stable et 10 lignes de plus restent légères) ; desktop : on change `page`.
 */
export function useInspectionList(scope: Scope, { page = 1, pageSize = INSPECTION_PAGE_SIZE } = {}) {
  const scopeFilter =
    scope.vehicleId !== undefined
      ? { field: 'vehicle', operator: 'eq' as const, value: scope.vehicleId }
      : { field: 'contract', operator: 'eq' as const, value: scope.contractId }
  const { data, isLoading, isError, isFetching, refetch } = useList<InspectionSheet>({
    resource: 'garage/inspection',
    filters: [scopeFilter, { field: 'status', operator: 'eq', value: 'validated' }],
    pagination: { current: page, pageSize },
    queryOptions: { keepPreviousData: true },
  })
  return { sheets: data?.data ?? [], total: data?.total ?? 0, isLoading, isError, isFetching, refetch }
}
