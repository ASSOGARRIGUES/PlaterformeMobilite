import { ReactNode, useState } from 'react'
import { Box, Button, Group, Skeleton, Stack, Text, ThemeIcon, useMantineTheme } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useGo } from '@refinedev/core'
import { IconChevronRight, IconClipboardOff, IconClipboardPlus, IconCloudX, IconRefresh } from '@tabler/icons-react'
import { DataTable, DataTableColumn } from 'mantine-datatable'
import { humanizeNumber } from '../../../constants'
import { INSPECTION_PAGE_SIZE, useInspectionList } from '../../../hooks/garage/useInspectionList'
import { useGarageConfig } from '../../../hooks/garage/useGarageConfig'
import useAccessControl from '../../../hooks/useAccessControl'
import { InspectionSheet } from '../../../types/garage'
import { WearConfig } from '../wearUtils'
import { InspectionRow, TONE_ICON, inspectionDate, inspectionSummaryOf } from './InspectionRow'
import { authorName } from './inspectionConsultUtils'

type InspectionsPanelProps = {
  origin: 'vehicle' | 'contract'
  /** Id du véhicule ou du contrat selon `origin`. */
  originId: number
  /** Phrase de contexte au-dessus de la liste (onglet du contrat). */
  context?: ReactNode
}

export const inspectionRoute = (origin: 'vehicle' | 'contract', originId: number, inspectionId: number) =>
  `/${origin}/${originId}/inspection/${inspectionId}`

function StateBlock({ icon, tone = 'gray', title, children }: { icon: ReactNode; tone?: string; title: string; children?: ReactNode }) {
  return (
    <Stack align="center" gap={8} p="xl" ta="center" style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 12 }}>
      <ThemeIcon size={56} radius="md" variant="light" color={tone}>{icon}</ThemeIcon>
      <Text fw={800} fz={16}>{title}</Text>
      {children}
    </Stack>
  )
}

function Loading() {
  return (
    <Stack gap={8} aria-busy="true" aria-label="Chargement des contrôles">
      {[0, 1, 2].map((i) => (
        <Group key={i} gap={12} wrap="nowrap" p="sm" mih={72} style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 12 }}>
          <Skeleton h={40} w={40} radius="md" />
          <Stack gap={8} style={{ flex: 1 }}>
            <Skeleton h={11} w="46%" />
            <Skeleton h={11} w="78%" />
            <Skeleton h={11} w="34%" />
          </Stack>
        </Group>
      ))}
    </Stack>
  )
}

/**
 * Liste des contrôles validés d'un véhicule (onglet « Contrôles » de la fiche véhicule) ou d'un contrat (référent).
 * Mobile : lignes + « Voir plus · n autres » ; desktop : tableau paginé par 10, lignes focusables au clavier.
 */
