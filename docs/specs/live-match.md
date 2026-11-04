# Live Match (Seguimiento en vivo — Admin)

## Objetivo

Ofrecer a un operador (admin de partido) el control en tiempo real de un partido de hockey: marcador, cronómetro por cuartos, goles, tarjetas, paradas, penalty/stroke y shootouts, visible al instante para los espectadores.

## Usuarios implicados

- **Admin de partido**: persona con el PIN (o acceso a `/match/:id` sin PIN) que opera el partido.
- **Espectadores**: consumen el estado en `spectator-mode.md`.

## Comportamiento actual

- **Acceso**: `MatchAdmin.tsx`. Si `hockey_matches.admin_pin_hash` existe, pide PIN (verificado con SHA-256); si no, `isAdmin = true` directo.
- **Cronómetro**:
  - Estado canónico en `hockey_matches`: `quarter`, `quarter_duration`, `remaining_time`, `running`, `status`, `start_time` (epoch ms).
  - El admin mantiene un `setInterval` de 100 ms: `displayTime = max(0, remaining_time - floor((Date.now() - start_time)/1000))` si `running && start_time`.
  - **Iniciar**: `updateMatch({ running:true, status:'active', start_time: Date.now() })`.
  - **Pausar**: congela `remaining_time`, `running:false`, `status:'paused'`, `start_time:null`.
  - **Fin de cuarto**: automático al llegar `displayTime === 0`; si `quarter >= 4` finaliza (`status:'finished'`, limpia reacciones) o abre modal de shootouts si hay empate.
- **Marcador**: `score_team1`/`score_team2`. Sumar gol inserta en `hockey_goals` y recalcula el marcador en `hockey_matches` (UPDATE que el espectador recibe). Restar gol borra el último gol y decrementa (mínimo 0).
- **Eventos**:
  - Goles (`hockey_goals`) con opción `is_penalty` (flujo desde modal Penalty).
  - Tarjetas (`match_cards`): `green`/`yellow`/`red` con jugadora, equipo, cuarto y minuto.
  - Paradas (`hockey_saves`): **solo portera local** (`team: 'team1'` siempre).
  - Penalty/Stroke (`hockey_penalty_misses`): si acierta, deriva al modal de gol marcando `is_penalty`; si falla, registra el miss.
  - Shootouts (`match_shootouts`): alternancia por rondas; «Finalizar» → `status:'finished'`.
- **Planillas/cambios**: existen las APIs `initLineup`, `getLineup`, `changePlayer`, `quickSubstitution`, `getSubstitutions` y la tabla `match_lineups`/`match_substitutions`, **pero no hay panel de alineación/cambios en la UI actual**.
- **Realtime (admin)**: canal `hockey-match-${id}` con `postgres_changes` sobre `hockey_matches(*)`, `hockey_goals` (INSERT/DELETE), `hockey_saves` (INSERT), `match_cards(*)`, `hockey_penalty_misses(*)`. Además **polling de respaldo cada 3 s** (recarga jugadores, goles, saves, tarjetas, lineup, penalty misses y shootouts).
- **Extras**: vídeo de YouTube configurable, datos de sponsor, exportación del acta a **PDF** (`generateMatchPDF` en `src/lib/pdfExport.ts`).

## Reglas de negocio

- El cronómetro corre por reloj local del admin; `remaining_time` solo se congela al pausar.
- Un gol siempre actualiza el marcador en `hockey_matches` (fuente del espectador).
- `hockey_penalty_misses` y `match_shootouts` **no tienen canal realtime** → llegan al espectador por polling.
- Las reacciones del público se limpian al finalizar el partido.

## Datos implicados

- `hockey_matches`, `hockey_goals`, `hockey_saves`, `match_cards`, `hockey_penalty_misses`, `match_shootouts`, `match_lineups`, `match_substitutions`, `hockey_players`, `match_reactions`.
- Hydración para el PDF: goles, paradas, tarjetas, penalty misses y shootouts.

## Permisos

- Control del partido: **PIN SHA-256** o ausencia de PIN = acceso libre a `/match/:id`. Sin comprobación de rol en esta página.
- En el listado (`MatchList`), los botones Admin/Editar solo aparecen para rol `admin`.

## Integraciones

- Supabase Realtime (postgres_changes) + polling 3 s.
- Trigger `on_goal_created` (migración 003) que intenta notificación push por gol — **inconsistente con el esquema actual** (columnas referenciadas no verificadas).
- Exportación PDF.

## Estado

**Implementado.** Riesgos verificados: deriva de cronómetro por reloj local; acceso por PIN en lugar de roles; paradas solo del equipo local; sin panel de lineups en la UI.

## Futuras extensiones

- Panel de alineaciones/cambios funcional en la UI.
- Soporte de paradas de ambos equipos.
- Sincronización de cronómetro por server-tick (eliminar deriva).
- Corregir/retirar la suscripción espuria a `match_events` en el espectador.