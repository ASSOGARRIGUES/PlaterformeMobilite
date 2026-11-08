import { useEffect, useState } from 'react'
import { wearPerPageFor } from './inspectionStepperUtils'

const visibleHeight = () => window.visualViewport?.height ?? window.innerHeight

/** Cartes d'usure par page, recalculé quand la zone visible change (ouverture du clavier, rotation). */
export function useWearPerPage(): number {
  const [perPage, setPerPage] = useState(() => wearPerPageFor(visibleHeight()))
  useEffect(() => {
    const update = () => setPerPage(wearPerPageFor(visibleHeight()))
    const target = window.visualViewport ?? window
    target.addEventListener('resize', update)
    return () => target.removeEventListener('resize', update)
  }, [])
  return perPage
}
