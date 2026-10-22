import { Box, Group, Paper, Stack, Text } from '@mantine/core'
import { IconHistory, IconMinus } from '@tabler/icons-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/fr'
import { MeasurableTask } from '../../types/garage'
import { taskIcon } from './maintenance/taskIcons'
import { WearSegments } from './WearSegments'
import { WearSlider } from './WearSlider'
import { WEAR_ZONES, WearConfig, wearZoneKey } from './wearUtils'

dayjs.extend(relativeTime)
dayjs.locale('fr')

export type WearInput = 'segments' | 'slider'

type WearTaskCardProps = {
  task: Pick<MeasurableTask, 'id' | 'name' | 'icon'>
  value: number | null | undefined
  onChange?: (value: number | null) => void
  /** Lecture seule (consultation d'une fiche validée) : pas de saisie, carte compacte avec « n/10 » à droite. */
  readOnly?: boolean
  input?: WearInput
  config: WearConfig
  /** Une seule tâche sur la page : carte « aérée », avec la ligne de dernier relevé. */
  roomy?: boolean
  last?: { level: number; date: string | null } | null
}

function cardBorder(zone: ReturnType<typeof wearZoneKey>): string {
  if (zone === null) return '2px dashed var(--mantine-color-gray-4)'
  if (zone === 'critical') return '2px solid var(--mantine-color-red-6)'
  return '2px solid var(--mantine-color-default-border)'
}

export function WearTaskCard({ task, value, onChange, readOnly = false, input = 'slider', config, roomy = false, last }: WearTaskCardProps) {
  const zoneKey = wearZoneKey(value, config)
  const zone = zoneKey ? WEAR_ZONES[zoneKey] : null
  const Icon = taskIcon(task.icon)
  const ZoneIcon = zone?.icon ?? IconMinus
  const critical = zoneKey === 'critical'
  const lastZone = last ? WEAR_ZONES[wearZoneKey(last.level, config) ?? 'good'] : null

  if (readOnly) {
    return (
      <Paper
        radius={10}
        py={8}
        px={10}
        style={{ border: zoneKey === null ? '1px dashed var(--mantine-color-gray-4)' : critical ? '2px solid var(--mantine-color-red-6)' : '1px solid var(--mantine-color-default-border)' }}
      >
        <Group gap={12} wrap="nowrap" mih={40}>
          <Box
            w={40}
            h={40}
            bg={critical ? 'red.0' : 'gray.1'}
            c={critical ? 'red.7' : 'dimmed'}
            style={{ borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <Icon size={22} aria-hidden />
          </Box>
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Text fw={700} fz={15} lh={1.2}>{task.name}</Text>
            <Group gap={5} wrap="nowrap" c={critical ? 'red.8' : zone ? 'var(--mantine-color-text)' : 'dimmed'}>
              <Box component="span" style={{ display: 'flex', color: zone ? `var(--mantine-color-${zone.color}-7)` : undefined }}>
                <ZoneIcon size={17} aria-hidden />
              </Box>
              <Text component="span" fz={13.5} fw={zone ? 700 : 600}>{zone ? zone.label : 'Non mesuré'}</Text>
            </Group>
          </Stack>
          {value != null && (
            <Text fz={20} fw={800} c={critical ? 'red.8' : undefined} style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {value}
              <Text component="span" fz={13} fw={600} c="dimmed">/10</Text>
            </Text>
          )}
        </Group>
      </Paper>
    )
  }

  return (
    <Paper radius={14} p={roomy ? 20 : 12} style={{ border: cardBorder(zoneKey) }}>
      <Stack gap={roomy ? 18 : 10}>
        <Group gap={12} wrap="nowrap" mih={44}>
          <Box
            w={roomy ? 56 : 44}
            h={roomy ? 56 : 44}
            bg={critical ? 'red.0' : 'gray.1'}
            c={critical ? 'red.7' : 'dimmed'}
            style={{ borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            <Icon size={roomy ? 32 : 26} aria-hidden />
          </Box>
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Text fw={700} fz={roomy ? 19 : 16} lh={1.2}>{task.name}</Text>
            <Group gap={5} wrap="nowrap" c={critical ? 'red.8' : zone ? 'var(--mantine-color-text)' : 'dimmed'}>
              <Box component="span" style={{ display: 'flex', color: zone ? `var(--mantine-color-${zone.color}-7)` : undefined }}>
                <ZoneIcon size={17} aria-hidden />
              </Box>
              <Text component="span" fz={13.5} fw={zone ? 700 : 600}>
                {zone ? zone.label : 'Non mesuré'}
              </Text>
            </Group>
          </Stack>
          {input === 'slider' && (
            <Text fz={24} fw={800} c={critical ? 'red.8' : undefined} style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              {value == null ? '—' : value}
              <Text component="span" fz={13} fw={600} c="dimmed">/10</Text>
            </Text>
          )}
        </Group>

        {input === 'slider' ? (
          <WearSlider value={value} onChange={(next) => onChange?.(next)} config={config} label={task.name} />
        ) : (
          <WearSegments value={value} onChange={(next) => onChange?.(next)} config={config} label={task.name} />
        )}

        {roomy && last && lastZone && (
          <Group gap={6} wrap="nowrap" c="dimmed" pt={12} style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
            <IconHistory size={16} aria-hidden />
            <Text fz={13}>
              Dernier relevé : {lastZone.label} ({last.level}/10){last.date ? `, ${dayjs(last.date).fromNow()}` : ''}
            </Text>
          </Group>
        )}
      </Stack>
    </Paper>
  )
}
