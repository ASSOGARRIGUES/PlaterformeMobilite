import { CSSProperties } from 'react'
import { Badge, Tooltip } from '@mantine/core'
import { IconRepeat } from '@tabler/icons-react'

const TOOLTIP = 'Intervalle de remplacement : la première échéance atteinte (km ou durée) compte.'

/** Puce grise de périodicité (catalogue, suggestions, onglet Entretien). Rien sans périodicité. */
export function PeriodicityBadge({ label, style }: { label?: string | null; style?: CSSProperties }) {
  if (!label) return null
  return (
    <Tooltip label={TOOLTIP} events={{ hover: true, focus: true, touch: true }} multiline w={220}>
      <Badge variant="outline" color="gray" size="sm" tt="none" leftSection={<IconRepeat size={12} />} style={{ cursor: 'help', ...style }}>
        {label}
      </Badge>
    </Tooltip>
  )
}
