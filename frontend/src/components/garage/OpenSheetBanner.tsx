import { useGetIdentity, useList, useGo } from '@refinedev/core'
import { Button, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconClipboardCheck, IconTool } from '@tabler/icons-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/fr'
import { WhoAmI } from '../../types/auth'
import { InspectionSheet, InterventionSheet } from '../../types/garage'

dayjs.extend(relativeTime)
dayjs.locale('fr')

type OpenSheetBannerProps = { kind?: 'intervention' | 'controle' }

const KINDS = {
  intervention: { resource: 'garage/intervention', route: '/garage/intervention', title: 'Intervention en cours', Icon: IconTool },
  controle: { resource: 'garage/inspection', route: '/garage/inspection', title: 'Fiche de contrôle en cours', Icon: IconClipboardCheck },
}

export function OpenSheetBanner({ kind = 'intervention' }: OpenSheetBannerProps) {
  const { resource, route, title, Icon } = KINDS[kind]
  const go = useGo()
  const { data: identity } = useGetIdentity<WhoAmI>()

  const { data } = useList<InterventionSheet | InspectionSheet>({
    resource,
    filters: [
      { field: 'status', operator: 'eq', value: 'open' },
      { field: 'created_by', operator: 'eq', value: identity?.id },
    ],
    pagination: { pageSize: 1 },
    queryOptions: { enabled: identity?.id != null },
  })

  const sheet = data?.data?.[0]
  if (!sheet) return null

  return (
    <Paper radius="md" p="md" bg="blue.0">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon color="cyan" variant="light" radius="xl" size="lg">
            <Icon size={20} stroke={2} />
          </ThemeIcon>
          <Stack gap={0}>
            <Text size="xs" fw={700} c="dimmed">{title}</Text>
            <Text fw={600} className="sentry-mask">
              {sheet.vehicle.imat}
            </Text>
            <Text size="sm" c="dimmed">
              Ouverte {dayjs(sheet.created_at).fromNow()}
            </Text>
          </Stack>
        </Group>
        <Button
          color="cyan"
          variant="filled"
          style={{ minHeight: 48 }}
          onClick={() => go({ to: `${route}/${sheet.id}` })}
        >
          Reprendre
        </Button>
      </Group>
    </Paper>
  )
}
