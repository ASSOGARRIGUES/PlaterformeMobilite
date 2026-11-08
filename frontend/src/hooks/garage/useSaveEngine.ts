import { useCallback, useMemo, useRef, useState } from 'react'
import { errorStatus, extractStepError, isRetryableError } from './interventionStepperUtils'

export const SLIDER_DEBOUNCE_MS = 700

export type GroupError = {
  /** Phrase d'explication : « La connexion a échoué. », « Erreur du serveur. » ou le refus lisible du serveur. */
  reason: string
  /** Réseau ou 5xx : la saisie est valide, « Réessayer » renvoie la valeur tentée. */
  retryable: boolean
  attempted: string
  restored: string
  label: string
}

export type GroupStatus = { state: 'saving' } | { state: 'saved' } | { state: 'error'; error: GroupError }

export type SaveSpec = {
  /** Identifiant de l'état affiché (un champ, ou un groupe de champs partis ensemble dans une même requête). */
  group: string
  /** Les requêtes d'un même canal sont jouées l'une après l'autre (ex. deux PATCH de mesures ne s'écrasent pas). */
  channel: string
  label: string
  /** Valeur tentée, en clair pour l'alerte (« OK »). */
  attempted: string
  /** Valeur enregistrée, en clair ; lue au moment de l'échec, avant la restauration. */
  restored: () => string
  /** Met l'état local à la valeur tentée. */
  apply: () => void
  /** Envoie la requête ; lève en cas d'échec. Elle lit l'état courant, pas celui de la closure. */
  execute: () => Promise<void>
  /** Rétablit les seuls champs de cette requête à leur dernière valeur enregistrée. */
  restore: () => void
  /** Attente avant l'envoi (curseur : 700 ms d'inactivité). */
  delay?: number
}

/** Message de l'alerte d'un champ non enregistré (réseau, 5xx ou refus du serveur). */
export function describeSaveError(error: unknown): { reason: string; retryable: boolean } {
  const retryable = isRetryableError(error)
  if (retryable) return { reason: errorStatus(error) === undefined ? 'La connexion a échoué.' : 'Erreur du serveur.', retryable }
  return { reason: extractStepError(error), retryable }
}

/**
 * Moteur d'enregistrement champ par champ : `pending -> saving -> saved | error`. Un échec ne rétablit que les champs de la
 * requête rejetée ; les autres modifications restent. Une 403 (délai d'édition dépassé) fige l'édition.
 */
export function useSaveEngine(onForbidden?: (message: string) => void) {
  const [status, setStatus] = useState<Record<string, GroupStatus>>({})
  const [frozen, setFrozen] = useState<string | null>(null)
  const frozenRef = useRef<string | null>(null)
  const queues = useRef<Record<string, Promise<void>>>({})
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const specs = useRef<Record<string, SaveSpec>>({})
  const onForbiddenRef = useRef(onForbidden)
  onForbiddenRef.current = onForbidden

  const start = useCallback((spec: SaveSpec) => {
    setStatus((current) => ({ ...current, [spec.group]: { state: 'saving' } }))
    const previous = queues.current[spec.channel] ?? Promise.resolve()
    queues.current[spec.channel] = previous.then(async () => {
      try {
        await spec.execute()
        setStatus((current) => ({ ...current, [spec.group]: { state: 'saved' } }))
      } catch (error) {
        const restored = spec.restored()
        spec.restore()
        const { reason, retryable } = describeSaveError(error)
        if (errorStatus(error) === 403) {
          frozenRef.current = reason
          setFrozen(reason)
          onForbiddenRef.current?.(reason)
        }
        setStatus((current) => ({
          ...current,
          [spec.group]: { state: 'error', error: { reason, retryable: retryable && errorStatus(error) !== 403, attempted: spec.attempted, restored, label: spec.label } },
        }))
      }
    })
  }, [])

  const run = useCallback(
    (spec: SaveSpec) => {
      if (frozenRef.current) return
      spec.apply()
      specs.current[spec.group] = spec
      clearTimeout(timers.current[spec.group])
      if (spec.delay) {
        setStatus((current) => ({ ...current, [spec.group]: { state: 'saving' } }))
        timers.current[spec.group] = setTimeout(() => start(spec), spec.delay)
      } else {
        start(spec)
      }
    },
    [start],
  )

  const retry = useCallback((group: string) => {
    const spec = specs.current[group]
    if (spec) run({ ...spec, delay: undefined })
  }, [run])

  return useMemo(() => {
    const entries = Object.entries(status)
    const errors = entries.flatMap(([group, value]) => (value.state === 'error' ? [{ group, ...value.error }] : []))
    return {
      status,
      errors,
      saving: entries.some(([, value]) => value.state === 'saving'),
      anySaved: entries.some(([, value]) => value.state === 'saved'),
      frozen,
      run,
      retry,
    }
  }, [status, frozen, run, retry])
}
