// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const mutate = vi.fn()

vi.mock('@refinedev/core', () => ({
  useApiUrl: () => 'http://api',
  useInvalidate: () => vi.fn(),
  useCustomMutation: () => ({ mutateAsync: mutate }),
  useCustom: () => ({ data: { data: [{ id: 1, name: 'Freins', icon: 'brake' }, { id: 2, name: 'Pneus', icon: 'tire' }] } }),
  useList: () => ({ data: { data: [] } }),
}))
vi.mock('@mantine/modals', () => ({ openConfirmModal: ({ onConfirm }: { onConfirm: () => void }) => onConfirm() }))

import { useValidatedInspectionEdit } from '../hooks/garage/useValidatedInspectionEdit'
import { InspectionSheet } from '../types/garage'

const CONFIG = { wear_critical_threshold: 2, wear_alert_threshold: 5 }
const network = { message: 'Network Error' }

const sheet = {
  id: 9,
  status: 'validated',
  vehicle: { id: 3, type: 'voiture' },
  oil_ok: true, coolant_ok: true, washer_ok: false,
  lights_ok: false, lights_notes: 'Feu stop', road_test_done: true, road_test_notes: '',
  wear_measurements: [{ id: 1, catalog_task: 1, catalog_task_name: 'Freins', catalog_task_icon: 'brake', level: 8 }],
  damages: [], tasks: [],
} as unknown as InspectionSheet

const setup = () => renderHook(() => useValidatedInspectionEdit(sheet, { wearConfig: CONFIG, vehicleType: 'voiture' }))

