import { useState } from 'react'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { PushPermissionPrompt } from '../components/notifications/PushPermissionPrompt'

export function NotificationSettingsPage() {
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

  const [showSuccess, setShowSuccess] = useState(false)

  const handleSubscribe = async () => {
    const success = await subscribe()
    if (success) {
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    }
  }

  const handlePreferenceChange = async (key: string, value: boolean) => {
    await updatePreferences({ [key]: value })
  }

  const notificationTypes = [
    { key: 'goals', icon: '🏑', label: 'Goles en vivo', description: 'Alertas instantáneas cuando tu equipo marque' },
    { key: 'convocations', icon: '📢', label: 'Convocatorias', description: 'Nuevas convocatorias de partidos y entrenamientos' },
    { key: 'training', icon: '🏋️', label: 'Entrenamientos', description: 'Recordatorios de sesiones de entrenamiento' },
    { key: 'matchChanges', icon: '📍', label: 'Cambios de partido', description: 'Cambios de hora, campo u horarios' },
    { key: 'lottery', icon: '🎟️', label: 'Lotería', description: 'Sorteos y nuevas papeletas disponibles' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-blue-900 text-white px-6 py-8">
        <h1 className="text-2xl font-bold">Notificaciones</h1>
        <p className="text-blue-200 mt-1">Configura cómo quieres recibir alertas</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {showSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
            <span>✅</span>
            <span>¡Notificaciones activadas!</span>
          </div>
        )}

        {!isSupported && (
          <div className="bg-yellow-50 border border-yellow-200 px-4 py-3 rounded-lg">
            <p className="text-yellow-800">
              Tu navegador no soporta notificaciones push. Prueba con Chrome o Safari.
            </p>
          </div>
        )}

        {permission === 'denied' && (
          <div className="bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
            <p className="text-red-800">
              Las notificaciones están bloqueadas. Habilítalas en la configuración de tu navegador para recibir alertas.
            </p>
          </div>
        )}

        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Estado</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  isSubscribed ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <span className="text-2xl">{isSubscribed ? '🔔' : '🔕'}</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {isSubscribed ? 'Notificaciones activas' : 'Notificaciones desactivadas'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {permission === 'default' 
                      ? 'Pulsa el botón para activar' 
                      : `Permiso: ${permission}`}
                  </p>
                </div>
              </div>
              
              {isSubscribed ? (
                <button
                  onClick={unsubscribe}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Desactivar
                </button>
              ) : (
                <button
                  onClick={handleSubscribe}
                  disabled={isLoading || !isSupported || permission === 'denied'}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Activando...' : 'Activar'}
                </button>
              )}
            </div>
          </div>
        </section>

        {isSubscribed && (
          <section className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Tipos de notificaciones</h2>
              <p className="text-sm text-gray-500 mt-1">
                Selecciona qué alertas quieres recibir
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {notificationTypes.map(({ key, icon, label, description }) => (
                <div key={key} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <p className="font-medium text-gray-900">{label}</p>
                      <p className="text-sm text-gray-500">{description}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences[key as keyof typeof preferences]}
                      onChange={(e) => handlePreferenceChange(key, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </section>
        )}

        {!isSubscribed && isSupported && permission !== 'denied' && (
          <section className="mt-8">
            <PushPermissionPrompt
              variant="card"
              title="Activa las notificaciones"
              description="No te pierdas ningún partido, goles en tiempo real y convocatorias importantes."
            />
          </section>
        )}

        <section className="bg-gray-100 rounded-xl p-6">
          <h3 className="font-medium text-gray-900 mb-2">💡 Tips</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Solo recibirás notificaciones si tienes la app instalada</li>
            <li>• Puedes cambiar estos ajustes en cualquier momento</li>
            <li>• No te preocupes, no enviaremos spam</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
