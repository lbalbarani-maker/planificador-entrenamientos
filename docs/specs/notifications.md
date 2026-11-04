# Notifications (Notificaciones push)

## Objetivo

Notificar a usuarios del club (goles, convocatorias, entrenamientos, cambios de partido, anuncios, loterías) mediante Web Push, con panel de envío para el staff y preferencias por usuario.

## Usuarios implicados

- **Admin/staff**: envío desde `/admin/push`.
- **Usuarios suscritos**: reciben notificaciones y configuran preferencias en `/settings/notifications`.

## Comportamiento actual

### Suscripción (frontend)
- `pushNotifications.ts`: `requestPushPermission`, `subscribeToPush` (upsert en `push_subscriptions` con `onConflict 'user_id,endpoint'`), `unsubscribeFromPush` (`is_active:false`), `updatePushPreferences`, `checkSubscriptionStatus`.
- `usePushNotifications.ts`: estado de permiso/soporte/suscripción/preferencias (goals, convocations, training, matchChanges, lottery).
- `NotificationSettings.tsx` (/settings/notifications): activar/desactivar y preferencias; muestra `PushPermissionPrompt`.
- `NotificationToggle` está implementado pero **no se usa** en ninguna pantalla.

### Envío (edge function)
- `send-push` (`supabase/functions/send-push/index.ts`): valida token (`auth.getUser`) y rol en `profiles` (admin/staff); consulta `push_subscriptions` activas filtradas por `club_id`, `overlaps(team_ids)` y `exclude_user_id`; envía con VAPID por fetch directo; limpia endpoints 404/410; escribe `notifications_log` con `sent_count`.
- `AdminPush.tsx` (/admin/push): formulario de envío (tipo, título, mensaje, equipos, sponsor, deep link) y listado del histórico con CTR (`click_count/sent_count*100`).

### Registro y tracking
- `notifications_log` (envíos) y `notification_clicks` (clics) con trigger que incrementa `click_count`.
- El `src/sw.ts` declara handlers `push`/`notificationclick`/`notificationclose`, **pero no llegan al SW desplegado** (se usa `generateSW`, no `injectManifest`).

### Automatización por gol
- Migración `003_trigger_goal_notifications.sql`: trigger `on_goal_created` en `hockey_goals` que construye el payload y llama a la edge function vía `net.http_post` (requiere `pg_net` y settings `app.settings.push_function_url`/`service_role_key`). **Inconsistente** con el esquema actual (columnas no verificadas) y con la autorización de la función (bearer con service role vs exigencia de token de usuario).

## Reglas de negocio

- Los suscriptores se filtran por `club_id` y por `team_ids[]` cuando el envío lo indica.
- El emisor se excluye a sí mismo (`exclude_user_id`).
- Endpoints que devuelven 404/410 se eliminan de `push_subscriptions`.
- Solo token con rol `admin`/`staff` puede invocar `send-push` (en frontend, `App.tsx` solo permite `admin` en `/admin/push`).

## Datos implicados

- `push_subscriptions` (user_id, endpoint, p256dh, auth, club_id, team_ids[], notification_types[], is_active).
- `notifications_log` (type, title, body, data, club_id, team_ids[], sent_count, click_count, sponsor_id, created_by).
- `notification_clicks`.
- `profiles` (para validación de rol en la edge function).

## Permisos

- Frontend: `/admin/push` requiere `hasRole(user.role, 'admin')`.
- Edge function: `admin` o `staff`.
- Suscripción: cualquier usuario con sesión de Supabase Auth.

## Integraciones

- Edge function `send-push` (Web Push + VAPID).
- Trigger de goles (`003`).
- Panel de admin y página de preferencias.
- PWA/service worker (crítico: ver `pwa.md`).

## Estado

**Parcial.** Implementado: suscripción, envío, panel, prefs y tracking. **No operativo o inconsistente**:
1. La visualización de push en el navegador depende del SW generado, que **no incluye** los handlers de `src/sw.ts`.
2. El login custom no crea sesión de Supabase Auth, que el subsistema push intenta usar (`auth.getSession`).
3. Trigger 003 inconsistente con el esquema y con la autorización de la edge function.

## Futuras extensiones

- Migrar handlers push a `injectManifest` y corregir el SW.
- Unificar la sesión (Supabase Auth) para alinear login y push.
- Corregir o eliminar el trigger 003 (o adaptarlo al esquema real).
- Envío programado/segmentado por categoría de evento.