export function InspectionsPanel({ origin, originId, context }: InspectionsPanelProps) {
  const theme = useMantineTheme()
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`, false, { getInitialValueInEffect: false })
  const go = useGo()
  const { isAuthorized } = useAccessControl()
  const { config, isError: configError, refetch: refetchConfig } = useGarageConfig()

  const [shown, setShown] = useState(INSPECTION_PAGE_SIZE)
  const [page, setPage] = useState(1)
  const scope = origin === 'vehicle' ? { vehicleId: originId } : { contractId: originId }
  const { sheets, total, isLoading, isError, refetch } = useInspectionList(scope, {
    page: isMobile ? 1 : page,
    pageSize: isMobile ? shown : INSPECTION_PAGE_SIZE,
  })

  const open = (sheet: InspectionSheet) => go({ to: inspectionRoute(origin, originId, sheet.id) })
  const canCreate = origin === 'vehicle' && !!isAuthorized('garage.manage_inspection')

  const body = (() => {
    if (isError || configError) {
      return (
        <StateBlock icon={<IconCloudX size={30} aria-hidden />} tone="red" title="Impossible de charger les contrôles">
          <div role="alert">
            <Text fz={13.5} c="dimmed">La connexion au serveur a échoué.</Text>
          </div>
          <Button variant="outline" mih={48} leftSection={<IconRefresh size={18} />} onClick={() => { void refetch(); void refetchConfig() }}>Réessayer</Button>
        </StateBlock>
      )
    }
    if (isLoading || !config) return <Loading />
    if (total === 0) {
      return (
        <StateBlock icon={<IconClipboardOff size={30} aria-hidden />} title={origin === 'contract' ? 'Aucun contrôle pendant ce contrat' : 'Aucun contrôle enregistré'}>
          {canCreate && (
            <Button color="cyan" mih={isMobile ? 48 : undefined} leftSection={<IconClipboardPlus size={18} />} onClick={() => go({ to: `/garage/inspection/create?vehicle=${originId}` })}>
              Nouveau contrôle
            </Button>
          )}
        </StateBlock>
      )
    }
    return isMobile ? (
      <MobileList sheets={sheets} total={total} config={config} origin={origin} originId={originId} onMore={() => setShown(shown + INSPECTION_PAGE_SIZE)} />
    ) : (
      <DesktopTable sheets={sheets} total={total} config={config} page={page} onPage={setPage} onOpen={open} />
    )
  })()

  return (
    <Stack gap="sm">
      {context}
      {body}
    </Stack>
  )
}

function MobileList({ sheets, total, config, origin, originId, onMore }: {
  sheets: InspectionSheet[]; total: number; config: WearConfig; origin: 'vehicle' | 'contract'; originId: number; onMore: () => void
}) {
  const rest = total - sheets.length
  return (
    <Stack gap={8} role="list">
      {sheets.map((sheet) => (
        <div role="listitem" key={sheet.id}>
          <InspectionRow sheet={sheet} config={config} to={inspectionRoute(origin, originId, sheet.id)} />
        </div>
      ))}
      {rest > 0 && (
        <Button variant="outline" mih={48} onClick={onMore}>
          Voir plus<Text component="span" c="dimmed" fw={500} ml={6}>· {rest} {rest > 1 ? 'autres' : 'autre'}</Text>
        </Button>
      )}
    </Stack>
  )
}

function DesktopTable({ sheets, total, config, page, onPage, onOpen }: {
  sheets: InspectionSheet[]; total: number; config: WearConfig; page: number; onPage: (page: number) => void; onOpen: (sheet: InspectionSheet) => void
}) {
  const columns: DataTableColumn<InspectionSheet>[] = [
    { accessor: 'start_mileage', title: 'Date', width: 130, render: (sheet) => <Text fw={700} fz={14}>{inspectionDate(sheet)}</Text> },
    { accessor: 'km', title: 'Kilométrage', width: 130, render: (sheet) => <Text ff="monospace" fz={13}>{sheet.start_mileage != null ? `${humanizeNumber(sheet.start_mileage)} km` : '—'}</Text> },
    { accessor: 'author', title: 'Auteur', width: 140, render: (sheet) => authorName(sheet) },
    {
      accessor: 'findings',
      title: 'Constats',
      render: (sheet) => {
        const { findings, line, meta } = inspectionSummaryOf(sheet, config)
        const Icon = TONE_ICON[findings.tone]
        return (
          <Group gap={10} wrap="nowrap" align="center">
            <ThemeIcon size={28} radius="sm" variant="light" color={findings.tone}><Icon size={16} aria-hidden /></ThemeIcon>
            <Box>
              <Text fz={13.5} fw={600} c={findings.tone === 'red' ? 'red.8' : undefined}>{line}</Text>
              {meta.length > 0 && <Text fz={12.5} c="dimmed">{meta.join(' · ')}</Text>}
            </Box>
          </Group>
        )
      },
    },
    { accessor: 'open', title: '', width: 40, render: () => <IconChevronRight size={18} color="var(--mantine-color-gray-5)" aria-label="Ouvrir" /> },
  ]
  return (
    <DataTable<InspectionSheet>
      withTableBorder
      borderRadius="md"
      verticalSpacing="sm"
      highlightOnHover
      records={sheets}
      columns={columns}
      idAccessor="id"
      totalRecords={total}
      recordsPerPage={INSPECTION_PAGE_SIZE}
      page={page}
      onPageChange={onPage}
      onRowClick={({ record }) => onOpen(record)}
      customRowAttributes={(record) => ({
        tabIndex: 0,
        'aria-label': `Contrôle du ${inspectionDate(record)}, ${inspectionSummaryOf(record, config).line}`,
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key === 'Enter') onOpen(record)
        },
      })}
    />
  )
}
