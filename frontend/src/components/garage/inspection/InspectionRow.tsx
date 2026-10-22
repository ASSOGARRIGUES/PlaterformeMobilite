import { Box, Group, Text, ThemeIcon, UnstyledButton } from '@mantine/core'
import { IconAlertTriangle, IconChevronRight, IconCircleCheck, IconEye } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import { humanizeDate, humanizeNumber } from '../../../constants'
import { InspectionSheet } from '../../../types/garage'
import { WearConfig } from '../wearUtils'
import { authorName, findingsLine, findingsMeta, inspectionFindings } from './inspectionConsultUtils'

export const TONE_ICON = { red: IconAlertTriangle, orange: IconEye, teal: IconCircleCheck }

export function inspectionSummaryOf(sheet: InspectionSheet, config: WearConfig) {
  const findings = inspectionFindings(sheet, config)
  return { findings, line: findingsLine(findings), meta: findingsMeta(findings) }
}

/** Date du contrôle « 03/10/2026 ». */
export const inspectionDate = (sheet: InspectionSheet) => (sheet.start_date ? humanizeDate(sheet.start_date) : '—')

type InspectionRowProps = {
  sheet: InspectionSheet
  config: WearConfig
  /** Route du détail (véhicule ou contrat). */
  to: string
}

/** Ligne de la liste mobile : toute la ligne est un lien, ≥ 72 px ; les constats du niveau le plus grave sont nommés. */
export function InspectionRow({ sheet, config, to }: InspectionRowProps) {
  const { findings, line, meta } = inspectionSummaryOf(sheet, config)
  const Icon = TONE_ICON[findings.tone]
  return (
    <UnstyledButton
      component={Link}
      to={to}
      aria-label={`Contrôle du ${inspectionDate(sheet)}, ${line}`}
      p="sm"
      mih={72}
      style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 12, display: 'block', background: 'var(--mantine-color-body)' }}
    >
      <Group gap={12} wrap="nowrap">
        <ThemeIcon size={40} radius="md" variant="light" color={findings.tone}>
          <Icon size={22} aria-hidden />
        </ThemeIcon>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text fw={700} fz={15} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {inspectionDate(sheet)}
            <Text component="span" c="dimmed" mx={6}>·</Text>
            <Text component="span" ff="monospace" fz={13.5} fw={600}>{sheet.start_mileage != null ? `${humanizeNumber(sheet.start_mileage)} km` : '—'}</Text>
          </Text>
          <Text fz={13.5} fw={600} lh={1.35} c={findings.tone === 'red' ? 'red.8' : undefined}>{line}</Text>
          <Text fz={12.5} c="dimmed">{[authorName(sheet), ...meta].join(' · ')}</Text>
        </Box>
        <IconChevronRight size={18} color="var(--mantine-color-gray-5)" aria-hidden />
      </Group>
    </UnstyledButton>
  )
}
