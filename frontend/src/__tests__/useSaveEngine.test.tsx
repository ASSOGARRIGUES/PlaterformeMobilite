// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { SaveSpec, describeSaveError, useSaveEngine } from '../hooks/garage/useSaveEngine'

function spec(overrides: Partial<SaveSpec> = {}): SaveSpec {
  return {
    group: 'g',
    channel: 'c',
    label: 'Champ',
    attempted: 'OK',
    restored: () => 'Défaut',
    apply: vi.fn(),
    execute: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn(),
    ...overrides,
  }
}

const httpError = (status: number, data: unknown = {}) => ({ response: { status, data } })

describe('describeSaveError', () => {
  it('réseau, 5xx et refus du serveur', () => {
    expect(describeSaveError({ message: 'Network Error' })).toEqual({ reason: 'La connexion a échoué.', retryable: true })
    expect(describeSaveError(httpError(500))).toEqual({ reason: 'Erreur du serveur.', retryable: true })
    expect(describeSaveError(httpError(400, { description: ['Obligatoire.'] }))).toEqual({ reason: 'Obligatoire.', retryable: false })
  })
})

describe('useSaveEngine', () => {
  it('applique la valeur, envoie, puis marque « Enregistré »', async () => {
    const { result } = renderHook(() => useSaveEngine())
    const s = spec()
    await act(async () => result.current.run(s))
    await waitFor(() => expect(result.current.status.g).toEqual({ state: 'saved' }))
    expect(s.apply).toHaveBeenCalled()
    expect(s.restore).not.toHaveBeenCalled()
  })

  it('un rejet ne restaure que son propre champ et garde les autres « Enregistré »', async () => {
    const { result } = renderHook(() => useSaveEngine())
    const ok = spec({ group: 'wear.1', channel: 'wear' })
    const ko = spec({ group: 'washer', channel: 'levels', execute: vi.fn().mockRejectedValue({ message: 'Network Error' }) })
    await act(async () => {
      result.current.run(ok)
      result.current.run(ko)
    })
    await waitFor(() => expect(result.current.status.washer?.state).toBe('error'))
    expect(ko.restore).toHaveBeenCalledTimes(1)
    expect(ok.restore).not.toHaveBeenCalled()
    expect(result.current.status['wear.1']).toEqual({ state: 'saved' })
    expect(result.current.errors).toEqual([
      { group: 'washer', reason: 'La connexion a échoué.', retryable: true, attempted: 'OK', restored: 'Défaut', label: 'Champ' },
    ])
  })

  it('un payload à deux champs (un seul groupe) est restauré d’un bloc', async () => {
    const { result } = renderHook(() => useSaveEngine())
    const restore = vi.fn()
    const s = spec({ group: 'lights', execute: vi.fn().mockRejectedValue(httpError(500)), restore })
    await act(async () => result.current.run(s))
    await waitFor(() => expect(result.current.status.lights?.state).toBe('error'))
    expect(restore).toHaveBeenCalledTimes(1)
    expect(result.current.errors[0].reason).toBe('Erreur du serveur.')
  })

  it('la valeur rétablie est lue avant la restauration', async () => {
    const { result } = renderHook(() => useSaveEngine())
    const order: string[] = []
    const s = spec({
      execute: vi.fn().mockRejectedValue(httpError(400, { x: ['Non.'] })),
      restored: () => { order.push('restored'); return 'Avant' },
      restore: () => order.push('restore'),
    })
    await act(async () => result.current.run(s))
    await waitFor(() => expect(result.current.errors).toHaveLength(1))
    expect(order).toEqual(['restored', 'restore'])
    expect(result.current.errors[0]).toMatchObject({ restored: 'Avant', retryable: false, reason: 'Non.' })
  })

  it('« Réessayer » renvoie la valeur tentée', async () => {
    const { result } = renderHook(() => useSaveEngine())
    const execute = vi.fn().mockRejectedValueOnce({ message: 'Network Error' }).mockResolvedValue(undefined)
    const apply = vi.fn()
    await act(async () => result.current.run(spec({ execute, apply })))
    await waitFor(() => expect(result.current.errors).toHaveLength(1))
    await act(async () => result.current.retry('g'))
    await waitFor(() => expect(result.current.status.g).toEqual({ state: 'saved' }))
    expect(execute).toHaveBeenCalledTimes(2)
    expect(apply).toHaveBeenCalledTimes(2)
    expect(result.current.errors).toEqual([])
  })

  it('les requêtes d’un même canal sont jouées l’une après l’autre', async () => {
    const { result } = renderHook(() => useSaveEngine())
    const events: string[] = []
    let releaseFirst: () => void = () => {}
    const first = spec({
      group: 'wear.1', channel: 'wear',
      execute: () => new Promise<void>((resolve) => { events.push('start1'); releaseFirst = () => { events.push('end1'); resolve() } }),
    })
    const second = spec({ group: 'wear.2', channel: 'wear', execute: async () => { events.push('start2') } })
    await act(async () => {
      result.current.run(first)
      result.current.run(second)
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(events).toEqual(['start1'])
    await act(async () => releaseFirst())
    await waitFor(() => expect(events).toEqual(['start1', 'end1', 'start2']))
  })

  it('le curseur attend 700 ms d’inactivité et n’envoie que la dernière valeur', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useSaveEngine())
    const execute = vi.fn().mockResolvedValue(undefined)
    act(() => {
      result.current.run(spec({ execute, delay: 700 }))
      vi.advanceTimersByTime(300)
      result.current.run(spec({ execute, delay: 700 }))
      vi.advanceTimersByTime(699)
    })
    expect(execute).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(execute).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('une 403 fige l’édition : plus aucune requête, message lisible', async () => {
    const onForbidden = vi.fn()
    const { result } = renderHook(() => useSaveEngine(onForbidden))
    const message = 'Cette fiche a été validée il y a plus de 3 jours : seule une personne responsable peut la modifier.'
    await act(async () => result.current.run(spec({ execute: vi.fn().mockRejectedValue(httpError(403, { detail: message })) })))
    await waitFor(() => expect(result.current.frozen).toBe(message))
    expect(onForbidden).toHaveBeenCalledWith(message)
    const next = spec({ group: 'other' })
    await act(async () => result.current.run(next))
    expect(next.execute).not.toHaveBeenCalled()
    expect(result.current.errors[0].retryable).toBe(false)
  })
})
