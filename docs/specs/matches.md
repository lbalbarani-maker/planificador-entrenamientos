# Matches (Partidos)

## Objetivo

Gestionar los partidos del club: crearlos como eventos, vincularlos a un partido de hockey, ver el listado y acceder a la vista de admin/espectador.

## Usuarios implicados

- **Entrenadores/dirección**: crear y editar partidos y su convocatoria.
- **Jugadoras/padres**: ver el próximo partido y la lista de convocadas.
- **Público**: seguir el partido en vivo (modo espectador).
- **Admin**: crear y controlar el partido de hockey (por PIN).

## Comportamiento actual

- **Dos niveles de «partido»**:
  1. **Evento** en `events` con `type='match'`, `start_datetime`, `home_score`/`away_score`, `location_id`, `opponent_team_id`, `tournament_id`/`matchday_id`, y convocatoria vinculada (`final_convocation` JSON).
  2. **Partido de hockey** (`hockey_matches`) **creado automáticamente** al crear un evento de tipo `match` (no para `training`) desde `Teams/TeamsList.tsx`.
- **Listado** (`Hockey/MatchList.tsx`): muestra partidos, permite ver (espectador), abrir admin/editar (solo si rol `admin`) y copiar/abrir el enlace público (`share_token`).
- **Setup** (`Hockey/MatchSetup.tsx`): crea un partido standalone con datos de equipos/colores, PIN de admin opcional y duración de cuartos.
- **Próximo partido** (`NextMatch.tsx`): `eventsApi.getUpcomingEvents(10)` → primer evento `type='match'`, con equipo y convocadas (`convocationApi.getConvocation`).
- **Convocatorias por evento** (`Convocation` en `types/teams.ts`): estados `pending/accepted/declined`, `response_note`, `updated_at`; compartible como imagen con html2canvas.

## Reglas de negocio

- Partido de hockey se crea solo para eventos `type === 'match'`.
- El marcador del evento (`home_score/away_score`) es independiente del marcador en vivo de `hockey_matches`.
- El acceso al panel de control de un partido exige PIN (`admin_pin_hash`); si el partido no tiene PIN, cualquiera con la URL es admin.

## Datos implicados

- `events` (tipo match, fechas, marcador, rival, ubicación).
- `hockey_matches`, `hockey_players`.
- `convocation`, `players`, `team_players`.
- `opponent_teams`, `locations`, `tournaments`, `matchdays`.

## Permisos

- Ver listado → sesión iniciada.
- Botones Admin/Editar en listado → `hasRole(user.role, 'admin')`.
- Vista espectador → pública por `share_token`.
- Panel de control → PIN SHA-256 (no roles).

## Integraciones

- Creación de evento `match` → `hockeyApi.createMatch`.
- Dashboard → `NextMatch`.
- Módulo hockey (specs `live-match.md` y `spectator-mode.md`) consume `hockey_matches`.

## Estado

**Implementado** (eventos + hockey + listado + setup). **Parcial** en: coherencia marcador evento vs hockey, y control de acceso del panel basado en PIN en vez de roles.

## Futuras extensiones

- Doble confirmación del marcador (local vs hockey).
- Modificación del partido de hockey al editar el evento.
- Vinculación de `match_events` (estadísticas de torneos) con el partido en vivo.