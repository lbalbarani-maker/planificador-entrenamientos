# Spectator Mode (Modo espectador)

## Objetivo

Permitir al público seguir un partido en vivo **sin necesidad de cuenta**: marcador, cronómetro, eventos destacados, vídeo y reacciones, vía un enlace público.

## Usuarios implicados

- **Público general**: accede por `share_token` en `/match/:token/watch` (ruta pública, sin login).
- **Familias del club**: suelen recibir el enlace compartido desde el listado de partidos.

## Comportamiento actual

- **Entrada pública**: `MatchSpectator.tsx` carga el partido por `share_token`. Sin autenticación.
- **Suscripción realtime** (canal `match-${id}`) con `postgres_changes`:
  - `hockey_matches` (UPDATE) → actualiza el partido completo (marcador, estado, cronómetro base).
  - `hockey_goals` (*) → recarga el partido al detectar INSERT.
  - `hockey_saves` (*) → recarga al detectar INSERT.
  - `match_cards` (*) → recarga tarjetas.
  - `match_events` (*) con filtro `match_id=eq.<id>` → recarga penalty misses. **Incongruencia detectada**: `match_events` pertenece al módulo de torneos y no tiene `match_id`; este canal no recibe datos reales del hockey.
- **Polling de respaldo (3 s)**:
  - `loadMatchData`: recarga goles, saves, tarjetas, penalty misses y shootouts (usa refs para no disparar overlays falsos).
  - `checkMatchStatus`: re-sincroniza el partido si cambian `running`/`quarter`/`status` o si la deriva de cronómetro supera 5 s.
- **Cronómetro**: igual que el admin: intervalo de 100 ms calculando `remaining_time - elapsed(reloj local)`.
- **Overlay de eventos** (`MatchEventOverlay.tsx`): animaciones a pantalla completa (framer-motion + confetti) para `goal` (verde), `rival_goal` (rojo) y `save` (azul), atributo 3 s. Se disparan al detectar nuevos goles/paradas.
- **Reacciones** (`FloatingReactions.tsx`): botones fijos **👏 ❤️ 🔥 💪**; al pulsar, efecto local inmediato + `INSERT` en `match_reactions`. La recepción de reacciones de otros espectadores se hace por **polling cada 3 s** (`.gt('created_at', lastSeen)`, dedupe por id), no por Realtime.
- **Vídeo**: reproductor de YouTube embebido (autoplay, muteado) cuando el partido tiene `youtube_url`.
- **Panel de información**: marcador, cuarto, cronómetro, estado (En juego/Pausado/Finalizado), historiales de goles, paradas, tarjetas, penalty/stroke y shootouts.

## Reglas de negocio

- No requiere sesión ni rol; el acceso se controla solo por conocimiento del `share_token`.
- El marcador se actualiza por el UPDATE de `hockey_matches` que produce el admin al sumar/restar goles.
- Eventos sin canal realtime (penalty misses, shootouts, reacciones) dependen del polling de 3 s.

## Datos implicados

- `hockey_matches` (lectura por `share_token`).
- `hockey_goals`, `hockey_saves`, `match_cards`, `hockey_penalty_misses`, `match_shootouts` (lectura).
- `match_reactions` (INSERT para reaccionar; lectura por polling).
- `match_events` (suscripción espuria, sin uso real).

## Permisos

- Ninguno en frontend (ruta pública).
- En BD: `hockey_matches` debe permitir SELECT por token (no se ha verificado política RLS específica en el repo).

## Integraciones

- Supabase Realtime (parcial) + polling 3 s.
- canvas-confetti/framer-motion para overlays.
- YouTube embed.

## Estado

**Implementado.** Riesgos verificados: deriva de cronómetro por reloj local; subscribción espuria a `match_events`; penalty misses/shootouts/reacciones solo por polling (posible latencia).

## Futuras extensiones

- Realtime para reacciones (eliminar polling).
- Canal realtime para penalty misses/shootouts.
- Eliminar la suscripción incongruente a `match_events`.
- Hash de sesión espectador para métricas (evitar bots).