import { useEffect, useRef, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ActionIcon, Image, Text } from '@mantine/core'
import { IconX, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'

type PhotoLightboxProps = {
  photos: string[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

const navButtonStyle: CSSProperties = {
  position: 'fixed',
  background: 'rgba(255,255,255,.1)',
  color: '#fff',
}

/** Visionneuse plein écran (overlay en portal) : flèches/compteur restent en position fixe, jamais poussés hors champ par la taille de l'image (retour design story 2.6). */
export function PhotoLightbox({ photos, index, onIndexChange, onClose }: PhotoLightboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    containerRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (photos.length > 1 && e.key === 'ArrowLeft') onIndexChange((index - 1 + photos.length) % photos.length)
      if (photos.length > 1 && e.key === 'ArrowRight') onIndexChange((index + 1) % photos.length)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [index, photos.length, onClose, onIndexChange])

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8,12,18,.94)',
        zIndex: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        outline: 'none',
      }}
    >
      <Image
        src={photos[index]}
        fit="contain"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(78vw, 640px)', maxHeight: '76vh', borderRadius: 12 }}
      />

      <ActionIcon
        variant="filled"
        radius="xl"
        size={44}
        aria-label="Fermer"
        onClick={onClose}
        style={{ ...navButtonStyle, top: 22, right: 26 }}
      >
        <IconX size={22} />
      </ActionIcon>

      {photos.length > 1 && (
        <>
          <ActionIcon
            variant="filled"
            radius="xl"
            size={52}
            aria-label="Photo précédente"
            onClick={(e) => {
              e.stopPropagation()
              onIndexChange((index - 1 + photos.length) % photos.length)
            }}
            style={{ ...navButtonStyle, top: '50%', left: 22, transform: 'translateY(-50%)' }}
          >
            <IconChevronLeft size={24} />
          </ActionIcon>
          <ActionIcon
            variant="filled"
            radius="xl"
            size={52}
            aria-label="Photo suivante"
            onClick={(e) => {
              e.stopPropagation()
              onIndexChange((index + 1) % photos.length)
            }}
            style={{ ...navButtonStyle, top: '50%', right: 22, transform: 'translateY(-50%)' }}
          >
            <IconChevronRight size={24} />
          </ActionIcon>
          <Text
            style={{
              position: 'fixed',
              bottom: 26,
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              background: 'rgba(255,255,255,.12)',
              padding: '7px 16px',
              borderRadius: 999,
            }}
          >
            Photo {index + 1}/{photos.length}
          </Text>
        </>
      )}
    </div>,
    document.body,
  )
}
