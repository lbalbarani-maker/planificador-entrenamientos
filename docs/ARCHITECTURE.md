# ARCHITECTURE.md — Arquitectura actual

Arquitectura **real** verificada en el código del repositorio. Todo lo documentado aquí existe en el código; los riesgos e inconsistencias se marcan explícitamente.

## Resumen

```
Frontend React 19 + Vite (PWA)  →  Supabase (Postgres + Realtime + Edge Function send-push)  →  Vercel (hosting + cron keep-alive)
```

- **Frontend**: React + TypeScript + Vite + Tailwind, servido por Vercel como SPA.
- **Backend**: Supabase (proyecto `https://rtyxufscynjpxuliwlpm.supabase.co`), acceso vía cliente `@supabase/supabase-js` con `anon key`.
- **Auth**: sistema **custom** basado en filas de `profiles` y sesión en `localStorage`, no Supabase Auth (ver «Autenticación»).
- **Deploy**: Vercel (rewrites SPA a `/` + cron diario `/api/cron/keep-alive`). Repositorio GitHub.

> Producción: **https://sanse-complu.vercel.app** (alias `https://planificador-entrenamientos.vercel.app`). Proyecto Vercel: `planificador-entrenamientos`, conectado a GitHub con root directory `frontend` y rama de producción `main`.

---

## Frontend

- **Framework**: React 19 (`react`/`react-dom`).
- **Lenguaje**: TypeScript (config `tsconfig.json`; scripts `tsc && vite build`).
- **Build**: Vite 5 (`vite.config.ts`), entrada `src/main.tsx`, salida `build/`. Alias `@` → `src`.
- **Routing**: `react-router-dom` v7 (`BrowserRouter`). Rutas públicas: `/login`, `/training/:shareId`, `/match/:token/watch`, `/lottery/:lotteryId/player|buyer/:id`. Rutas protegidas redirigen a `/login` si no hay usuario en `localStorage['user']`.
- **Estilos**: Tailwind CSS 3 (config en `tailwind.config.js`, `postcss.config.js`).
- **Estado**: **gestión de estado local** (React `useState`/`useEffect`/`useContext`). Sin Redux/Zustand. La sesión vive en `localStorage` (ver «Autenticación»).
- **Librerías relevantes**: `framer-motion` (animaciones/overlays), `recharts` (dashboard), `canvas-confetti` (goles), `react-youtube` (stream en vivo), `html2canvas`/`jspdf`/`html2pdf.js` (PDF, compartir como imagen), `xlsx` (import/export jugadoras).
- **Capa de datos**: cada dominio tiene un módulo API en `src/lib/supabase*.ts` (`supabaseTeams`, `supabaseHockey`, `supabaseLottery`, `supabaseTournaments`, `supabaseTrainings`, `supabaseUsers`, `supabaseShop`, `supabaseExercises`, `supabaseCategories`) que envuelve `supabase.from(...)`. Los tipos viven en `src/types/*.ts`.

### Estructura de carpetas (resumen)

```
frontend/
├── src/
│   ├── App.tsx            → rutas + guard de sesión/roles
│   ├── main.tsx           → registro del Service Worker (virtual:pwa-register)
│   ├── lib/               → clientes y APIs de Supabase
│   ├── types/             → tipos TypeScript por dominio
│   ├── hooks/             → useRolePermissions, useDashboardData, usePushNotifications, useOnlineStatus
│   ├── components/        → componentes por dominio (Hockey/, Teams/, Lotteries/, Tournaments/, Shop/, Dashboard/, notifications/, Clubs/, Locations/, Players/)
│   ├── pages/             → NotificationSettings, AdminPush, Configuration
│   └── sw.ts              → SW custom (NO desplegado, ver PWA)
├── api/cron/keep-alive.ts → función serverless Vercel (cron, protegida por CRON_SECRET)
├── public/manifest.json   → manifest estático (ver PWA)
├── vercel.json            → rewrites + cron + build
├── .env / .env.example    → variables (ver «Variables de entorno»)
└── dev-dist/              → build del SW en desarrollo (commiteado, artefacto)
```

---

## Backend (Supabase)

### Tablas principales

