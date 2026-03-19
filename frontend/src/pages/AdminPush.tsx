import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { sendPushNotification } from '../lib/pushNotifications'

interface Team {
  id: string
  name: string
  category: string
}

interface NotificationLog {
  id: string
  type: string
  title: string
  body: string
  sent_count: number
  click_count: number
  created_at: string
}

interface Sponsor {
  id: string
  name: string
}

export function AdminPushPage() {
  const [form, setForm] = useState({
    type: 'announcement',
    title: '',
    body: '',
    teamIds: [] as string[],
    sponsorId: null as string | null,
    deepLink: ''
  })
  const [teams, setTeams] = useState<Team[]>([])
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [isSending, setIsSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  async function checkAdminAndLoad() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role === 'admin' || profile?.role === 'staff') {
      setIsAdmin(true)
      loadData()
    }
  }

  async function loadData() {
    const [teamsRes, sponsorsRes, logsRes] = await Promise.all([
      supabase.from('teams').select('id, name, category'),
      supabase.from('sponsors').select('id, name'),
      supabase.from('notifications_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
    ])

    if (teamsRes.data) setTeams(teamsRes.data)
    if (sponsorsRes.data) setSponsors(sponsorsRes.data)
    if (logsRes.data) setLogs(logsRes.data)
  }

  const handleSend = async () => {
    if (!form.title || !form.body) {
      setResult({ success: false, message: 'Completa el título y mensaje' })
      return
    }

    setIsSending(true)
    setResult(null)

    try {
      const response = await sendPushNotification({
        type: form.type,
        title: form.title,
        body: form.body,
        data: {
          deepLink: form.deepLink,
          sentBy: 'admin'
        },
        teamIds: form.teamIds,
        sponsorId: form.sponsorId || undefined
      })

      if (response.success) {
        setResult({ 
          success: true, 
          message: `¡Notificación enviada a ${response.sent} usuarios!` 
        })
        setForm({ type: 'announcement', title: '', body: '', teamIds: [], sponsorId: null, deepLink: '' })
        loadData()
      } else {
        setResult({ success: false, message: 'Error al enviar' })
      }
    } catch {
      setResult({ success: false, message: 'Error de conexión' })
    } finally {
      setIsSending(false)
    }
  }

  const handleTeamToggle = (teamId: string) => {
    setForm(prev => ({
      ...prev,
      teamIds: prev.teamIds.includes(teamId)
        ? prev.teamIds.filter(id => id !== teamId)
        : [...prev.teamIds, teamId]
    }))
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <span className="text-5xl mb-4 block">🔒</span>
          <h2 className="text-xl font-bold text-gray-900">Acceso restringido</h2>
          <p className="text-gray-500 mt-2">Solo administradores pueden acceder</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-blue-900 text-white px-6 py-8">
        <h1 className="text-2xl font-bold">Enviar Notificaciones</h1>
        <p className="text-blue-200 mt-1">Llega directamente a padres y jugadores</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {result && (
          <div className={`px-4 py-3 rounded-lg flex items-center gap-2 ${
            result.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <span>{result.success ? '✅' : '❌'}</span>
            <span>{result.message}</span>
          </div>
        )}

        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Nueva notificación</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm(prev => ({ ...prev, type: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="announcement">📢 Anuncio general</option>
                <option value="goal">🏑 Gol en vivo</option>
                <option value="convocation">📅 Nueva convocatoria</option>
                <option value="match_change">📍 Cambio de partido</option>
                <option value="training">🏋️ Entrenamiento</option>
                <option value="lottery">🎟️ Lotería</option>
                <option value="sponsored">💰 Patrocinada</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Título *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ej: ¡Victoria del Complu!"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mensaje *</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm(prev => ({ ...prev, body: e.target.value }))}
                placeholder="Escribe el mensaje que recibirán los usuarios..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={300}
              />
              <p className="text-xs text-gray-500 mt-1">{form.body.length}/300 caracteres</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Equipos (opcional)</label>
              <p className="text-xs text-gray-500 mb-2">Deja vacío para enviar a todos</p>
              <div className="flex flex-wrap gap-2">
                {teams.map(team => (
                  <button
                    key={team.id}
                    onClick={() => handleTeamToggle(team.id)}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                      form.teamIds.includes(team.id)
                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            </div>

            {form.type === 'sponsored' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Patrocinador</label>
                <select
                  value={form.sponsorId || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, sponsorId: e.target.value || null }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Seleccionar patrocinador</option>
                  {sponsors.map(sponsor => (
                    <option key={sponsor.id} value={sponsor.id}>{sponsor.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Deep Link (opcional)</label>
              <input
                type="text"
                value={form.deepLink}
                onChange={(e) => setForm(prev => ({ ...prev, deepLink: e.target.value }))}
                placeholder="/match/123/watch"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <button
              onClick={handleSend}
              disabled={isSending || !form.title || !form.body}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSending ? 'Enviando...' : '📤 Enviar notificación'}
            </button>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Historial</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {logs.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No hay notificaciones enviadas
              </div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{log.title}</p>
                      <p className="text-sm text-gray-500 mt-1">{log.body}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span>{new Date(log.created_at).toLocaleString('es-ES')}</span>
                        <span className="px-2 py-0.5 bg-gray-100 rounded">{log.type}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-600">📤 {log.sent_count}</p>
                      <p className="text-xs text-gray-400">CTR: {log.sent_count > 0 ? ((log.click_count / log.sent_count) * 100).toFixed(1) : 0}%</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
