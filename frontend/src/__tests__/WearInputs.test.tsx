// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-empty-function */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { WearSegments } from '../components/garage/WearSegments'
import { WearSlider } from '../components/garage/WearSlider'
import { PagerDots } from '../components/garage/PagerDots'

const config = { wear_critical_threshold: 2, wear_alert_threshold: 5 }

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    }),
  })
  class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
  Object.assign(globalThis, { ResizeObserver: ResizeObserverStub })
})
afterEach(cleanup)

const renderUi = (ui: React.ReactElement) => render(<MantineProvider>{ui}</MantineProvider>)

describe('WearSegments', () => {
  it('stores the middle of the zone (1 / 4 / 8 for 2/5)', () => {
    const onChange = vi.fn()
    renderUi(<WearSegments value={null} onChange={onChange} config={config} label="Pneus" />)
    fireEvent.click(screen.getByRole('radio', { name: /À changer/ }))
    fireEvent.click(screen.getByRole('radio', { name: /À surveiller/ }))
    fireEvent.click(screen.getByRole('radio', { name: /Bon/ }))
    expect(onChange.mock.calls.map(([v]) => v)).toEqual([1, 4, 8])
  })

  it('pre-selects by zone, not by equality with the button values', () => {
    renderUi(<WearSegments value={7} onChange={() => {}} config={config} label="Pneus" />)
    expect(screen.getByRole('radio', { name: /Bon/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: /À surveiller/ }).getAttribute('aria-checked')).toBe('false')
  })

  it('a level of 0 is selected as critical', () => {
    renderUi(<WearSegments value={0} onChange={() => {}} config={config} label="Pneus" />)
    expect(screen.getByRole('radio', { name: /À changer/ }).getAttribute('aria-checked')).toBe('true')
  })

  it('touching the selected button clears the measurement', () => {
    const onChange = vi.fn()
    renderUi(<WearSegments value={4} onChange={onChange} config={config} label="Pneus" />)
    fireEvent.click(screen.getByRole('radio', { name: /À surveiller/ }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('names the group after the task and announces the clearing gesture', () => {
    renderUi(<WearSegments value={null} onChange={() => {}} config={config} label="Plaquettes de frein" />)
    const group = screen.getByRole('radiogroup', { name: 'Plaquettes de frein' })
    const hint = document.getElementById(group.getAttribute('aria-describedby') ?? '')
    expect(hint?.textContent).toBe('Toucher à nouveau pour effacer')
  })

  it('follows a changed configuration: with 3/6 a level of 3 is critical', () => {
    renderUi(<WearSegments value={3} onChange={() => {}} config={{ wear_critical_threshold: 3, wear_alert_threshold: 6 }} label="Pneus" />)
    expect(screen.getByRole('radio', { name: /À changer/ }).getAttribute('aria-checked')).toBe('true')
  })
})

describe('WearSlider', () => {
  it('has no aria-valuenow without a measurement and says so', () => {
    renderUi(<WearSlider value={null} onChange={() => {}} config={config} label="Pneus" />)
    const slider = screen.getByRole('slider', { name: 'Pneus' })
    expect(slider.getAttribute('aria-valuenow')).toBeNull()
    expect(slider.getAttribute('aria-valuetext')).toBe('Pas de mesure')
    expect(screen.getByText('Touchez la barre')).toBeTruthy()
  })

  it('announces the value and its zone', () => {
    renderUi(<WearSlider value={5} onChange={() => {}} config={config} label="Pneus" />)
    const slider = screen.getByRole('slider', { name: 'Pneus' })
    expect(slider.getAttribute('aria-valuenow')).toBe('5')
    expect(slider.getAttribute('aria-valuetext')).toBe('5 sur 10, À surveiller')
  })

  it('moves by one with the arrow keys, from 5 when there is no measurement yet', () => {
    const onChange = vi.fn()
    const { rerender } = renderUi(<WearSlider value={null} onChange={onChange} config={config} label="Pneus" />)
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith(6)
    rerender(<MantineProvider><WearSlider value={0} onChange={onChange} config={config} label="Pneus" /></MantineProvider>)
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith(0)
  })
})

describe('PagerDots', () => {
  it('renders nothing for a single page', () => {
    const { container } = renderUi(<PagerDots count={1} index={0} />)
    expect(container.querySelector('[aria-live]')).toBeNull()
  })

  it('announces the current page in text', () => {
    renderUi(<PagerDots count={3} index={1} />)
    expect(screen.getByText('Page 2 sur 3')).toBeTruthy()
  })
})