| Tabla | Propósito |
|---|---|
| `profiles` | Usuarios + auth custom (`email`, `full_name`, `role` CSV, `password`, `pin`, `is_active`, `club_id`, `is_super_admin`, `is_club_admin`, `phone`). |
| `clubs` | Clubes (nombre, logo, colores). |
| `teams` / `team_players` | Equipos y plantilla (dorsal, posición, `is_primary`). |
| `players` | Jugadoras (dorsal, posición, género, minoría, `parent_id`). |
| `parents` / `user_relations` | Relación padre→jugadora y usuario→jugadora/equipo. |
| `events` | Eventos del club: `type` (match/training/meeting), fecha, lugar, `home_score`/`away_score`, `training_id`, `tournament_id`, `matchday_id`, `opponent_team_id`, `location_id`, `final_convocation` (JSON). |
| `convocation` | Convocatoria por evento y jugadora (`status`: pending/accepted/declined, `response_note`). |
| `trainings` / `training_exercises` / `exercises` / `categories` | Entrenamientos (compartibles por `share_id`), ejercicios y categorías. |
| `hockey_matches` | Partido en vivo: `quarter`, `quarter_duration`, `remaining_time`, `running`, `status` (pending/active/paused/finished), `score_team1/2^`, `share_token`, `admin_pin_hash` (SHA-256), `start_time` (epoch ms), sponsor/YouTube. |
| `hockey_players` | Jugadoras del partido (equipo, dorsal, `is_goalkeeper`). |
| `hockey_goals` | Goles (equipo, jugadora, cuarto, minuto, `is_penalty`). |
| `hockey_saves` | Paradas de portera (equipo, cuarto, minuto, dorsal). |
| `match_cards` | Tarjetas (green/yellow/red). |
| `hockey_penalty_misses` | Penalty/stroke fallados. |
| `match_shootouts` | Tandas de shootouts. |
| `match_lineups` / `match_substitutions` | Alineación en pista y cambios. |
| `match_reactions` | Reacciones de espectadores (`clap`/`heart`/`fire`/`muscle`). |
| `tournaments` / `matchdays` / `standings` / `match_events` | Torneos, jornadas, clasificaciones y estadísticas. |
| `lotteries` / `ticket_blocks` / `tickets` / `sponsors` | Loterías, bloques por jugadora, boletos y patrocinadores. |
| `locations` / `fields` / `opponent_teams` | Pistas/canchas y equipos rivales. |
| `marketplace_items` / `merch_products` | Tienda (marketplace y merchandising). |
| `push_subscriptions` | Suscripciones Web Push por usuario (endpoint, claves, `team_ids[]`, `notification_types[]`). |
| `notifications_log` / `notification_clicks` | Registro de envíos y clics. |
| `cron_runs` | Historial del keep-alive (`ran_at`, `status` ok/error, `source` cron/manual, `detail`). RLS activo; solo `SELECT`/`INSERT` para `anon` (append-only). |
| `seasons` | Temporadas (referenciada por `tournaments.season_id`). |

> El esquema está repartido entre migraciones (`supabase/migrations/`) y scripts SQL en la raíz del repo (`LOTTERIES.sql`, `TOURNAMENTS.sql`, `LOCATIONS.sql`, `FIELDS_OPPONENTS.sql`, plus ALTERs como `ADD_START_TIME.sql`, `HOCKEY_SAVES_COLUMNS.sql`, `PLAYERS_DORSAL.sql`, `PLAYERS_POSITION.sql`, `TEAM_PLAYERS_PRIMARY.sql`, `SYNC_TEAM_PLAYERS.sql`, `UPDATE_LOCATIONS_SURFACE.sql` y fixes de RLS). No hay `supabase/config.toml`.

### Edge Functions

- **`send-push`** (`supabase/functions/send-push/index.ts`): único edge function. Envía Web Push con VAPID a `push_subscriptions` (filtra por `club_id`, `team_ids[]`, excluye emisor), limpia endpoints muertos (404/410), registra en `notifications_log` y requiere token de usuario con rol `admin` o `staff`. Secrets requeridos: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.

### Migraciones

- `001_create_push_subscriptions.sql` (tabla + índice parcial + trigger `updated_at`).
- `002_create_notifications_tables.sql` (`notifications_log`, `notification_clicks` + trigger de incremento de clics).
- `003_trigger_goal_notifications.sql` (trigger `on_goal_created`: en cada gol insertado en `hockey_goals` construye payload y llama a la edge function vía `net.http_post`, dependiente de `pg_net` y de settings `app.settings.push_function_url`/`app.settings.service_role_key`).
  - **Riesgo**: el trigger referencia columnas (`hockey_matches.club_id`, `is_team1`; `hockey_goals.team_id`, `minute`) que **no aparecen** en los tipos/hooks del frontend. Puede no ejecutarse correctamente con el esquema actual.

---

## Autenticación

