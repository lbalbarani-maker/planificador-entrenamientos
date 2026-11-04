# PWA (Progressive Web App)

## Objetivo

Distribuir la app como instalable y usable offline desde el móvil (muchos usuarios acceden solo desde el teléfono), con actualización de versión y banner de instalación.

## Usuarios implicados

- **Todos los usuarios** del club y público (instalación desde el navegador móvil).
- **Desarrolladores**: mantener el service worker y las estrategias de cache.

## Comportamiento actual

### Configuración
- `vite.config.ts` con `VitePWA`:
  - `registerType: 'autoUpdate'`, `generateSW` (no injectManifest).
  - `workbox`: `skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches`, precache de `**/*.{js,css,html,ico,png,svg,woff2}` ≤ 3 MB.
  - `runtimeCaching`:
    - Navegación (`request.mode === 'navigate'`) → **NetworkFirst** (`html-cache`, 10 entradas, 1 día).
    - API Supabase (`rest/v1/*`) → **StaleWhileRevalidate** (`api-cache`, 100, 1 día).
    - Imágenes storage (`storage/v1/object/*`) → **CacheFirst** (`images-cache`, 50, 7 días).
    - Fuentes Google → CacheFirst (365 días).
  - `devOptions.enabled: true` (SW activo en desarrollo).
- **Manifest**: nombre «Sanse Complu Hockey App», short_name «Sanse Complu», `standalone`, tema `#0A1F44`, iconos 192/512, shortcuts a `/match` y `/my-convocations`. Existe también `public/manifest.json` estático (**doble manifest**).
- `index.html`: enlaza `<link rel="manifest">`, meta de iOS y theme-color.

### Registro y ciclo de vida
- `main.tsx`: `registerSW` (virtual:pwa-register) con `onNeedRefresh` (confirm) y `onOfflineReady`.
- `UpdateBanner.tsx`: segundo `registerSW` + `registration.update()` en montaje + **polling de 60 s**; muestra modal bloqueante «Actualización Requerida» con botón «Actualizar Ahora» (`updateSW(true)` → recarga).
- `InstallPromptBanner.tsx`: escucha `beforeinstallprompt`, instrucciones de instalación para iOS (Share → Añadir a pantalla de inicio), `display-mode` detection y descarte persistido en `localStorage`.
- `OfflineBanner.tsx` + `useOnlineStatus.ts`: aviso «Estás sin conexión» cuando `navigator.onLine === false`.

### Service worker generado
- `dev-dist/sw.js` (desarrollo, **commiteado**): solo precache del HTML y rutas runtime; en dev la navegación offline aplica únicamente a `/`.
- **`src/sw.ts` es código muerto**: sus handlers `push`, `notificationclick`, `notificationclose` y la cache extra de `hockey_matches` **no se incluyen** en el SW generado por `generateSW`. Consecuencia directa: las **notificaciones push no se muestran** (ver `notifications.md`).

## Reglas de negocio

- Estrategia `autoUpdate`: el SW nuevo se instala/activa solo; el modal de `UpdateBanner` es el respaldo visual.
- Los datos de API se sirven StaleWhileRevalidate (máx. 1 día); las imágenes de storage 7 días.
- No hay cache para llamadas a edge functions (`supabase.functions.invoke`) ni para auth.

## Datos implicados

- Build estático precacheado (JS/CSS/HTML/iconos/fuentes).
- Respuestas de la API REST y storage de Supabase en cachés Workbox.
- `localStorage`: `installBannerDismissed`, `push_prompt_dismissed`.

## Permisos

- None especial: la instalación PWA depende del navegador (`beforeinstallprompt` / iOS manual).

## Integraciones

- `virtual:pwa-register` (registro/actualización).
- Service worker Workbox (precache + runtime caching).
- Banners globales en `App.tsx` (`OfflineBanner`, `InstallPromptBanner`, `UpdateBanner`).
- Impacto directo en `notifications.md` (push no operable mientras `src/sw.ts` no se compile).

## Estado

**Parcial.** Instalable y offline parcial funcionando. Problemas verificados:
1. Handlers de push de `src/sw.ts` no se despliegan (`generateSW`).
2. Doble manifest (plugin + `public/manifest.json`).
3. `apple-touch-icon.png` declarado en `includeAssets` pero inexistente.
4. `dev-dist/` commiteado (artefacto).
5. Variables `.env` con prefijo `REACT_APP_` que Vite no expone (necesita `VITE_*`).

## Futuras extensiones

- Pasar a `injectManifest` o mover los handlers push a las opciones del plugin para activar las notificaciones.
- Navegación offline completa (todas las rutas, no solo `/`).
- Estrategia de cache para `supabase.functions.invoke`.
- Limpieza de `dev-dist/` y del manifest duplicado.
- Actualizar `frontend/README.md` (boilerplate de CRA desactualizado).