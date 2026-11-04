import { useCallback, useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import { supabase } from '../lib/supabase';
import { runKeepAlive, formatDateTimeUTC } from '../lib/keepAlive';
import type { CronRun, KeepAliveStatus } from '../types/monitoring';

const hasRole = (roleString: string | undefined, role: string): boolean => {
  if (!roleString) return false;
  return roleString.split(',').includes(role);
};

interface Feedback {
  success: boolean;
  text: string;
}

function StatusBadge({ status }: { status: KeepAliveStatus }) {
  const ok = status === 'ok';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
        ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      <span>{ok ? '✅' : '❌'}</span>
      {ok ? 'OK' : 'Error'}
    </span>
  );
}

export function ConfigurationPage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = hasRole(user.role, 'admin');

  const [lastCron, setLastCron] = useState<CronRun | null>(null);
  const [lastManual, setLastManual] = useState<CronRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    const [cronRes, manualRes] = await Promise.all([
      supabase
        .from('cron_runs')
        .select('*')
        .eq('source', 'cron')
        .order('ran_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('cron_runs')
        .select('*')
        .eq('source', 'manual')
        .order('ran_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const error = cronRes.error ?? manualRes.error;
    setLoadError(error ? `${error.code ?? 'sin-codigo'}: ${error.message}` : null);
    setLastCron((cronRes.data as CronRun | null) ?? null);
    setLastManual((manualRes.data as CronRun | null) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const handleRunNow = async () => {
    setRunning(true);
    setFeedback(null);
    try {
      const result = await runKeepAlive(supabase, 'manual');
      if (result.ok) {
        setFeedback({ success: true, text: 'Comprobación manual completada correctamente.' });
      } else {
        setFeedback({
          success: false,
          text: `La comprobación falló: ${result.detail ?? 'sin detalle'}`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error desconocido';
      setFeedback({ success: false, text: `Error inesperado: ${message}` });
    } finally {
      await loadRuns();
      setRunning(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
        <div className="text-center">
          <span className="text-5xl mb-4 block">🔒</span>
          <h2 className="text-xl font-bold text-gray-900">Acceso restringido</h2>
          <p className="text-gray-500 mt-2">Solo administradores pueden acceder</p>
        </div>
      </div>
    );
  }

  const latest =
    [lastCron, lastManual]
      .filter((run): run is CronRun => run !== null)
      .sort((a, b) => new Date(b.ran_at).getTime() - new Date(a.ran_at).getTime())[0] ?? null;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <BackButton to="/dashboard" />

        <div className="mb-6 mt-4">
          <h1 className="text-3xl font-bold text-sanse-blue">⚙️ Configuración</h1>
          <p className="text-gray-500 mt-1">Ajustes y mantenimiento de la aplicación</p>
        </div>

        <section className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Mantenimiento</h2>
            <p className="text-sm text-gray-500 mt-1">Cron diario de actividad en Supabase</p>
          </div>

          <div className="p-6 space-y-6">
            {feedback && (
              <div
                className={`px-4 py-3 rounded-lg flex items-center gap-2 ${
                  feedback.success
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                <span>{feedback.success ? '✅' : '❌'}</span>
                <span>{feedback.text}</span>
              </div>
            )}

            {loadError && (
              <div className="px-4 py-3 rounded-lg flex items-center gap-2 bg-red-50 text-red-800 border border-red-200">
                <span>❌</span>
                <span>No se pudo consultar Supabase: {loadError}</span>
              </div>
            )}

            {loading ? (
              <div className="text-center py-6 text-gray-500">Cargando estado...</div>
            ) : (
              <>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-sm text-gray-500">Estado actual</p>
                    <div className="flex items-center gap-2 mt-1">
                      {latest ? (
                        <>
                          <StatusBadge status={latest.status} />
                          <span className="text-sm text-gray-500">
                            {latest.source === 'cron' ? '(Automática)' : '(Manual)'}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-700">
                          {loadError ? 'No disponible' : 'Sin ejecuciones aún'}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">Programado: diario ~06:00 UTC</span>
                </div>

                <div className="divide-y divide-gray-100 border-t border-gray-100">
                  <div className="py-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Última ejecución automática
                      </p>
                      {lastCron ? (
                        <>
                          <p className="text-sm text-gray-500 mt-1">
                            {formatDateTimeUTC(lastCron.ran_at)} UTC
                          </p>
                          {lastCron.status === 'error' && lastCron.detail && (
                            <p className="text-xs text-red-600 mt-1 break-all">{lastCron.detail}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 mt-1">
                          {loadError ? 'No disponible' : '—'}
                        </p>
                      )}
                    </div>
                    {lastCron && <StatusBadge status={lastCron.status} />}
                  </div>

                  <div className="py-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Última comprobación manual
                      </p>
                      {lastManual ? (
                        <>
                          <p className="text-sm text-gray-500 mt-1">
                            {formatDateTimeUTC(lastManual.ran_at)} UTC
                          </p>
                          {lastManual.status === 'error' && lastManual.detail && (
                            <p className="text-xs text-red-600 mt-1 break-all">
                              {lastManual.detail}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-gray-400 mt-1">
                          {loadError ? 'No disponible' : '—'}
                        </p>
                      )}
                    </div>
                    {lastManual && <StatusBadge status={lastManual.status} />}
                  </div>
                </div>

                <button
                  onClick={handleRunNow}
                  disabled={running}
                  className="w-full py-3 bg-sanse-blue text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {running ? 'Ejecutando...' : 'Ejecutar ahora'}
                </button>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default ConfigurationPage;
