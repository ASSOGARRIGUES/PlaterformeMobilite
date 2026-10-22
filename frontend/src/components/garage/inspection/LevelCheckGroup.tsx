import { Box, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
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

/** Nom complet des niveaux pour la lecture (la saisie abrège « Refroidissement » faute de place). */
const READ_NAMES: Record<LevelKey, string> = { oil: 'Huile', coolant: 'Refroidissement', washer: 'Lave-glace' }

type LevelCheckGroupProps = {
  values: LevelValues
  onChange?: (key: LevelKey, value: boolean | null) => void
  /** Lecture seule (consultation d'une fiche validée) : pastille ✓ / ✗ / —, nom et état en mot ; le défaut prend bordure et fond rouges. */
  readOnly?: boolean
  /** Niveaux dont l'enregistrement a échoué : la case précise est cerclée de rouge. */
  errorKeys?: LevelKey[]
}

function LevelCheckRead({ values }: { values: LevelValues }) {
  return (
    <SimpleGrid cols={3} spacing={8}>
      {LEVELS.map(({ key }) => {
        const value = values[key]
        const color = value === true ? 'teal' : value === false ? 'red' : 'gray'
        const StateIcon = value === true ? IconCheck : value === false ? IconX : IconMinus
        return (
          <Stack
            key={key}
            gap={3}
            align="center"
            px={4}
            pt={10}
            pb={8}
            ta="center"
            style={{
              border: `1px solid var(--mantine-color-${value === false ? 'red-6' : 'default-border'})`,
              borderRadius: 10,
              background: value === false ? 'var(--mantine-color-red-0)' : undefined,
            }}
          >
            <Box
              w={28}
              h={28}
              c={value === null ? 'dimmed' : 'white'}
              bg={value === null ? 'gray.2' : `${color}.${value === true ? 7 : 6}`}
              style={{ borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <StateIcon size={17} stroke={2.5} aria-hidden />
            </Box>
            <Text fz={12.5} fw={700} lh={1.2} style={{ hyphens: 'auto', maxWidth: '100%' }}>{READ_NAMES[key]}</Text>
            <Text fz={12} fw={value === false ? 700 : 400} c={value === false ? 'red.8' : 'dimmed'}>{stateText(value)}</Text>
          </Stack>
        )
      })}
    </SimpleGrid>
  )
}

export function LevelCheckGroup({ values, onChange, readOnly = false, errorKeys = [] }: LevelCheckGroupProps) {
  if (readOnly) return <LevelCheckRead values={values} />
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
              onClick={() => onChange?.(key, nextLevelState(value))}
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
                boxShadow: errorKeys.includes(key) ? '0 0 0 3px var(--mantine-color-red-6)' : undefined,
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
