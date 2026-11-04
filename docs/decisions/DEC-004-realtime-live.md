# DEC-004 — Seguimiento en vivo con Supabase Realtime + timestamp

## Contexto

El seguimiento en vivo de partidos (marcador, cronómetro, goles, tarjetas, paradas, reacciones) debe sincronizarse entre el panel del admin y los espectadores (que acceden sin cuenta), con conexiones móviles inestables.

## Decisión

- **Supabase Realtime (`postgres_changes`)** como canal de sincronización:
  - Pares clave→valor del partido viven en `hockey_matches` y se propagan por UPDATE.
  - Los eventos (goles, paradas, tarjetas) se insertan en tablas dedicadas (`hockey_goals`, `hockey_saves`, `match_cards`, …) y se consumen por Realtime.
- **Cronómetro por timestamp**, no por servidor tick: el admin escribe `start_time` (epoch ms) y `remaining_time`,`running`; cada cliente calcula el tiempo localmente con un intervalo de 100 ms (`remaining_time - elapsed`), pausando al congelar `remaining_time` y `start_time:null`.
- **Polling de respaldo cada 3 s** en admin y espectador para cuando el WebSocket está bloqueado o caído (reconciliando el partido si la deriva supera 5 s).
- Las **reacciones** del público se obtienen por **polling** (no por Realtime).

## Motivo

- Realtime de Supabase minimiza la infraestructura (misma BD, sin servidor de eventos propio).
- El patrón timestamp+reloj local es el más simple en la práctica: el estado canónico siempre vive en BD y el cronómetro no exige ticks constantes hacia la BD.
- El polling de respaldo garantiza funcionamiento con WebSockets bloqueados (redes corporativas/móviles).

## Consecuencias

- **Positivo**: implementación simple, resistencia a caídas de WebSocket, cero servicios extra.
- **Negativo / riesgos**:
  - **Deriva de cronómetro** por reloj local entre dispositivos (corregida solo en el polling si supera 5 s).
  - Tablas usadas (hockey_*, events, players, convocations) no constan añadidas explícitamente a `supabase_realtime` en los scripts del repo salvo las nuevas (locations, lotteries, tournaments…).
  - Suscripciones incongruentes heredadas (p.ej. `match_events` en el espectador sin `match_id`).
  - Reacciones con latencia de hasta 3 s.

## Estado

Aceptada. La deriva de cronómetro y las mejoras de realtime para reacciones/shootouts/penalty-misses quedan abiertas como extensiones en `docs/specs/live-match.md` y `docs/specs/spectator-mode.md`.