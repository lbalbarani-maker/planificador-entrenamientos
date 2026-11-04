# DEC-006 — Keep-alive de Supabase con endpoint interno autenticado y heartbeat append-only

## Contexto

El proyecto de Supabase está en el plan gratuito, que pausa la instancia tras un periodo de inactividad. Existía una primera aproximación (`frontend/api/keep-alive.js`) que consultaba la tabla `users`, sin autenticación, usando variables `REACT_APP_*` (que Vite no expone) y sin registrar las ejecuciones ni ofrecer panel.

Se necesita un mecanismo fiable, visible y auditable, sin permisos elevados.

## Decisión

- **Endpoint interno** `GET /api/cron/keep-alive` (función serverless de Vercel en `frontend/api/cron/keep-alive.ts`), protegido por `CRON_SECRET` comparado en tiempo constante (`node:crypto` `timingSafeEqual`). Códigos: `500` sin secreto, `401` sin/erróneo header, `502` error de Supabase, `200 {"ok":true}` en éxito.
- **Cron diario** en `frontend/vercel.json` (`schedule: "0 6 * * *"`, 06:00 UTC). Vercel inyecta `Authorization: Bearer ${CRON_SECRET}` en las invocaciones.
- **Tabla de heartbeat `cron_runs`** (`id`, `ran_at`, `status`, `source`, `detail`), con **RLS activo únicamente en esta tabla** y solo dos políticas para el rol `anon`: `SELECT` e `INSERT` (sin `UPDATE` ni `DELETE`) → historial **append-only**.
- **Clave pública (anon)** en todo momento; nunca `service_role`.
- **Helper compartido** `src/lib/keepAlive.ts` (`runKeepAlive(client, source)`) reutilizado por el endpoint (servidor) y por el botón manual (cliente). La lectura de actividad usa la tabla ligera y sin datos personales `teams`.
- **Panel "Configuración > Mantenimiento"** (`/configuracion`, solo admin) con estado, última ejecución automática y manual (fecha UTC + `OK`/`Error`), `detail` de error y botón "Ejecutar ahora".

## Motivo

- Evitar la pausa del free tier sin introducir credenciales privilegiadas.
- Mantener la superficie de seguridad mínima: una tabla aislada con políticas de solo lectura/inserción, sin exponer secretos al cliente.
- Dar trazabilidad (heartbeat) y visibilidad (panel) del mantenimiento, alineado con el patrón de secciones admin existente (`hasRole(user.role, 'admin')`).

## Consecuencias

- **Positivo**: mantenimiento fiable, auditable y sin `service_role`; sin dependencias nuevas.
- **Negativo / riesgos**:
  - El historial es inmutable por diseño (no se puede limpiar desde el cliente; requiere SQL).
  - El cron corre solo en producción; no se puede verificar en local.
  - El helper depende del cliente Supabase inyectado porque cliente (Vite `import.meta.env`) y servidor (`process.env`) usan fuentes de entorno distintas.
  - La sección admin depende del guard de sesión del frontend (auth custom en `localStorage`), sin RLS por rol (ver DEC-005).

## Estado

Aceptada.
