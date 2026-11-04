# Auditoría: sincronización en vivo del marcador de hockey

Fecha: 2026-10-07 · Commit de referencia: `b04d72d` · Ramas: `main` (frontend en Vercel)

## 1. Contexto

Se detectaron problemas de sincronización en vivo durante un partido real de hockey
entre la vista de **administración** (`MatchAdmin`) y la **vista de espectador**
(`MatchSpectator`): el marcador del admin no reflejaba los cambios en tiempo real,
el cronómetro "saltaba" cada pocos segundos y la baja/régimen de la cuota de
goles/paradas se reflejaba de forma inconsistente.

Objetivo del hotfix: que marcador, cronómetro y listas de eventos sean **espejo**
entre admin y espectador, con latencia mínima y sin degradar la experiencia.

## 2. Síntomas observados (estado previo)

- El marcador del admin no reflejaba un gol nuevo hasta recargar la página.
- Cuando aparecía, lo hacía con **off-by-one** (mostraba el valor previo).
- "Refresh" visual del cronómetro cada 2-3 s (saltos), molesto pero tolerable.
- Borrar un gol o una parada actualizaba las listas pero **no** el marcador
  principal hasta refrescar.
- Pausar/reanudar tardaba 3-4 s en reflejarse.
- Las tarjetas sí funcionaban correctamente.

## 3. Causas raíz

### 3.1 Service Worker de la PWA servía lecturas obsoletas

`frontend/vite.config.ts` usaba una estrategia **StaleWhileRevalidate** con caché
de 24 h para las peticiones `rest/v1/*` (las llamadas REST a Supabase).
Los polls periódicos de estado (`getMatch`, `getMatchByToken`) podían servir la
fila cacheada (vieja) y alternar con la respuesta fresca → "refresh" visual del
cronómetro cada 2-3 s, marcador stale y cuenta de goles con off-by-one.

### 3.2 El admin no cargaba el partido en su poll de refresco

`loadMatchData` de `MatchAdmin.tsx` **no** consultaba `getMatch(id)`: el marcador
solo se actualizaba vía Realtime. Si el evento no llegaba (tabla no publicada o
sin suscripción), el marcador quedaba congelado hasta el siguiente `loadMatch`.

### 3.3 Base de datos: trigger no útil y Realtime incompleto

- El trigger `on_goal_created` de `hockey_goals` estaba **habilitado**, pero la
  función desplegada en producción **divergía** de la migración `003` (no llegaba
  a hacer `net.http_post`; solo construía un payload con `NEW.team`,
  `NEW.player_name`, `NEW.match_minute`, `NEW.club_id` y no lo enviaba). Es un
  punto de fallo latente en cada `INSERT` de gol (si una columna referenciada
  fuera inválida, podría bloquear la operación de gol).
- Faltaban por publicar en Realtime: `match_cards`, `hockey_penalty_misses` y
  `match_shootouts` (solo estaban `hockey_matches`, `hockey_goals`,
  `hockey_saves`). Un evento de tarjeta/penalti no notificaba por WebSocket.

### 3.4 Otros hallazgos

- `frontend/src/sw.ts` era **código muerto**: el build usa `generateSW`
  (`vite-plugin-pwa`) y la app registra el worker vía `virtual:pwa-register`.
  Contenía handlers de `push`/`notificationclick` que nunca estuvieron activos →
  las notificaciones push de la app están **rotas desde siempre** (ver §7).

## 4. Fixes aplicados

### 4.1 Código — `MatchSpectator.tsx`

- `matchRef` para comparar el estado y evitar sobrescrituras destructivas
  (líneas 37-38).
- `checkMatchStatus` (líneas 217-243): el poll de 3 s consulta `getMatchByToken`
  y solo repinta el partido si cambian `running`, `quarter`, `status`,
  `score_team1/2` o la diferencia de `remaining_time` > 5 s. El `setDisplayTime`
  queda **protegido**: no se pisa si `running && start_time` (el cronómetro lo
  lleva el efecto de 100 ms).
- Realtime: `hockey_goals` (`INSERT`) → solo `getMatchGoals` (114) y
  `hockey_saves` (`INSERT`) → solo `getMatchSaves` (128), en lugar de recargar
  todo el partido (`loadMatch`).
- Suscripción correcta a `hockey_penalty_misses` en el canal `match_events`
  (línea 149).

### 4.2 Código — `MatchAdmin.tsx`

- `matchRef` (líneas 14-15).
- `loadMatchData` (líneas 267-309): ahora **incluye `getMatch(id!)`** y aplica
  detección de cambios (running/quarter/status/start_time/score_team1/2,
  `|remaining_time diff| > 5`) → hace `setMatch` **solo** cuando hay cambios
  reales y **nunca** toca `setDisplayTime`.
