// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-empty-function */
import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { WearStepBody } from '../components/garage/inspection/WearStepBody'
import { MeasurableTask } from '../types/garage'

const config = { wear_critical_threshold: 2, wear_alert_threshold: 5 }
const makeTasks = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Tâche ${i + 1}`, icon: 'tool' })) as unknown as MeasurableTask[]

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false }),
  })
})
afterEach(cleanup)

function renderPage(count: number, page: number, perPage = 2, values: Record<number, number> = {}) {
  render(
    <MantineProvider>
      <WearStepBody tasks={makeTasks(count)} values={values} onSet={() => {}} page={page} perPage={perPage} input="segments" config={config} />
    </MantineProvider>,
  )
  return screen.queryAllByRole('radiogroup').map((group) => group.getAttribute('aria-label'))
}

describe('WearStepBody pagination', () => {
  it.each([
    [1, 0, ['Tâche 1']],
    [2, 0, ['Tâche 1', 'Tâche 2']],
    [3, 0, ['Tâche 1', 'Tâche 2']],
    [3, 1, ['Tâche 3']],
    [5, 0, ['Tâche 1', 'Tâche 2']],
    [5, 1, ['Tâche 3', 'Tâche 4']],
    [5, 2, ['Tâche 5']],
  ])('%i tasks, page %i -> %j', (count, page, expected) => {
    expect(renderPage(count, page)).toEqual(expected)
  })

  it('shows one card per page when the height is short (perPage 1)', () => {
    expect(renderPage(3, 1, 1)).toEqual(['Tâche 2'])
  })

  it('shows the page dots only when there are several pages', () => {
    renderPage(2, 0)
    expect(screen.queryByText(/Page \d sur/)).toBeNull()
    cleanup()
    renderPage(3, 0)
    expect(screen.getByText('Page 1 sur 2')).toBeTruthy()
  })

  it('keeps the step with an empty state when the vehicle type has no measurable task', () => {
    expect(renderPage(0, 0)).toEqual([])
    expect(screen.getByText("Aucune mesure d'usure pour ce type de véhicule.")).toBeTruthy()
    expect(screen.getByText("Passez à l'étape suivante.")).toBeTruthy()
  })

  it('shows the last measurement line only on the single-task card', () => {
    render(
      <MantineProvider>
        <WearStepBody tasks={makeTasks(1)} values={{}} onSet={() => {}} page={0} perPage={2} input="segments" config={config} last={{ 1: { level: 9, date: '2026-01-01' } }} />
      </MantineProvider>,
    )
    expect(screen.getByText(/Dernier relevé : Bon état \(9\/10\)/)).toBeTruthy()
  })

  const renderWithLast = (count: number, values: Record<number, number>, input: 'slider' | 'segments' = 'slider') =>
    render(
      <MantineProvider>
        <WearStepBody
          tasks={makeTasks(count)}
          values={values}
          onSet={() => {}}
          page={0}
          perPage={2}
          input={input}
          config={config}
          last={{ 1: { level: 2, date: '2026-01-05' }, 2: { level: 8, date: '2026-01-05' } }}
        />
      </MantineProvider>,
    )

  it('keeps the detailed last measurement line to the single-task card, but marks every slider', () => {
    renderWithLast(2, {})
    expect(screen.queryByText(/Dernier relevé :/)).toBeNull()
    expect(screen.getAllByTestId('wear-last-marker')).toHaveLength(2)
    expect(screen.getAllByText(/5 janv/)).toHaveLength(2)
  })

  it('warns when the value is in a better zone than the last measurement', () => {
    renderWithLast(2, { 1: 7, 2: 9 }) // tâche 1 : critique -> bon ; tâche 2 : bon -> bon
    expect(screen.getAllByTestId('wear-improved-warning')).toHaveLength(1)
    expect(screen.getByText('Pièce remplacée depuis le dernier relevé ?')).toBeTruthy()
  })

  it('stays quiet when worse, within the same zone or unmeasured', () => {
    renderWithLast(2, { 1: 1, 2: 3 }) // tâche 1 : critique -> critique ; tâche 2 : bon -> à surveiller
    expect(screen.queryByTestId('wear-improved-warning')).toBeNull()
    cleanup()
    renderWithLast(2, {})
    expect(screen.queryByTestId('wear-improved-warning')).toBeNull()
  })

  it('also warns with the segment input', () => {
    renderWithLast(1, { 1: 8 }, 'segments')
    expect(screen.getAllByTestId('wear-improved-warning')).toHaveLength(1)
  })
})
