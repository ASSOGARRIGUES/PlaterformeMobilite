import { useGetIdentity, useList, useGo } from '@refinedev/core'
import { Button, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconTool } from '@tabler/icons-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/fr'
import { WhoAmI } from '../../types/auth'
import { InterventionSheet } from '../../types/garage'

dayjs.extend(relativeTime)
dayjs.locale('fr')

export function OpenSheetBanner() {
  const go = useGo()
  const { data: identity } = useGetIdentity<WhoAmI>()

  const { data } = useList<InterventionSheet>({
    resource: 'garage/intervention',
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
            <IconTool size={20} stroke={2} />
          </ThemeIcon>
          <Stack gap={0}>
            <Text fw={600} className="sentry-mask">
              {sheet.vehicle.imat}
            </Text>
            <Text size="sm" c="dimmed">
              Intervention ouverte {dayjs(sheet.created_at).fromNow()}
            </Text>
          </Stack>
        </Group>
        <Button
          color="cyan"
          variant="filled"
          style={{ minHeight: 48 }}
          onClick={() => go({ to: `/garage/intervention/${sheet.id}` })}
        >
          Reprendre
        </Button>
      </Group>
    </Paper>
  )
}
