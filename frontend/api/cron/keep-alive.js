const { timingSafeEqual } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

const ACTIVITY_TABLE = 'teams';

function safeEqual(a, b) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

function isAuthorized(request, secret) {
  const rawHeader = request.headers.authorization;
  const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (!header) return false;
  return safeEqual(header, `Bearer ${secret}`);
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function runKeepAlive(client, source) {
  let status = 'ok';
  let detail = null;

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

module.exports = async function handler(request, res) {
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
};