- **Login custom** (`src/components/Login.tsx` + `src/lib/supabaseUsers.ts`): consulta `profiles` por email, compara `password` (con hash JS débil `simpleHash` de 32 bits o en claro) y guarda la sesión en `localStorage['user']`.
- **PIN opcional** de 6 dígitos (hash débil) para acceso rápido; también en `localStorage`.
- **Guard de sesión** (`App.tsx`): lee `localStorage['user']` con polling de 1s y redirige a `/login`.
- **Roles**: cadena CSV en `profiles.role` (`admin`, `admin_club`, `entrenador`, `preparador`, `coordinador`, `delegado`, `tesorero`, `jugador`, `padre`), consumida con `hasRole(...)` y `useRolePermissions`/`dashboardPermissions`.
- **Uso residual de Supabase Auth**: `supabase.auth.getSession()` se usa solo en el subsistema de *push* y en la edge function (`auth.getUser`). **Inconsistencia**: el flujo de login no crea sesión de Supabase Auth.
- **PIN de partido** (`MatchAdmin`): `admin_pin_hash` con SHA-256; si no existe PIN, cualquier usuario con la URL accede al panel de control.

---

## Realtime

Se usa **Supabase Realtime (`postgres_changes`)** en:

- **Dashboard** (`useDashboardData.ts`): canales sobre `events`, `players`, `convocations`.
- **Hockey admin** (`MatchAdmin.tsx`): canal con suscripciones a `hockey_matches` (`*`), `hockey_goals` (INSERT/DELETE), `hockey_saves` (INSERT), `match_cards` (`*`), `hockey_penalty_misses` (`*`).
- **Hockey espectador** (`MatchSpectator.tsx`): canal con `hockey_matches` (UPDATE), `hockey_goals` (`*`), `hockey_saves` (`*`), `match_cards` (`*`), `match_events` (filtro `match_id` — **incongruente**: esa tabla no tiene `match_id`; el callback recarga penalty misses).

Las tablas se añaden a la publicación realtime con `ALTER PUBLICATION supabase_realtime ADD TABLE ...` en los scripts del repo (`fields`, `opponent_teams`, `locations`, `lotteries`, `ticket_blocks`, `tickets`, `sponsors`, `tournaments`, `matchdays`, `match_events`, `standings`). Las tablas `hockey_*`, `match_cards`, `events`, `players`, `convocations` se consumen por Realtime en el frontend aunque **no aparecen añadidas explícitamente en los scripts del repo**.

**Reacciones**: no usan Realtime; `FloatingReactions` hace **polling cada 3s** (`match_reactions` con `created_at > lastSeen`).

### Seguimiento en vivo de partidos — sincronización

- **Estado canónico** en `hockey_matches`: `quarter`, `remaining_time`, `running`, `status`, `start_time` (epoch ms).
- **Cronómetro**: cada cliente (admin/espectador) ejecuta un `setInterval` de 100ms que calcula `remaining_time - floor((Date.now() - start_time)/1000)` mientras `running && start_time`. **No hay tick de servidor**: todo depende del reloj local → posible **deriva** entre dispositivos (mitigada por un polling de 3s en el espectador que corrige si la deriva supera 5s).
- **Pausa**: el admin congela `remaining_time`, pone `running:false` y `start_time:null`, y persiste.
- **Avance de cuarto**: automático en el admin cuando `displayTime === 0` (Q1→Q4, al acabarse el 4º finaliza o abre shootouts en caso de empate).
- **Marcador**: `score_team1/2` en `hockey_matches`; cada gol inserta en `hockey_goals` y actualiza el marcador en la fila (el espectador recibe el UPDATE).
- **Eventos**: goles (`hockey_goals`), paradas (`hockey_saves`), tarjetas (`match_cards`), penalty/stroke fallados (`hockey_penalty_misses`, **sin canal realtime** → llegan por polling), shootouts (`match_shootouts`, sin canal realtime), reacciones (polling).
- **Cambios/alineaciones**: las APIs `initLineup`, `getLineup`, `changePlayer`, `quickSubstitution`, `getSubstitutions` existen en `supabaseHockey.ts` y tipos, pero **no se usan en la UI actual** (sin panel de lineups).

---

## PWA

- **Plugin**: `vite-plugin-pwa` (`generateSW`, `registerType: 'autoUpdate'`), `workbox` con `skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches`, límite 3MB, precache del build.
- **Manifest**: nombre **«Sanse Complu Hockey App»**, short_name **«Sanse Complu»**, `standalone`, `theme_color #0A1F44`, iconos 192/512, shortcuts a `/match` y `/my-convocations`. Hay **dos manifests** (inline del plugin + `public/manifest.json` estático).
- **Estrategias de cache (runtimeCaching)**:
  - Navegación → NetworkFirst (`html-cache`, 10 entradas, 1 día).
  - API REST Supabase (`rest/v1/*`) → StaleWhileRevalidate (`api-cache`, 100, 1 día).
  - Imágenes storage → CacheFirst (`images-cache`, 50, 7 días).
  - Fuentes Google → CacheFirst (365 días).
