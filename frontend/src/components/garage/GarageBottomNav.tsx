import { useState } from 'react'
import { ActionIcon, Text, Stack, Popover, UnstyledButton, Box, Divider } from '@mantine/core'
import {
  IconLayoutDashboard,
  IconCar,
  IconPlus,
  IconTool,
  IconClipboardList,
  IconUserCircle,
} from '@tabler/icons-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useGetIdentity } from '@refinedev/core'
import { WhoAmI } from '../../types/auth'
import ActionSelector from '../actions/ActionSelector'
import OpenBugReportButton from '../bugreporter/OpenBugReportButton'

const NAV_HEIGHT = 64

export function GarageBottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [fabOpen, setFabOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const { data } = useGetIdentity()
  const user = data as WhoAmI

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  const navItemStyle = (active: boolean) => ({
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    minWidth: 48,
    minHeight: 48,
    color: active ? 'var(--mantine-color-cyan-8)' : 'var(--mantine-color-dimmed)',
  })

  return (
    <Box
      style={{
        height: `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
        backgroundColor: 'var(--mantine-color-body)',
        borderTop: '1px solid var(--mantine-color-default-border)',
        display: 'flex',
        alignItems: 'flex-start',
        paddingTop: `calc((${NAV_HEIGHT}px - 48px) / 2)`,
        position: 'relative',
      }}
    >
      {/* Groupe gauche */}
      <Box style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <UnstyledButton
          onClick={() => navigate('/')}
          style={navItemStyle(location.pathname === '/')}
        >
          <IconLayoutDashboard size={22} />
          <Text size="xs">Accueil</Text>
        </UnstyledButton>
      </Box>

      {/* FAB central absolu */}
      <Popover
        opened={fabOpen}
        onChange={setFabOpen}
        position="top"
        withArrow
        shadow="md"
        offset={20}
      >
        <Popover.Target>
          <ActionIcon
            onClick={() => setFabOpen((o) => !o)}
            size={56}
            radius="xl"
            style={{
              backgroundColor: 'var(--mantine-color-cyan-8)',
              border: '4px solid white',
              position: 'absolute',
              top: -28,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10,
              minWidth: 56,
              minHeight: 56,
            }}
            aria-label="Créer"
          >
            <IconPlus size={28} color="white" />
          </ActionIcon>
        </Popover.Target>

        <Popover.Dropdown>
          <Stack gap="xs">
            <UnstyledButton
              onClick={() => {
                setFabOpen(false)
                // TODO: navigate('/intervention/create') — Epic 2
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                minHeight: 48,
                borderRadius: 8,
              }}
            >
              <IconTool size={18} />
              <Text size="sm">Nouvelle intervention</Text>
            </UnstyledButton>
            <UnstyledButton
              onClick={() => {
                setFabOpen(false)
                // TODO: navigate('/controle/create') — Epic 3
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                minHeight: 48,
                borderRadius: 8,
              }}
            >
              <IconClipboardList size={18} />
              <Text size="sm">Nouveau contrôle</Text>
            </UnstyledButton>
          </Stack>
        </Popover.Dropdown>
      </Popover>

      {/* Groupe droite */}
      <Box style={{ flex: 1, display: 'flex', justifyContent: 'space-around' }}>
        <UnstyledButton
          onClick={() => navigate('/vehicle')}
          style={navItemStyle(isActive('/vehicle'))}
        >
          <IconCar size={22} />
          <Text size="xs">Véhicules</Text>
        </UnstyledButton>

        {/* Bouton Compte */}
        <Popover
          opened={accountOpen}
          onChange={setAccountOpen}
          position="top-end"
          withArrow
          shadow="md"
          offset={20}
        >
          <Popover.Target>
            <UnstyledButton
              onClick={() => setAccountOpen((o) => !o)}
              style={navItemStyle(false)}
            >
              <IconUserCircle size={22} />
              <Text size="xs">Compte</Text>
            </UnstyledButton>
          </Popover.Target>

          <Popover.Dropdown>
            <Stack gap="sm" style={{ minWidth: 180 }}>
              {user?.first_name && (
                <Text size="sm" fw={500}>
                  {user.first_name} {user.last_name}
                </Text>
              )}
              <Divider />
              <ActionSelector />
              <OpenBugReportButton />
            </Stack>
          </Popover.Dropdown>
        </Popover>
      </Box>
    </Box>
  )
}
