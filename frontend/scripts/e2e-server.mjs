import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env.test.local');
const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'LOTTERY_ADMIN_TOKEN_SECRET',
];

if (!existsSync(envPath)) {
  console.error(
    `[e2e] Falta ${envPath}. Crea ese archivo con las variables del Supabase de pruebas antes de lanzar Playwright.`,
  );
  process.exit(1);
}

function parseEnv(contents) {
  const result = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const commentIndex = value.indexOf(' #');
      if (commentIndex >= 0) value = value.slice(0, commentIndex).trim();
    }

    result[match[1]] = value;
  }

  return result;
}

const testEnv = parseEnv(readFileSync(envPath, 'utf8'));
const missing = required.filter((key) => !testEnv[key]);

if (missing.length > 0) {
  console.error(`[e2e] Faltan variables en .env.test.local: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('[e2e] Arrancando vercel dev en http://127.0.0.1:3100');

const child = spawn(
  'npx',
  ['vercel', 'dev', '--listen', '127.0.0.1:3100', '--yes'],
  {
    cwd: root,
    env: {
      ...process.env,
      ...testEnv,
      BROWSER: 'none',
    },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
);

const stop = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
