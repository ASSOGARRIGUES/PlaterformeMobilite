import { useId } from 'react'
import { Box, SimpleGrid, Text, UnstyledButton, VisuallyHidden } from '@mantine/core'
import { WEAR_ZONES, WEAR_ZONE_ORDER, WearConfig, wearSegmentValues, wearZoneKey } from './wearUtils'

type WearSegmentsProps = {
  /** Niveau 0-10 ; la zone sélectionnée se déduit de la configuration, jamais d'une égalité avec les valeurs des boutons. */
  value: number | null | undefined
  onChange: (value: number | null) => void
  config: WearConfig
  /** Nom de la tâche, repris comme nom accessible du groupe. */
  label: string
}

/** Saisie d'usure par défaut : 3 grands boutons (72 px). Toucher le bouton déjà sélectionné efface la mesure. */
export function WearSegments({ value, onChange, config, label }: WearSegmentsProps) {
  const hintId = useId()
  const values = wearSegmentValues(config)
  const selected = wearZoneKey(value, config)

  return (
    <>
      <SimpleGrid cols={3} spacing={8} role="radiogroup" aria-label={label} aria-describedby={hintId}>
        {WEAR_ZONE_ORDER.map((key) => {
          const zone = WEAR_ZONES[key]
          const Icon = zone.icon
          const isSelected = selected === key
          return (
            <UnstyledButton
              key={key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(isSelected ? null : values[key])}
              h={72}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                borderRadius: 12,
                border: `${isSelected ? 3 : 2}px solid ${
                  isSelected ? `var(--mantine-color-${zone.color}-6)` : 'var(--mantine-color-default-border)'
                }`,
                background: isSelected ? `var(--mantine-color-${zone.color}-light)` : 'var(--mantine-color-body)',
              }}
            >
              <Box
                component="span"
                style={{ display: 'flex', color: `var(--mantine-color-${zone.color}-${isSelected ? 7 : 6})` }}
              >
                <Icon size={26} stroke={2} aria-hidden />
              </Box>
              <Text
                component="span"
                size="13px"
                lh={1.1}
                fw={isSelected ? 800 : 600}
                c={isSelected && key === 'critical' ? 'red.8' : 'var(--mantine-color-text)'}
              >
                {zone.buttonLabel}
              </Text>
            </UnstyledButton>
          )
        })}
      </SimpleGrid>
      <VisuallyHidden id={hintId}>Toucher à nouveau pour effacer</VisuallyHidden>
    </>
  )
}
