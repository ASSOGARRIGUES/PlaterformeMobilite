// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { OfflineBanner } from '../components/garage/OfflineBanner'

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
})

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

describe('OfflineBanner', () => {
  const originalOnLine = window.navigator.onLine

  afterEach(() => {
    cleanup()
    Object.defineProperty(window.navigator, 'onLine', {
      value: originalOnLine,
      writable: true,
      configurable: true,
    })
  })

  it('ne s\'affiche pas quand le navigateur est en ligne', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    })
    renderWithMantine(<OfflineBanner />)
    expect(screen.queryByText(/Hors-ligne/)).toBeNull()
  })

  it('s\'affiche quand navigator.onLine est false', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    })
    renderWithMantine(<OfflineBanner />)
    expect(screen.getAllByText(/Hors-ligne/).length).toBeGreaterThan(0)
  })

  it('apparaît quand l\'événement offline est déclenché', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    })
    renderWithMantine(<OfflineBanner />)
    expect(screen.queryByText(/Hors-ligne/)).toBeNull()

    fireEvent(window, new Event('offline'))
    expect(screen.getAllByText(/Hors-ligne/).length).toBeGreaterThan(0)
  })

  it('disparaît quand l\'événement online est déclenché', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      value: false,
      writable: true,
      configurable: true,
    })
    renderWithMantine(<OfflineBanner />)
    expect(screen.getAllByText(/Hors-ligne/).length).toBeGreaterThan(0)

    fireEvent(window, new Event('online'))
    expect(screen.queryByText(/Hors-ligne/)).toBeNull()
  })
})