- Poll de espejo del marcador cada 3 s (líneas 260-264).
- Borrar gol (línea 565 + botón 1161): tras `removeGoal` hace refetch **solo de
  goles y del partido** (`Promise.all([getMatchGoals, getMatch])`), sin cambiar
  el cronómetro.
- Borrar parada (líneas 1117-1118): `removeSave` + refetch solo de paradas.

### 4.3 PWA — `frontend/vite.config.ts`

Las rutas `rest/v1/*` pasan de `StaleWhileRevalidate` a **NetworkFirst** con
`networkTimeoutSeconds: 3` (líneas 68, 79 y 82 del handler `api-cache`). En
online, el app siempre lee datos frescos; el caché solo actúa como respaldo.

### 4.4 Limpieza

- Eliminado `frontend/src/sw.ts` (código muerto; 136 líneas removidas).

### 4.5 Base de datos

Aplicado manualmente en el SQL Editor del proyecto de Supabase (producción) y
documentado como migración idempotente en
`supabase/migrations/004_hockey_realtime_and_goal_trigger.sql`:

```sql
ALTER TABLE hockey_goals DISABLE TRIGGER on_goal_created;

ALTER PUBLICATION supabase_realtime ADD TABLE match_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE hockey_penalty_misses;
ALTER PUBLICATION supabase_realtime ADD TABLE match_shootouts;
```

Decisión (Opción B): el trigger se **deshabilita** (reversible con
`ENABLE TRIGGER`) en lugar de borrarse, para poder volver atrás y, si se
necesita, reescribir la función correctamente. A día de hoy los INSERT de gol
siguen persistiendo correctamente.

## 5. Verificación en producción

- Build local: `npx tsc --noEmit` OK, `npm run build` OK, ESLint sin nuevos
  warnings respecto al baseline (217 problemas preexistentes en el repo).
- Deploy Vercel desde `frontend/`: commit `b04d72d`.
  Producción: https://sanse-complu.vercel.app
- Smoke test del artefacto desplegado:
  - `GET /` → 200.
  - `sw.js` contiene `NetworkFirst`.
  - El bundle JS servido contiene el hook de `hockey_penalty_misses`.
- BD (consultas de verificación en Supabase):
  - `pg_publication_tables` (pub `supabase_realtime`): `match_cards`,
    `hockey_penalty_misses`, `match_shootouts` presentes (3 filas).
  - `pg_trigger` para `on_goal_created`: `tgenabled = 'D'` (disabled).
  - Nota: re-ejecutar el script de SQL 1 devuelve `ERROR 42710: relation
    "match_cards" is already member of publication` → equivalente a **confirmar**
    que ya estaba aplicado (el `ALTER PUBLICATION ADD TABLE` no es idempotente
    por sentencia; la migración `004` sí lo es mediante bloque `DO`).

## 6. Checklist de validación de campo

Con la app **ya actualizada** (el Service Worker nuevo debe tomar el control:
botón "Actualizar" del UpdateBanner o pestaña de incógnito la primera vez):

1. Iniciar partido → el cronómetro corre de forma continua, sin saltos.
2. Marcar gol → el marcador del admin y del espectador cambian solos (≤ 3 s).
3. Borrar gol / borrar parada → las listas se actualizan (Realtime) y el
   marcador del admin baja en ≤ 3 s (poll de espejo).
4. Tarjeta → se refleja por Realtime.
5. Penalty/stroke fallado y shootout → se reflejan por Realtime.
6. Pausar/reanudar → inmediato con WebSocket o ≤ 3 s vía poll de espejo.

## 7. Deuda técnica / pendientes

- **Push notifications rotas de base**: los handlers vivían en el `sw.ts`
  eliminado y nunca estuvieron activos (`generateSW`). Para reactivarlas hace
  falta migrar a `injectManifest` (o `customWorkerSrc`) y revisar al edge
  function `send-push`. Fuera de alcance de este hotfix.
- **Optimización menor**: aplicar `setIfChanged` en los handlers de Realtime
  para saltarse setState redundantes. Sin impacto visible.
- **Lint del repo**: 217 problemas preexistentes (1 error en el componente
  raíz, resto warnings) que bloquean `npm run lint -- --max-warnings 0`. No se
  añadieron nuevos en este cambio.
- **Build**: chunk principal > 500 kB (aviso de Vite). Candidato a code-split.
- **`docs/` sin trackear** en git: este informe y cualquier otro material de la
  carpeta están fuera del repo hasta que se decida versionarlos.