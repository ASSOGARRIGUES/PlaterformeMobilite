// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const customMutate = vi.fn()

vi.mock('@refinedev/core', () => ({
  useApiUrl: () => 'http://api',
  useInvalidate: () => vi.fn(),
  useUpdate: () => ({ mutateAsync: vi.fn() }),
  useCustomMutation: () => ({ mutateAsync: customMutate, isLoading: false }),
  useShow: () => ({
    queryResult: {
      data: {
        data: {
          id: 7,
          status: 'validated',
          created_at: '2026-10-01T10:00:00Z',
          vehicle: { id: 1, type: 'car' },
          tasks: [
            { id: 11, sheet: 7, type: 'done', catalog_task: 5, name: null, description: '', wear_level: 8, parts: [], photos: [] },
          ],
        },
      },
    },
  }),
  useList: ({ resource }: { resource: string }) => ({
    data: { data: resource === 'garage/task-catalog' ? [{ id: 5, name: 'Plaquettes', is_wear_task: true, vehicle_types: ['car'] }] : [] },
  }),
}))

import { useValidatedInterventionEdit } from '../hooks/garage/useValidatedInterventionEdit'

describe('useValidatedInterventionEdit.persistTask', () => {
  beforeEach(() => {
    customMutate.mockReset()
    customMutate.mockResolvedValue({
      data: { id: 11, sheet: 7, type: 'done', catalog_task: 5, name: null, description: '', wear_level: 4, parts: [], photos: [] },
    })
  })

  // Le Slider Mantine appelle onChange puis onChangeEnd dans le même tick (clavier) :
  // persistTask doit utiliser la tâche transmise par onCommit, pas l'état de sa closure.
  it('envoie le PATCH de la tâche transmise même si le state local n’est pas encore à jour', async () => {
    const { result } = renderHook(() => useValidatedInterventionEdit(7))
    await waitFor(() => expect(result.current.doneTasks).toHaveLength(1))

    const task = result.current.doneTasks[0]
    const edited = { ...task, wearLevel: 4 }
    await act(async () => {
      result.current.updateTaskLocal(task.localId, edited, 'done')
      await result.current.persistTask(task.localId, 'done', edited)
    })

    expect(customMutate).toHaveBeenCalledTimes(1)
    expect(customMutate.mock.calls[0][0]).toMatchObject({
      url: 'http://api/garage/intervention/7/tasks/11/',
      method: 'patch',
      values: { wear_level: 4 },
    })
  })
})
