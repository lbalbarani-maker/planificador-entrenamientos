import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  KeepAliveResult,
  KeepAliveSource,
  KeepAliveStatus,
} from '../types/monitoring';

export type {
  CronRun,
  KeepAliveResult,
  KeepAliveSource,
  KeepAliveStatus,
} from '../types/monitoring';

// Lectura de actividad: tabla ligera, pública y sin datos personales.
const ACTIVITY_TABLE = 'teams';

/**
 * Realiza una lectura real contra Supabase y registra el heartbeat en `cron_runs`.
 * Recibe el cliente para poder reutilizarse desde el navegador (cliente Vite con
 * `import.meta.env`) y desde la función serverless de Vercel (`process.env`).
 *
 * Si el heartbeat falla pero la lectura fue correcta, devuelve `ok: true`: el
 * mantenimiento se cumplió y el fallo solo se registra en el log.
 */
export async function runKeepAlive(
  client: SupabaseClient,
  source: KeepAliveSource,
): Promise<KeepAliveResult> {
  let status: KeepAliveStatus = 'ok';
  let detail: string | null = null;

  const { error } = await client.from(ACTIVITY_TABLE).select('id').limit(1);

  if (error) {
    status = 'error';
    detail = `${error.code ?? 'sin-codigo'}: ${error.message}`;
  }

  const { error: heartbeatError } = await client
    .from('cron_runs')
    .insert({ status, source, detail });

  if (heartbeatError) {
    console.error(
      `[keep-alive] No se pudo registrar el heartbeat: ${heartbeatError.code ?? 'sin-codigo'} - ${heartbeatError.message}`,
    );
  }

  return { ok: status === 'ok', detail };
}

/**
 * Formatea una fecha ISO en `dd/mm/aaaa hh:mm` interpretándola como UTC.
 */
export function formatDateTimeUTC(dateStr: string): string {
  const normalized = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : `${dateStr}Z`;
  const d = new Date(normalized);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
