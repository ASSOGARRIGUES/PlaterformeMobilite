import { Badge } from '@mantine/core'
import { InterventionSheetStatusEnum } from '../../../types/schema.d'

const STATUS_COLORS: Record<string, string> = {
  [InterventionSheetStatusEnum.open]: 'orange',
  [InterventionSheetStatusEnum.validated]: 'teal',
}

const STATUS_LABELS: Record<string, string> = {
  [InterventionSheetStatusEnum.open]: 'Ouverte',
  [InterventionSheetStatusEnum.validated]: 'Validée',
}

export function InterventionStatusBadge({ status }: { status?: string }) {
  if (!status) return null
  return <Badge color={STATUS_COLORS[status] ?? 'gray'}>{STATUS_LABELS[status] ?? status}</Badge>
}
