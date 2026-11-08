import { KeyboardEvent, PointerEvent, useRef } from 'react'
import { Box, Group, Text } from '@mantine/core'
import { IconHandFinger } from '@tabler/icons-react'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import { WEAR_ZONES, WearConfig, wearTrackBands, wearZoneKey } from './wearUtils'

type WearSliderProps = {
  /** Niveau entier 0-10 ; `null` / `undefined` = pas de mesure (poignée absente). */
  value: number | null | undefined
  onChange: (value: number) => void
  /** Appelé en fin de geste (relâchement, touche) : sert à enregistrer sans spammer le serveur pendant le glissement. */
  onChangeEnd?: (value: number) => void
  config: WearConfig
  label: string
  /** Dernier relevé connu : repère sur la piste, date en dessous (sans texte de plus sur mobile). */
  last?: { level: number; date: string | null } | null
}

const THUMB = 32
const TICKS = Array.from({ length: 11 }, (_, i) => i)

/** Date courte du repère : « 28 sept. », avec l'année quand elle n'est pas l'année courante. */
function markerDate(date: string): string {
  const day = dayjs(date).locale('fr')
  return day.format(day.year() === dayjs().year() ? 'D MMM' : 'D MMM YY')
}

/**
 * Curseur d'usure 0-10 : piste en 3 bandes à bords francs qui suivent les seuils, état « pas de mesure ».
 * Sur mesure plutôt que `Slider` de Mantine : celui-ci exige une valeur numérique (pas d'état vide) et
 * n'expose pas `aria-valuetext`.
 */
export function WearSlider({ value, onChange, onChangeEnd, config, label, last }: WearSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const unset = value == null
  const zoneKey = wearZoneKey(value, config)
  const zone = zoneKey ? WEAR_ZONES[zoneKey] : null
  const background = `linear-gradient(to right, ${wearTrackBands(config)
    .map((band) => `var(--mantine-color-${WEAR_ZONES[band.zone].color}-6) ${band.from}% ${band.to}%`)
    .join(', ')})`

  const valueFromX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return null
    return Math.round(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * 10)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const next = valueFromX(event.clientX)
    if (next == null) return
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    onChange(next)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    const next = valueFromX(event.clientX)
    if (next != null && next !== value) onChange(next)
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    const next = valueFromX(event.clientX)
    if (next != null) onChangeEnd?.(next)
  }

  // Geste interrompu (appel, geste système) : le curseur ne doit plus suivre le doigt.
  const onPointerCancel = () => {
    draggingRef.current = false
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = value ?? 5
    const steps: Record<string, number> = {
      ArrowRight: Math.min(10, current + 1),
      ArrowUp: Math.min(10, current + 1),
      ArrowLeft: Math.max(0, current - 1),
      ArrowDown: Math.max(0, current - 1),
      Home: 0,
      End: 10,
    }
    const next = steps[event.key]
    if (next == null) return
    event.preventDefault()
    onChange(next)
    onChangeEnd?.(next)
  }

  return (
    <div>
      <Box
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-valuenow={unset ? undefined : value}
        aria-valuetext={unset || !zone ? 'Pas de mesure' : `${value} sur 10, ${zone.label}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
        onKeyDown={onKeyDown}
        style={{ padding: `15px ${THUMB / 2}px`, touchAction: 'none', cursor: 'pointer' }}
      >
        <Box
          ref={trackRef}
          pos="relative"
          h={18}
          style={{ borderRadius: 9, background, opacity: unset ? 0.55 : 1, filter: unset ? 'saturate(0.25)' : undefined }}
        >
          {TICKS.map((tick) => (
            <Box
              key={tick}
              pos="absolute"
              top={0}
              bottom={0}
              w={1}
              bg="rgba(255,255,255,0.7)"
              style={{ left: `${tick * 10}%`, display: tick === 0 || tick === 10 ? 'none' : undefined }}
            />
          ))}
          {last && (
            <>
              <Box
                aria-hidden
                data-testid="wear-last-marker"
                pos="absolute"
                top={-4}
                bottom={-4}
                w={4}
                bg="gray.8"
                style={{ left: `${last.level * 10}%`, transform: 'translateX(-50%)', borderRadius: 2, boxShadow: '0 0 0 2px white' }}
              />
              {last.date && (
                <Text
                  aria-hidden
                  size="xs"
                  c="dimmed"
                  pos="absolute"
                  style={{
                    // Sans poignée, la date passe au-dessus de la piste : la ligne du bas porte « Touchez la barre ».
                    ...(unset ? { bottom: 'calc(100% + 5px)' } : { top: 'calc(100% + 9px)' }),
                    left: `${last.level * 10}%`,
                    // Collé au bord près des extrémités pour rester dans le cadre de la carte.
                    transform: `translateX(${last.level <= 2 ? '-25%' : last.level >= 8 ? '-75%' : '-50%'})`,
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                  }}
                >
                  {markerDate(last.date)}
                </Text>
              )}
            </>
          )}
          {!unset && (
            <Box
              pos="absolute"
              top="50%"
              w={THUMB}
              h={THUMB}
              bg="white"
              style={{
                left: `${(value / 10) * 100}%`,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                border: `4px solid var(--mantine-color-${zone?.color ?? 'gray'}-6)`,
                boxShadow: 'var(--mantine-shadow-sm)',
              }}
            />
          )}
        </Box>
      </Box>
      <Group justify="space-between" mt={-6}>
        <Text size="xs" c="dimmed" style={{ visibility: !unset && last?.date && last.level === 0 ? 'hidden' : undefined }}>0</Text>
        {unset && (
          <Group gap={4} c="dimmed">
            <IconHandFinger size={15} aria-hidden />
            <Text size="xs" fw={600}>Touchez la barre</Text>
          </Group>
        )}
        <Text size="xs" c="dimmed" style={{ visibility: !unset && last?.date && last.level === 10 ? 'hidden' : undefined }}>10</Text>
      </Group>
    </div>
  )
}
