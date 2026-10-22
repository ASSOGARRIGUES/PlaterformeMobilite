import { ReactNode } from 'react'
import { Box, Stack, Text } from '@mantine/core'

type MobileTabLabelProps = {
  icon: ReactNode
  label: string
  /** Pastille accrochée à l'icône (compteur de l'onglet Entretien). */
  badge?: ReactNode
}

/** Libellé d'onglet mobile : icône au-dessus du texte (4 onglets ne tiennent pas en « icône + libellé » à 375 px). */
export function MobileTabLabel({ icon, label, badge }: MobileTabLabelProps) {
  return (
    <Stack gap={3} align="center" justify="center" mih={44}>
      <Box pos="relative" style={{ display: 'flex' }}>
        {icon}
        {badge && <Box pos="absolute" top={-9} left={13} style={{ lineHeight: 1 }}>{badge}</Box>}
      </Box>
      <Text component="span" fz={12} fw={500} lh={1.1} style={{ whiteSpace: 'nowrap' }}>{label}</Text>
    </Stack>
  )
}

/** Style des onglets mobiles : 56 px de haut, rien de plus que ce que Mantine ne donne pas. */
export const MOBILE_TAB_STYLE = { height: 56, padding: '0 2px', flex: 1, minWidth: 0 } as const