describe('useValidatedInspectionEdit', () => {
  beforeEach(() => {
    mutate.mockReset()
    mutate.mockResolvedValue({ data: {} })
  })

  it('enregistre un niveau aussitôt : PATCH du seul champ modifié', async () => {
    const { result } = setup()
    await act(async () => result.current.setLevel('oil', 'Huile', false))
    await waitFor(() => expect(result.current.engine.status['levels.oil']).toEqual({ state: 'saved' }))
    expect(mutate.mock.calls[0][0]).toMatchObject({ url: 'http://api/garage/inspection/9/', method: 'patch', values: { oil_ok: false } })
    expect(result.current.values.oil).toBe(false)
  })

  it('un rejet ne restaure que le champ refusé : l’autre modification reste enregistrée', async () => {
    mutate.mockImplementation(({ values }) => (values.washer_ok === true ? Promise.reject(network) : Promise.resolve({ data: {} })))
    const { result } = setup()
    await act(async () => {
      result.current.setLevel('oil', 'Huile', false)
      result.current.setLevel('washer', 'Lave-glace', true)
    })
    await waitFor(() => expect(result.current.engine.status['levels.washer']?.state).toBe('error'))
    expect(result.current.values.washer).toBe(false) // rétabli
    expect(result.current.values.oil).toBe(false) // gardé
    expect(result.current.engine.status['levels.oil']).toEqual({ state: 'saved' })
    expect(result.current.engine.errors[0]).toMatchObject({ attempted: 'OK', restored: 'Défaut', label: 'Lave-glace', retryable: true })
  })

  it('éclairage → OK efface la note : deux champs dans une requête, restaurés ensemble au rejet', async () => {
    mutate.mockRejectedValue({ response: { status: 500, data: '' } })
    const { result } = setup()
    await act(async () => result.current.setLights(true))
    await waitFor(() => expect(result.current.engine.status.lights?.state).toBe('error'))
    expect(mutate.mock.calls[0][0].values).toEqual({ lights_ok: true, lights_notes: '' })
    expect(result.current.values.lightsOk).toBe(false)
    expect(result.current.values.lightsNotes).toBe('Feu stop')
    expect(result.current.engine.errors[0].restored).toBe('Défaut, « Feu stop »')
  })

  it('une note inchangée n’envoie rien', async () => {
    const { result } = setup()
    await act(async () => result.current.setText('lightsNotes', 'lights_notes', 'Notes', 'Feu stop'))
    expect(mutate).not.toHaveBeenCalled()
  })

  it('usure : chaque envoi porte la liste complète de la fiche, en série', async () => {
    const { result } = setup()
    const [brakes, tires] = [{ id: 1, name: 'Freins', icon: 'brake' }, { id: 2, name: 'Pneus', icon: 'tire' }] as never[]
    await act(async () => {
      result.current.setWear(brakes, 4, 'segments')
      result.current.setWear(tires, 6, 'segments')
    })
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2))
    expect(mutate.mock.calls[0][0].values.wear_measurements).toEqual([{ catalog_task: 1, level: 4 }])
    expect(mutate.mock.calls[1][0].values.wear_measurements).toEqual([{ catalog_task: 1, level: 4 }, { catalog_task: 2, level: 6 }])
  })

  it('usure rejetée : seule cette mesure est rétablie, l’autre reste « Enregistré »', async () => {
    mutate.mockImplementation(({ values }) =>
      values.wear_measurements.length === 2 ? Promise.reject(network) : Promise.resolve({ data: {} }))
    const { result } = setup()
    const [brakes, tires] = [{ id: 1, name: 'Freins', icon: 'brake' }, { id: 2, name: 'Pneus', icon: 'tire' }] as never[]
    await act(async () => {
      result.current.setWear(brakes, 4, 'segments')
      result.current.setWear(tires, 6, 'segments')
    })
    await waitFor(() => expect(result.current.engine.status['wear.2']?.state).toBe('error'))
    expect(result.current.values.wear).toEqual({ 1: 4 })
    expect(result.current.engine.status['wear.1']).toEqual({ state: 'saved' })
    expect(result.current.engine.errors[0]).toMatchObject({ attempted: '6/10 · Bon état', restored: 'Non mesuré' })
  })

  it('retirer une mesure (null) est ignoré : l’API le refuse pour une fiche validée', async () => {
    const { result } = setup()
    await act(async () => result.current.setWear({ id: 1, name: 'Freins', icon: 'brake' } as never, null, 'segments'))
    expect(mutate).not.toHaveBeenCalled()
  })

  it('un nouveau dégât reste un brouillon local tant que sa description est vide', async () => {
    const { result } = setup()
    act(() => result.current.addDamage())
    const { localId } = result.current.values.damages[0]
    await act(async () => result.current.commitDamageDescription(localId))
    expect(mutate).not.toHaveBeenCalled()
    act(() => result.current.typeDamageDescription(localId, 'Rayure'))
    mutate.mockResolvedValueOnce({ data: { id: 5, sheet: 9, description: 'Rayure', photos: [] } })
    await act(async () => result.current.commitDamageDescription(localId))
    await waitFor(() => expect(result.current.values.damages[0].serverId).toBe(5))
    expect(mutate.mock.calls[0][0]).toMatchObject({ url: 'http://api/garage/inspection/9/damages/', method: 'post', values: { description: 'Rayure' } })
  })

  // Revue 3.3 : la réponse d'une requête ne doit pas effacer ce qui a été saisi pendant qu'elle était en vol.
  it('une photo ajoutée pendant l’envoi de la précédente n’est pas perdue au retour du serveur', async () => {
    const withDamage = { ...sheet, damages: [{ id: 5, sheet: 9, description: 'Rayure', photos: [] }] } as unknown as InspectionSheet
    const { result } = renderHook(() => useValidatedInspectionEdit(withDamage, { wearConfig: CONFIG, vehicleType: 'voiture' }))
    const localId = result.current.values.damages[0].localId
    let release: (value: unknown) => void = () => {}
    mutate.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    act(() => result.current.addDamagePhoto(localId, 'data:image/png;base64,AAA'))
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
    act(() => result.current.addDamagePhoto(localId, 'data:image/png;base64,BBB')) // pendant l'envoi de la première
    mutate.mockResolvedValue({ data: { id: 5, sheet: 9, description: 'Rayure', photos: [{ id: 1, url: 'http://x/1.jpg' }, { id: 2, url: 'http://x/2.jpg' }] } })
    await act(async () => release({ data: { id: 5, sheet: 9, description: 'Rayure', photos: [{ id: 1, url: 'http://x/1.jpg' }] } }))
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.engine.saving).toBe(false))
    expect(result.current.values.damages[0].photos).toEqual(['http://x/1.jpg', 'http://x/2.jpg'])
  })
})
