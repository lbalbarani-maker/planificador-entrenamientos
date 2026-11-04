# DEC-003 — PWA con vite-plugin-pwa (generateSW / autoUpdate)

## Contexto

La mayoría de usuarios accede desde el móvil; la app debe poder instalarse en la pantalla de inicio y funcionar con conexión inestable. La actualización de versiones debe llegar sin intervención del usuario.

## Decisión

- Usar **`vite-plugin-pwa`** con:
  - Modo **`generateSW`** (Workbox genera el service worker desde la configuración).
  - **`registerType: 'autoUpdate'`** con `skipWaiting` + `clientsClaim`.
  - Manifest inline (nombre «Sanse Complu Hockey App», short_name «Sanse Complu», `standalone`, tema `#0A1F44`).
  - Estrategias de cache: NetworkFirst para navegación, StaleWhileRevalidate para la API REST de Supabase, CacheFirst para imágenes de storage y fuentes.
- Registro del SW con `virtual:pwa-register` en `main.tsx` + banners globales (`UpdateBanner`, `InstallPromptBanner`, `OfflineBanner`) montados en `App.tsx`.

## Motivo

- Mínima configuración; Workbox genera precache y caches de runtime fiables.
- `autoUpdate` asegura que los usuarios siempre ejecuten la última versión sin fricción (relevante para un club).
- La estrategia de cache (offline de shell + API) cubre el caso de conexión móvil inestable.

## Consecuencias

- **Positivo**: instalable, detección de actualización con modal, offline parcial, sin SWM manual.
- **Negativo / riesgos**:
  - `generateSW` **ignora `src/sw.ts`**: los handlers custom de push (`push`, `notificationclick`) no llegan al SW desplegado → las **notificaciones push no se muestran** (remitir a `docs/specs/notifications.md` y `docs/specs/pwa.md`).
  - Doble manifest (inline + `public/manifest.json`).
  - `dev-dist/` commiteado como artefacto.

## Estado

Aceptada. La corrección de push es una decisión futura pendiente (migrar a `injectManifest` o mover handlers al plugin).