- **Offline**: app shell precacheada + navegación offline parcial (en dev solo `/`); banner `OfflineBanner`.
- **Actualización**: `autoUpdate`; `UpdateBanner` (registra el SW, `reg.update()` y polling de 60s, modal bloqueante si hay nueva versión).
- **Instalación**: `InstallPromptBanner` (beforeinstallprompt + instrucciones iOS).
- **IMPORTANTE — incompatibilidad detectada**: `src/sw.ts` (handlers `push`, `notificationclick`, `notificationclose`, cache extra de `hockey_matches`) **no se compila** porque se usa `generateSW`. El SW generado (`dev-dist/sw.js`) solo precachea y cachea rutas: **la visualización de notificaciones push no está operativa** aunque las suscripciones se registren.
- `dev-dist/` está **commiteado** (artefacto de desarrollo).

---

## Notificaciones

- **Flujo completo previsto**: usuario se suscribe (`push_subscriptions`) → admin envía desde `/admin/push` (edge `send-push`) o un gol dispara el trigger → `notifications_log` registra envíos → clics en `notification_clicks`.
- **Estado real**: suscripción, envío, panel admin y prefs implementados; la **recepción/visualización** en el navegador depende del SW (no desplegado, ver PWA) y de la sesión Supabase Auth (no generada por el login custom).
- **Endpoint de despertado**: cron Vercel diario a `/api/cron/keep-alive` (`frontend/api/cron/keep-alive.js`, protegido por `CRON_SECRET`) que hace una lectura ligera (`teams`) y registra el heartbeat en `cron_runs`. La sección admin "Configuración > Mantenimiento" (`/configuracion`) muestra el estado y permite lanzarlo manualmente. Ver `docs/specs/monitoring.md` y DEC-006.

---

## Deploy

- **Vercel** (`frontend/vercel.json`):
  - `buildCommand`: `CI=false npm install --legacy-peer-deps && npm run build`.
  - `rewrites`: todas las rutas → `/` (SPA).
  - `crons`: `/api/cron/keep-alive` a las 06:00 UTC diario, `maxDuration: 10`.
  - Root del deploy: `frontend/`.
- **GitHub**: repositorio Git en la raíz.
- **Supabase**: proyecto `rtyxufscynjpxuliwlpm.supabase.co`.

### Variables de entorno

- `frontend/.env.example` (referencia): `VITE_VAPID_PUBLIC_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `CRON_SECRET`.
- **Riesgo**: `frontend/.env` actual define `REACT_APP_SUPABASE_URL`/`REACT_APP_SUPABASE_ANON_KEY`, que Vite **no expone** (solo `VITE_*`). Localmente el cliente Supabase y el push quedan desactivados hasta usar las variables correctas.

---

## Seguridad

Estado **real** verificado:

- **Autenticación custom** con hash JS débil (`simpleHash`) para `profiles.password`/`profiles.pin`, y comparación también en claro. Sesión en `localStorage` (expuesta a XSS).
- **Roles**: cadena CSV, sin RLS dependiente de rol en el frontend.
- **RLS**: la mayoría de políticas presentes en el repo son `USING(true)`/`WITH CHECK(true)` (abiertas) en `teams`, `locations`, `tournaments`, `matchdays`, `match_events`, `standings`, `lotteries`, `ticket_blocks`, `tickets`, `sponsors`. **Excepción**: `cron_runs` tiene RLS activo con solo `SELECT`/`INSERT` para `anon` (sin `UPDATE`/`DELETE`). **Sin políticas verificables en el repo** para `profiles`, `players`, `events`, `hockey_*`, `trainings`, `exercises`, etc.
- **PIN de partido** (`admin_pin_hash`, SHA-256): protege el control del partido; si no se configura, el acceso a `/match/:id` da control directo.
- **Compartición pública por token**: `share_token` (espectador), `share_id` (entrenamientos), rutas públicas de lotería.
- **Edge function `send-push`**: valida token y rol (admin/staff) manualmente; usa service role key (bypass RLS).

> Conclusión: la protección real de la app depende en gran medida del guard de sesión en el frontend, no de la BD. Cualquier refactor de seguridad debe empezar documentando e implementando RLS reales (ver DEC-005 y decisión pendiente de migración).