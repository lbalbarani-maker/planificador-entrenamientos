const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

const TOKEN_TTL_SECONDS = 60 * 60 * 8;

function supabaseUrl() {
  return (
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    process.env.REACT_APP_SUPABASE_URL
  );
}

function serviceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function adminSecret() {
  return process.env.LOTTERY_ADMIN_TOKEN_SECRET;
}

function adminClient() {
  const url = supabaseUrl();
  const key = serviceRoleKey();
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readJson(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body);
    } catch {
      return {};
    }
  }

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

function simpleHash(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }
  return Math.abs(hash).toString(16);
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function isAdminProfile(profile) {
  const roles = String(profile.role ?? '')
    .split(',')
    .map((role) => role.trim());
  return (
    Boolean(profile.is_super_admin) ||
    Boolean(profile.is_club_admin) ||
    roles.includes('admin')
  );
}

function signAdminToken(profile) {
  const secret = adminSecret();
  if (!secret) throw new Error('LOTTERY_ADMIN_TOKEN_SECRET no está configurado');

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: profile.id,
    role: profile.role,
    club_id: profile.club_id,
    name: profile.full_name,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const encoded = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return { token: `${encoded}.${signature}`, payload };
}

function verifyAdminToken(token) {
  if (!token || !token.includes('.')) return null;
  const secret = adminSecret();
  if (!secret) return null;

  const [encoded, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  const provided = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (provided.length !== wanted.length || !crypto.timingSafeEqual(provided, wanted)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload?.sub || !payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function bearerToken(request) {
  const header = request.headers.authorization;
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw || !raw.startsWith('Bearer ')) return null;
  return raw.slice(7).trim();
}

async function requireAdmin(request, res) {
  const payload = verifyAdminToken(bearerToken(request));
  if (!payload) {
    sendJson(res, 401, { error: 'Sesión de administración caducada. Vuelve a iniciar sesión.' });
    return null;
  }
  return payload;
}

async function findAdminProfile(email, password, pin) {
  const client = adminClient();
  const normalizedEmail = String(email ?? '').trim();
  if (!normalizedEmail) return null;

  const { data, error } = await client
    .from('profiles')
    .select(
      'id,email,full_name,role,password,pin,is_active,club_id,is_super_admin,is_club_admin',
    )
    .ilike('email', normalizedEmail)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!data || !isAdminProfile(data)) return null;

  if (password) {
    const passwordHash = simpleHash(String(password));
    if (data.password !== passwordHash && data.password !== String(password)) return null;
  } else if (pin) {
    if (data.pin !== simpleHash(String(pin))) return null;
  } else {
    return null;
  }

  return data;
}

module.exports = {
  TOKEN_TTL_SECONDS,
  adminClient,
  findAdminProfile,
  isAdminProfile,
  readJson,
  requireAdmin,
  sendJson,
  signAdminToken,
  simpleHash,
  supabaseUrl,
};
