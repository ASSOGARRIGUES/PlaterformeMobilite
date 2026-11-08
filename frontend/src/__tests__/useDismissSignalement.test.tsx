// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mutateAsync = vi.fn()
const invalidate = vi.fn()
const openConfirmModal = vi.fn()
const showNotification = vi.fn()

vi.mock('@refinedev/core', () => ({
  useApiUrl: () => 'http://api',
  useCustomMutation: () => ({ mutateAsync }),
  useInvalidate: () => invalidate,
}))
vi.mock('@mantine/modals', () => ({ openConfirmModal: (options: unknown) => openConfirmModal(options) }))
vi.mock('@mantine/notifications', () => ({ showNotification: (options: unknown) => showNotification(options) }))

import { useDismissSignalement } from '../hooks/garage/useDismissSignalement'
import { MaintenanceSignalement } from '../types/garage'

const signalement = (sheetKind: 'intervention' | 'inspection') =>
  ({ sheet_kind: sheetKind, sheet_id: 7, task_id: 42 }) as unknown as MaintenanceSignalement

beforeEach(() => {
  vi.clearAllMocks()
  mutateAsync.mockResolvedValue({})
})

async function confirm(sheetKind: 'intervention' | 'inspection') {
  const { result } = renderHook(() => useDismissSignalement(3))
  act(() => {
    result.current.confirmDismiss(signalement(sheetKind))
  })
  const options = openConfirmModal.mock.calls[0][0] as { onConfirm: () => Promise<void> }
  await act(async () => {
    await options.onConfirm()
  })
}

describe('useDismissSignalement', () => {
  it('asks for confirmation before anything is sent', () => {
    const { result } = renderHook(() => useDismissSignalement(3))
    act(() => {
      result.current.confirmDismiss(signalement('intervention'))
    })
    expect(openConfirmModal).toHaveBeenCalledTimes(1)
    expect(mutateAsync).not.toHaveBeenCalled()
  })

  it('posts to the endpoint of the sheet kind of the signalement (intervention)', async () => {
    await confirm('intervention')
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://api/garage/intervention/7/tasks/42/dismiss/', method: 'post' }))
  })

  it('posts to the inspection endpoint for a signalement raised by a check sheet', async () => {
    await confirm('inspection')
    expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://api/garage/inspection/7/tasks/42/dismiss/' }))
  })

  it('reloads the maintenance summary of the vehicle afterwards', async () => {
    await confirm('intervention')
    expect(invalidate).toHaveBeenCalledWith({ resource: 'garage/maintenance', id: 3, invalidates: ['detail'] })
  })

  it('tells the user when it fails, and still reloads the summary', async () => {
    mutateAsync.mockRejectedValue(new Error('boom'))
    await confirm('intervention')
    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({ color: 'red' }))
    expect(invalidate).toHaveBeenCalled()
  })
})
