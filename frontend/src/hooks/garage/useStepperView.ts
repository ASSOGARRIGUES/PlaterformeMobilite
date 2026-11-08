import { useEffect, useState } from 'react'

/**
 * Sous-vue locale « Récapitulatif » greffée sur la dernière étape persistée d'un stepper : `current_step`
 * ne dépasse jamais `recapAfterStep`, la vue affichée (`viewStep`) passe à `recapAfterStep + 1` en mode récapitulatif.
 */
export function useStepperView(activeStep: number, recapAfterStep: number) {
  const [recapView, setRecapView] = useState(false)

  useEffect(() => {
    if (activeStep !== recapAfterStep) setRecapView(false)
  }, [activeStep, recapAfterStep])

  const viewStep = activeStep === recapAfterStep && recapView ? recapAfterStep + 1 : activeStep
  return { viewStep, recapView, setRecapView }
}
