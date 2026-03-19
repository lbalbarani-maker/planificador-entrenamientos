import { usePushNotifications, NotificationPreferences } from '../../hooks/usePushNotifications'

interface NotificationToggleProps {
  onShowSettings?: () => void
}

export function NotificationToggle({ onShowSettings }: NotificationToggleProps) {
  const {
    permission,
    isSupported,
    isSubscribed,
    isLoading,
    preferences,
    subscribe,
    unsubscribe,
    updatePreferences
  } = usePushNotifications()

  if (!isSupported) {
    return null
  }

  if (permission === 'denied') {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-700">
          Las notificaciones están bloqueadas. Habilítalas en la configuración de tu navegador.
        </p>
      </div>
    )
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe()
    } else {
      await subscribe()
    }
  }

  const handlePreferenceChange = async (key: keyof NotificationPreferences, value: boolean) => {
    await updatePreferences({ [key]: value })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔔</span>
          <div>
            <h3 className="font-medium text-gray-900">Notificaciones</h3>
            <p className="text-sm text-gray-500">
              {isSubscribed 
                ? 'Recibiendo alertas del club' 
                : 'Activa para recibir alertas'}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={isLoading}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${isSubscribed ? 'bg-blue-600' : 'bg-gray-200'}
            ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${isSubscribed ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {isSubscribed && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Tipos de notificaciones</h4>
          
          <div className="space-y-2">
            <PreferenceToggle
              label="🏑 Goles en vivo"
              description="Alertas cuando tu equipo marque"
              checked={preferences.goals}
              onChange={(v) => handlePreferenceChange('goals', v)}
            />
            <PreferenceToggle
              label="📢 Convocatorias"
              description="Nuevas convocatorias de partidos"
              checked={preferences.convocations}
              onChange={(v) => handlePreferenceChange('convocations', v)}
            />
            <PreferenceToggle
              label="🏋️ Entrenamientos"
              description="Recordatorios de entrenamientos"
              checked={preferences.training}
              onChange={(v) => handlePreferenceChange('training', v)}
            />
            <PreferenceToggle
              label="📍 Cambios de partido"
              description="Cambios de hora, campo u horarios"
              checked={preferences.matchChanges}
              onChange={(v) => handlePreferenceChange('matchChanges', v)}
            />
            <PreferenceToggle
              label="🎟️ Lotería"
              description="Sorteos y venta de papeletas"
              checked={preferences.lottery}
              onChange={(v) => handlePreferenceChange('lottery', v)}
            />
          </div>
        </div>
      )}

      {onShowSettings && (
        <button
          onClick={onShowSettings}
          className="w-full py-2 px-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Configuración avanzada →
        </button>
      )}
    </div>
  )
}

interface PreferenceToggleProps {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}

function PreferenceToggle({ label, description, checked, onChange }: PreferenceToggleProps) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <div>
        <span className="text-sm font-medium text-gray-900">{label}</span>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
      />
    </label>
  )
}
