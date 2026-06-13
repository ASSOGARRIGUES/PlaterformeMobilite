import { useEffect, useState } from 'react'
import { Alert } from '@mantine/core'
import { IconWifiOff } from '@tabler/icons-react'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <Alert
      icon={<IconWifiOff size={16} />}
      color="orange"
      radius={0}
      style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}
    >
      Hors-ligne — la saisie reste possible, mais la soumission est bloquée
    </Alert>
  )
}
