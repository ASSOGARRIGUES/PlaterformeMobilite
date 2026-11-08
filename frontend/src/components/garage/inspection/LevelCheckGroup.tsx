import { SimpleGrid, Text, UnstyledButton } from '@mantine/core'
import { IconCheck, IconDroplet, IconMinus, IconTemperature, IconWiperWash, IconX } from '@tabler/icons-react'

export type LevelKey = 'oil' | 'coolant' | 'washer'
export type LevelValues = Record<LevelKey, boolean | null>

const LEVELS: { key: LevelKey; label: string; icon: typeof IconDroplet }[] = [
  { key: 'oil', label: 'Huile', icon: IconDroplet },
  { key: 'coolant', label: 'Refroid.', icon: IconTemperature },
  { key: 'washer', label: 'Lave-glace', icon: IconWiperWash },
]

/** Un appui fait cycler : non vérifié -> OK -> défaut -> non vérifié. */
export function nextLevelState(current: boolean | null): boolean | null {
  return current === null ? true : current === true ? false : null
}

const stateText = (value: boolean | null) => (value === true ? 'OK' : value === false ? 'Défaut' : 'Non vérifié')

type LevelCheckGroupProps = {
  values: LevelValues
  onChange: (key: LevelKey, value: boolean | null) => void
}

export function LevelCheckGroup({ values, onChange }: LevelCheckGroupProps) {
  return (
    <>
      <SimpleGrid cols={3} spacing={10}>
        {LEVELS.map(({ key, label, icon: Icon }) => {
          const value = values[key]
          const color = value === true ? 'teal' : value === false ? 'red' : 'gray'
          const StateIcon = value === true ? IconCheck : value === false ? IconX : IconMinus
          return (
            <UnstyledButton
              key={key}
              role="checkbox"
              aria-checked={value === null ? 'mixed' : value}
              aria-label={`${label} : ${stateText(value)}`}
              onClick={() => onChange(key, nextLevelState(value))}
              mih={96}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                borderRadius: 14,
                border: `${value === null ? 2 : 3}px solid var(--mantine-color-${color}-${value === null ? 3 : 6})`,
                background: value === null ? 'var(--mantine-color-body)' : `var(--mantine-color-${color}-light)`,
              }}
            >
              <span style={{ display: 'flex', color: `var(--mantine-color-${color}-${value === null ? 6 : 7})` }}>
                <StateIcon size={28} stroke={2.5} aria-hidden />
              </span>
              <Icon size={26} aria-hidden style={{ color: 'var(--mantine-color-dimmed)' }} />
              <Text fz={13} fw={600}>{label}</Text>
            </UnstyledButton>
          )
        })}
      </SimpleGrid>
      <Text fz={12.5} c="dimmed" mt="sm">Taper pour changer : OK → Défaut → non vérifié</Text>
    </>
  )
}
