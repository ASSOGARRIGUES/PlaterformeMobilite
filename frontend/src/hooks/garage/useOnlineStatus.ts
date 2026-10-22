import { useEffect, useState } from 'react'

/** Reflète `navigator.onLine` ; indice seulement (faux positifs en réseau faible) : l'échec réel d'une requête reste l'arbitre. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])
  return online
}
