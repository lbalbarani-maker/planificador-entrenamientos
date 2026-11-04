# DEC-001 — Supabase como backend (con autenticación custom en `profiles`)

## Contexto

La app necesita una base de datos PostgreSQL gestionada, almacenamiento de imágenes, Realtime para el seguimiento en vivo y envío de push notifications, sin operar servidores propios. El proyecto comenzó con una base de datos PostgreSQL alojada en Supabase (`rtyxufscynjpxuliwlpm.supabase.co`) accedida desde el frontend con el cliente `@supabase/supabase-js` (anon key).

## Decisión

- **Supabase** como backend único: Postgres + Realtime + Storage + Edge Functions.
- La autenticación de la app es un **sistema custom** basado en filas de la tabla `profiles` (email + contraseña con hash JS `simpleHash` + PIN opcional), con sesión en `localStorage['user']`. **No** se utiliza `supabase.auth` para el login principal.
- El manejo de notificaciones usa **una edge function** (`send-push`) y tablas de push (`push_subscriptions`, `notifications_log`, `notification_clicks`).

## Motivo

- Desarrollo rápido sin infraestructura propia.
- Postgres + Realtime del mismo proveedor simplifican el seguimiento en vivo.
- El sistema custom de `profiles` era el flujo ya existente y operativo del club, sin incurrir en configuración adicional de Supabase Auth.

## Consecuencias

- **Positivo**: un solo backend; facilidad de deploy; Realtime y Storage integrados.
- **Negativo / riesgos**:
  - `profiles.password`/`profiles.pin` con hash débil y comparación en claro: seguridad deficiente.
  - Sesión en `localStorage` (expuesta a XSS) y sin tokens reales.
  - Discrepancia con el subsistema de push, que intenta usar `supabase.auth.getSession` (sesión que el login custom nunca crea).
  - Dependencia del plan gratuito (mitigada con cron keep-alive, ver DEC-002).

## Estado

Aceptada. Revisar en el futuro migrando a Supabase Auth real (ver `docs/specs/users-and-roles.md` → Futuras extensiones).