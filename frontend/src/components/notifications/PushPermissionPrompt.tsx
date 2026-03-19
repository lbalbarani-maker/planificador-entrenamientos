import { useState } from 'react'
import { usePushNotifications } from '../../hooks/usePushNotifications'

interface PushPermissionPromptProps {
  triggerText?: string
  title?: string
  description?: string
  variant?: 'banner' | 'card' | 'button'
}

export function PushPermissionPrompt({
  triggerText = 'Activar alertas',
  title = '¿Quieres recibir alertas del club?',
  description = 'Recibe notificaciones sobre partidos, convocatorias y mucho más.',
  variant = 'card'
}: PushPermissionPromptProps) {
  const { permission, isSubscribed, isLoading, subscribe } = usePushNotifications()
  const [isVisible, setIsVisible] = useState(true)
  const [isDismissed, setIsDismissed] = useState(false)

  if (permission === 'denied' || isSubscribed || isDismissed) {
    return null
  }

  const handleAccept = async () => {
    await subscribe()
    setIsVisible(false)
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    localStorage.setItem('push_prompt_dismissed', Date.now().toString())
  }

  if (!isVisible) return null

  if (variant === 'button') {
    return (
      <button
        onClick={handleAccept}
        disabled={isLoading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        <span>🔔</span>
        <span>{isLoading ? 'Activando...' : triggerText}</span>
      </button>
    )
  }

  if (variant === 'banner') {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{title}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              No gracias
            </button>
            <button
              onClick={handleAccept}
              disabled={isLoading}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? '...' : 'Activar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
          <span className="text-2xl">🔔</span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
          <p className="text-sm text-gray-600 mb-3">{description}</p>
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Activando...' : 'Sí, activar'}
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
