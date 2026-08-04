import { ReactNode } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { ActionIcon, Alert, Group, Loader, Paper, ScrollArea, Stepper, Text, Title } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconCalendar, IconCheck, IconClipboardCheck, IconGauge, IconTool } from '@tabler/icons-react'

export const INTERVENTION_STEP_ICONS = [IconGauge, IconTool, IconCalendar, IconClipboardCheck]

type InterventionStepperShellProps = {
  title: ReactNode
  maskTitle?: boolean
  onBack: () => void
  stepError: string | null
  extraAlert?: ReactNode
  stepLabels: string[]
  activeStep: number
  onStepClick: (step: number) => void
  isStepLoading?: (step: number) => boolean
  footer: ReactNode
  children: ReactNode
}

/** Chrome partagé (header, navigation Stepper, footer) entre le stepper de création (InterventionStepper)
 * et le stepper d'édition d'une fiche validée (InterventionEditStepper) — cf. story 2.7, revue de code. */
export function InterventionStepperShell({
  title,
  maskTitle = false,
  onBack,
  stepError,
  extraAlert,
  stepLabels,
  activeStep,
  onStepClick,
  isStepLoading,
  footer,
  children,
}: InterventionStepperShellProps) {
  const isDesktop = useMediaQuery('(min-width: 769px)')
  const stepIconSize = isDesktop ? 40 : 30

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 800,
        margin: '0 auto',
        width: '100%',
      }}
    >
      <Group gap="xs" p="md" style={{ flexShrink: 0 }}>
        <ActionIcon variant="subtle" onClick={onBack} aria-label="Retour">
          <IconArrowLeft size={20} />
        </ActionIcon>
        <Title order={3} className={maskTitle ? 'sentry-mask' : undefined}>{title}</Title>
      </Group>

      {stepError && (
        <Alert color="red" icon={<IconAlertCircle size={18} />} mx="md" mb="md" style={{ flexShrink: 0 }}>
          {stepError}
        </Alert>
      )}

      {extraAlert}

      <Paper
        shadow="sm"
        m={{ base: 'xs', sm: 'md' }}
        mt={0}
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ flexShrink: 0 }}>
          <Stepper
            active={activeStep}
            onStepClick={onStepClick}
            allowNextStepsSelect
            size="xs"
            iconSize={stepIconSize}
            styles={{
              root: { padding: '10px 16px 0' },
              steps: { gap: 0 },
              step: { padding: 0, cursor: 'pointer' },
              stepBody: { display: 'none' },
              separator: { marginInline: 4 },
            }}
          >
            {INTERVENTION_STEP_ICONS.map((Icon, index) => (
              <Stepper.Step
                key={stepLabels[index]}
                aria-label={stepLabels[index]}
                icon={
                  isStepLoading?.(index) ? (
                    <Loader size={stepIconSize * 0.55} color="cyan" />
                  ) : (
                    <Icon size={stepIconSize * 0.55} />
                  )
                }
                completedIcon={<IconCheck size={stepIconSize * 0.55} />}
              />
            ))}
          </Stepper>
          <Text
            size="xs"
            fw={700}
            tt="uppercase"
            c="cyan.7"
            px="md"
            pb="xs"
            style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}
          >
            Étape {activeStep + 1} sur {stepLabels.length} — {stepLabels[activeStep]}
          </Text>
        </div>

        <ScrollArea style={{ flex: 1, minHeight: 0 }} p="md">
          {children}
        </ScrollArea>

        <Group
          justify="space-between"
          p="md"
          style={{
            flexShrink: 0,
            borderTop: '1px solid var(--mantine-color-gray-2)',
            paddingBottom: 'calc(var(--mantine-spacing-md) + env(safe-area-inset-bottom))',
          }}
        >
          {footer}
        </Group>
      </Paper>
    </div>
  )
}
