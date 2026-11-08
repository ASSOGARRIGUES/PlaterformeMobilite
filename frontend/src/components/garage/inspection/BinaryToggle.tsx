import { SimpleGrid, Text, UnstyledButton } from '@mantine/core'
import { IconCircleCheck, IconCircleX } from '@tabler/icons-react'

type BinaryToggleProps = {
  /** true = premier choix (OK), false = second (Défaut), null = pas de réponse. */
  value: boolean | null
  onChange: (value: boolean) => void
  label: string
  okLabel?: string
  koLabel?: string
  okIcon?: typeof IconCircleCheck
  koIcon?: typeof IconCircleX
}

/** Deux grandes cibles (76 px) pour une réponse binaire : éclairage, dégâts, essai routier. */
export function BinaryToggle({
  value,
  onChange,
  label,
  okLabel = 'OK',
  koLabel = 'Défaut',
  okIcon: OkIcon = IconCircleCheck,
  koIcon: KoIcon = IconCircleX,
}: BinaryToggleProps) {
  const choices = [
    { answer: true, text: okLabel, Icon: OkIcon, color: 'teal' },
    { answer: false, text: koLabel, Icon: KoIcon, color: 'red' },
  ]
  return (
    <SimpleGrid cols={2} spacing={10} role="radiogroup" aria-label={label}>
      {choices.map(({ answer, text, Icon, color }) => {
        const selected = value === answer
        return (
          <UnstyledButton
            key={text}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(answer)}
            h={76}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              borderRadius: 14,
              border: `${selected ? 3 : 2}px solid var(--mantine-color-${selected ? `${color}-6` : 'default-border'})`,
              background: selected ? `var(--mantine-color-${color}-light)` : 'var(--mantine-color-body)',
            }}
          >
            <span style={{ display: 'flex', color: `var(--mantine-color-${color}-${selected ? 7 : 6})` }}>
              <Icon size={28} aria-hidden />
            </span>
            <Text fz={15} fw={selected ? 800 : 600}>{text}</Text>
          </UnstyledButton>
        )
      })}
    </SimpleGrid>
  )
}
