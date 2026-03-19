import { useState, useEffect, useCallback } from 'react'

declare global {
  interface Window {
    deferredPrompt?: BeforeInstallPromptEvent
  }
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

export function InstallPromptBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  const checkInstallStatus = useCallback(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const dismissed = localStorage.getItem('installBannerDismissed')
    setIsInstalled(isStandalone)
    return isStandalone || dismissed
  }, [])

  useEffect(() => {
    const userAgent = navigator.userAgent
    const iOS = /iPad|iPhone|iPod/.test(userAgent)
    setIsIOS(iOS)

    if (checkInstallStatus()) {
      return
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true)
        setIsVisible(false)
      }
    }
    mediaQuery.addEventListener('change', handleChange)

    const timer = setTimeout(() => {
      if (!checkInstallStatus() && (deferredPrompt || iOS)) {
        setIsVisible(true)
      }
    }, 2000)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [checkInstallStatus, deferredPrompt])

  useEffect(() => {
    const dismissed = localStorage.getItem('installBannerDismissed')
    if (!checkInstallStatus() && (deferredPrompt || isIOS)) {
      const timer = setTimeout(() => setIsVisible(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [checkInstallStatus, deferredPrompt, isIOS])

  const handleInstall = async () => {
    if (isIOS) {
      alert('Para instalar en tu iPhone/iPad:\n\n1. Pulsa el botón compartir 📤\n2. Desplázate y pulsa "Añadir a pantalla de inicio"\n3. Pulsa "Añadir"')
      return
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      
      if (outcome === 'accepted') {
        setIsVisible(false)
        setIsInstalled(true)
      }
      
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
    localStorage.setItem('installBannerDismissed', 'true')
  }

  if (!isVisible || isInstalled) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-[#0A1F44] to-blue-700 text-white p-4 shadow-2xl z-50 animate-slideUp">
      <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xl sm:text-2xl">📱</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm sm:text-base">Instala la app</p>
            <p className="text-xs sm:text-sm text-blue-200 hidden sm:block">
              Accede más rápido desde tu móvil
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleInstall}
            className="bg-white text-[#0A1F44] px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-colors"
          >
            Instalar
          </button>
          <button
            onClick={handleDismiss}
            className="p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
