# Spec — Configuración · Mantenimiento (keep-alive de Supabase)

## Objetivo

Evitar que el proyecto de Supabase (plan Free) se pause por inactividad mediante una lectura real y ligera diaria, registrando cada ejecución (automática o manual) y ofreciendo un panel para consultar el estado y lanzarla a mano.

## Usuarios implicados

- **Administradores** (`role` contiene `admin`): únicos con acceso a la sección `Configuración`.
- **Sistema (Vercel Cron)**: invoca el endpoint una vez al día en producción, autenticado con `CRON_SECRET`.

## Comportamiento actual

### Cron diario (producción)

- `frontend/vercel.json` programa `GET /api/cron/keep-alive` con `schedule: "0 6 * * *"` (06:00 UTC, una vez al día).
- La función serverless `frontend/api/cron/keep-alive.js` (runtime Node, sin caché):
  - Sin `CRON_SECRET` configurado → `500 { ok: false }` y **no** consulta.
  - Header `Authorization` ausente o distinto de `Bearer ${CRON_SECRET}` → `401 { ok: false }` y **no** consulta. La comparación es de tiempo constante (`node:crypto` `timingSafeEqual`, con chequeo previo de longitudes).
  - Éxito → `200 { ok: true }`.
  - Error de la consulta a Supabase (o error inesperado) → `502 { ok: false }`.
  - Solo registra en logs el éxito o el código/mensaje de error. Nunca el secreto.
- Vercel inyecta automáticamente `Authorization: Bearer ${CRON_SECRET}` en las invocaciones del cron si esa variable existe.

### Lectura y heartbeat (panel y cron)

La lógica es la misma en ambos lados:

1. Hace una lectura real y ligera: `teams.select('id').limit(1)` (tabla pública, sin datos personales, con `SELECT` permitido a `anon`).
2. Inserta un heartbeat en `cron_runs` con `{ status, source, detail }`.
3. Regla: si el heartbeat falla pero la lectura fue correcta, devuelve `ok: true`; el fallo solo se registra en el log (el mantenimiento se cumplió).

`frontend/src/lib/keepAlive.ts` exporta `runKeepAlive(client, source)` y lo usa el panel (cliente Vite con `import.meta.env`, botón manual). La función serverless no puede importar ESM desde el runtime CommonJS de Vercel, así que incluye una implementación inline equivalente que recibe las variables `process.env`.

### Panel "Configuración > Mantenimiento"

`frontend/src/pages/Configuration.tsx` (ruta `/configuracion`, solo admin):

- Dos lecturas independientes (la más reciente por origen):
  - `cron_runs` con `source = 'cron'`, `order(ran_at desc).limit(1).maybeSingle()`.
  - `cron_runs` con `source = 'manual'`, `order(ran_at desc).limit(1).maybeSingle()`.
- Muestra:
  - **Estado**: `OK` (verde) / `Error` (rojo) de la **última ejecución más reciente** (automática o manual), con etiqueta `(Automática)` o `(Manual)`; si no hay ninguna: "Sin ejecuciones aún".
  - **Última ejecución automática** y **Última comprobación manual**: `dd/mm/aaaa hh:mm UTC` + su propio `OK`/`Error` (o `—`).
  - El `detail` del error cuando la ejecución correspondiente falló.
  - Texto "Programado: diario ~06:00 UTC".
  - Estado de carga mientras se leen las filas.
- Botón **"Ejecutar ahora"**: llama a `runKeepAlive(supabase, 'manual')` directamente desde el cliente (sin endpoint nuevo), muestra un banner de éxito/error y refresca la tarjeta.

## Reglas de negocio

- Formato de fecha en **UTC** mediante `formatDateTimeUTC` (getters UTC de `Date`, sin librerías): `dd/mm/aaaa hh:mm`.
- `cron_runs` es **append-only**: solo existen políticas de `SELECT` e `INSERT`. No hay `UPDATE` ni `DELETE`.
- Cada ejecución autorizada inserta **una** fila con `status` (`ok`/`error`) y `source` (`cron`/`manual`) coherentes.
- Un fallo del heartbeat no altera el resultado de la lectura.

## Datos implicados

| Tabla | Uso |
|---|---|
| `cron_runs` | Historial de ejecuciones: `id`, `ran_at`, `status` (`ok`/`error`), `source` (`cron`/`manual`), `detail`. RLS activo con `SELECT`/`INSERT` para `anon`. Índice `idx_cron_runs_ran_at (ran_at desc)`. |
| `teams` | Tabla leída para demostrar actividad real de la base de datos (ligera, sin datos personales). |

SQL de creación: `scripts/phase5-cron-heartbeat.sql` (se ejecuta manualmente en el Supabase SQL Editor).

## Permisos

- **Sección `/configuracion`**: solo `admin`, con el mismo patrón que el resto de secciones admin (`hasRole(user.role, 'admin')` en `App.tsx` y entrada de navegación filtrada en `Dashboard.tsx`).
- **Endpoint `/api/cron/keep-alive`**: protegido por `CRON_SECRET` (comparación de tiempo constante en el servidor).
- **Base de datos**: se usa exclusivamente la clave **pública (anon)**. No se usa `service_role`.

## Integraciones

- **Vercel**: hosting + cron diario (`frontend/vercel.json`).
- **Supabase**: Postgres (`cron_runs`, `teams`) vía `@supabase/supabase-js` con `anon key`.

## Variables de entorno

- `CRON_SECRET`: secreto de servidor (sin prefijo `NEXT_PUBLIC_`/`VITE_`). Se configura en Vercel y en local. Nunca se imprime en logs ni respuestas.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`: cliente del navegador y (con fallback a `SUPABASE_*`/`REACT_APP_SUPABASE_*`) cliente de la función serverless.

## Estado

Implementado y desplegado en producción (commits `cd82113` y `6c4dc06`). Verificado el 2026-11-04: `401` sin header o con secreto incorrecto, `200 {"ok":true}` con `Bearer ${CRON_SECRET}`, filas nuevas en `cron_runs` con `source='cron'` y `status='ok'`; `vercel crons list` confirma el schedule `0 6 * * *`, y `vercel crons run /api/cron/keep-alive` invocó el cron real con `200` y heartbeat correcto. Queda observar la primera ejecución automática en la próxima ventana diaria (06:00 UTC).

## Cómo probar en local

1. Ejecutar `scripts/phase5-cron-heartbeat.sql` en el SQL Editor de Supabase.
2. Definir `CRON_SECRET` en `frontend/.env.local` (ignorado por Git) y en Vercel.
3. Levantar el proyecto y probar la función:
   - Sin header → `401`; header incorrecto → `401`; sin `CRON_SECRET` → `500`; Supabase inválido → `502`; éxito → `200 {"ok":true}`.
4. En la UI: `/configuracion` → "Ejecutar ahora" registra `source='manual'` y actualiza estado/fechas.

## Futuras extensiones

- Historial detallado (paginado) de `cron_runs` en el panel.
- Alertas si no hay ejecución automática en las últimas 48 h.
