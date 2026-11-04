import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';
import { runKeepAlive } from '../../src/lib/keepAlive';

// Vercel ejecuta esta función en Node por defecto y sin caché (respuesta dinámica).

interface CronRequest extends IncomingMessage {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

function isAuthorized(request: CronRequest, secret: string): boolean {
  const rawHeader = request.headers['authorization'];
  const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (!header) return false;
  return safeEqual(header, `Bearer ${secret}`);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export default async function handler(request: CronRequest, res: ServerResponse): Promise<void> {
  if (request.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, { ok: false });
    return;
  }

  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[cron/keep-alive] CRON_SECRET no está configurado; no se ejecuta la consulta.');
    sendJson(res, 500, { ok: false });
    return;
  }

  if (!isAuthorized(request, cronSecret)) {
    sendJson(res, 401, { ok: false });
    return;
  }

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    process.env.REACT_APP_SUPABASE_URL;
  const supabaseKey =
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.REACT_APP_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      '[cron/keep-alive] Faltan VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY; no se ejecuta la consulta.',
    );
    sendJson(res, 500, { ok: false });
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { ok, detail } = await runKeepAlive(supabase, 'cron');

    if (!ok) {
      console.error(`[cron/keep-alive] Error de Supabase: ${detail ?? 'sin detalle'}`);
      sendJson(res, 502, { ok: false });
      return;
    }

    console.log('[cron/keep-alive] Consulta de actividad completada correctamente.');
    sendJson(res, 200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error desconocido';
    console.error(`[cron/keep-alive] Error inesperado al consultar Supabase: ${message}`);
    sendJson(res, 502, { ok: false });
  }
}
