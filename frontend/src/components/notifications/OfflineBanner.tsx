import { useOnlineStatus } from '../../hooks/useOnlineStatus'

export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white px-4 py-2 text-center text-sm z-50 flex items-center justify-center gap-2">
      <span>📴</span>
      <span>Estás sin conexión. Mostrando datos guardados.</span>
    </div>
  )
}
