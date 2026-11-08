import { Box, Group, Paper, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconAlertTriangle, IconCalendarPlus, IconCircleCheck, IconEye } from '@tabler/icons-react'
import { plural } from '../../../constants'
import { Finding, FindingSection, InspectionFindings } from './inspectionConsultUtils'

export type SectionId = 'km' | 'levels' | 'wear' | 'lighting' | 'damages' | 'road' | 'ops'

const SECTION_OF: Record<FindingSection, SectionId> = { wear: 'wear', levels: 'levels', lighting: 'lighting', damages: 'damages', ops: 'ops' }

type InspectionHighlightsProps = {
  findings: InspectionFindings
  onJump: (section: SectionId) => void
}

function FindingLine({ finding, tone, onJump }: { finding: Finding; tone: 'red' | 'orange'; onJump: (section: SectionId) => void }) {
  const Icon = tone === 'red' ? IconAlertTriangle : IconEye
  const detail = finding.detail
    ? finding.section === 'lighting' ? ` : ${finding.detail.toLowerCase()}` : ` · ${finding.detail}`
    : ''
  return (
    <UnstyledButton mih={48} px={6} py={4} onClick={() => onJump(SECTION_OF[finding.section])} style={{ borderRadius: 8 }}>
      <Group gap={10} wrap="nowrap">
        <Icon size={20} color={`var(--mantine-color-${tone}-7)`} style={{ flexShrink: 0 }} aria-hidden />
        <Text fz={14.5} fw={700} lh={1.3} c={tone === 'red' ? 'red.8' : undefined}>
          {finding.title}
          <Text component="span" fw={500} inherit>{detail}</Text>
        </Text>
      </Group>
    </UnstyledButton>
  )
}

/** « À retenir » : une ligne de 48 px par constat (rouges, puis orange, puis opérations à prévoir) qui défile jusqu'à sa section. */
export function InspectionHighlights({ findings, onJump }: InspectionHighlightsProps) {
  const { red, orange, opsCount, ras } = findings
  if (ras || (!red.length && !orange.length)) {
    return (
      <Paper bg="teal.0" radius={12} p="md">
        <Group gap={12} align="flex-start" wrap="nowrap">
          <IconCircleCheck size={24} color="var(--mantine-color-teal-7)" aria-hidden />
          <Box>
            <Text fz={15} fw={700}>{ras ? 'Rien à signaler' : 'Aucun défaut relevé'}</Text>
            <Text fz={13}>
              {ras ? 'Tous les points contrôlés sont bons.' : `${opsCount} ${plural(opsCount, 'opération à prévoir', 'opérations à prévoir')}.`}
            </Text>
          </Box>
        </Group>
      </Paper>
    )
  }
  return (
    <Paper component="section" aria-label="À retenir" bg={red.length ? 'red.0' : 'orange.0'} radius={12} px={10} pt={10} pb={6}>
      <Text fz={12} fw={800} tt="uppercase" px={6} pb={4} style={{ letterSpacing: '.06em' }}>À retenir</Text>
      <Stack gap={0}>
        {red.map((finding, index) => <FindingLine key={`r${index}`} finding={finding} tone="red" onJump={onJump} />)}
        {orange.map((finding, index) => <FindingLine key={`o${index}`} finding={finding} tone="orange" onJump={onJump} />)}
        {opsCount > 0 && (
          <UnstyledButton mih={48} px={6} py={4} onClick={() => onJump('ops')} style={{ borderRadius: 8 }}>
            <Group gap={10} wrap="nowrap">
              <IconCalendarPlus size={20} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} aria-hidden />
              <Text fz={14.5} fw={600}>{opsCount} {plural(opsCount, 'opération à prévoir', 'opérations à prévoir')}</Text>
            </Group>
          </UnstyledButton>
        )}
      </Stack>
    </Paper>
  )
}
