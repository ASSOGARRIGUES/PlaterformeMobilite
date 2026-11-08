import { Box, Group, VisuallyHidden } from '@mantine/core'

type PagerDotsProps = { count: number; index: number }

/** Points de pagination non interactifs (cibles de 8 px) ; la page courante est annoncée en texte masqué. */
export function PagerDots({ count, index }: PagerDotsProps) {
  if (count <= 1) return null
  return (
    <Group gap={6} wrap="nowrap" aria-live="polite">
      {Array.from({ length: count }, (_, i) => (
        <Box
          key={i}
          aria-hidden
          h={8}
          w={i === index ? 22 : 8}
          bg={i === index ? 'cyan.8' : 'gray.4'}
          style={{ borderRadius: 4, transition: 'width 150ms ease' }}
        />
      ))}
      <VisuallyHidden>
        Page {index + 1} sur {count}
      </VisuallyHidden>
    </Group>
  )
}
