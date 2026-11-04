# Teams and Players (Equipos, jugadoras y convocatorias)

## Objetivo

Gestionar los equipos del club, la plantilla de jugadoras y las convocatorias a partidos, con comunicación directa a jugadoras y familias.

## Usuarios implicados

- **Admin y dirección** (`admin`, `admin_club`, `coordinador`): crear clubes/equipos y gestionar plantillas completas.
- **Cuerpo técnico** (`entrenador`, `delegado`): convocar jugadoras, publicar eventos y compartir convocatorias.
- **Jugadoras** (`jugador`): ver sus equipos y convocatorias.
- **Padres** (`padre`): ver la convocatoria de su hija.

## Comportamiento actual

### Equipos y plantilla
- `TeamsList.tsx` / `TeamDetail.tsx`: CRUD de equipos (tabla `teams`) y asignación de jugadoras (`team_players` con `shirt_number`, `position`, `is_active`, `is_primary`).
- **Grupo sincronizado** de `players` ↔ `team_players`: script SQL `SYNC_TEAM_PLAYERS.sql` copia `players.dorsal` → `team_players.shirt_number` y `players.position` → `team_players.position`.
- Al crear un **evento `type='match'`** se crea automáticamente el partido de hockey (`hockeyApi.createMatch`). Los eventos `training` no.

### Jugadoras
- `PlayersList.tsx`: CRUD en `players` (dorsal, posición, género, minoría, relación con padres), con **importación/exportación XLSX** (`xlsx`).

### Convocatorias
- `convocationApi` (`supabaseTeams.ts`): `getConvocation(eventId)` con joins a `players`/`team_players`; `createConvocation`, `createBulkConvocation`, `updateConvocationStatus`, `deleteConvocation`.
- `MyConvocations.tsx`: lista las convocatorias de la jugadora seleccionada (o de la hija del padre) con estados `pending/accepted/declined` + nota de respuesta.
- `NextMatch.tsx` (dashboard): próximo partido con la lista de convocadas.
- **Compartir convocatoria como imagen**: `shareConvocationAsImage` con html2canvas (copia al portapapeles, fallback descarga); soporta `final_convocation` (JSON) o convocadas aceptadas.
- **Vincular entrenamiento** a un evento: `eventsApi.linkTraining` (campo `events.training_id`).

### Ubicaciones y rivales
- `LocationsList.tsx`: CRUD de `locations` (superficie `text[]`, parking, vestuarios, enlace Google Maps).
- `fields`/`opponent_teams`: datasources del mismo dominio (pistas y equipos rivales con colores/logo).

## Reglas de negocio

- Plantilla del equipo = `team_players` (dorsal/posición opcionalmente sincronizados con `players`).
- Convocatorias por `event_id` + `player_id`; una jugadora solo responde a los eventos donde está convocada.
- Rol `padre` ve las convocatorias de las jugadoras vinculadas en `parents`/`localStorage`.
- Evento `match` → se crea partido de hockey; evento `training` → no.

## Datos implicados

- `teams`, `clubs`, `team_players`, `players`, `parents`, `user_relations`.
- `events`, `convocation` (y `players`, `team_players` en joins).
- `locations`, `fields`, `opponent_teams` (como catálogo de la app).

## Permisos

- Gestión de clubes → solo `admin` (`/clubs` requiere `hasRole(role,'admin')`).
- Ver equipos/plantillas → usuarios con sesión.
- Las convocatorias no tienen comprobación de pertenencia en el frontend (cualquier usuario con sesión puede consultar `getConvocation`).
- Ruta pública de entrenamientos compartidos (`/training/:shareId`), pero no de convocatorias.

## Integraciones

- Creación de evento match → hockey (`hockeyApi.createMatch`).
- Dashboard: `NextMatch`, secciones de equipos.
- Supabase Realtime en dashboard (tablas `events`, `players`, `convocations`).
- XLSX para import/export; html2canvas para compartir imagen.

## Estado

**Implementado.** Notas: el guard de pertenencia de convocatorias depende del frontend; la vista `playerView` del dashboard usa el rol `jugador`/`padre`.

## Futuras extensiones

- RLS de pertenencia para `convocation` y `team_players`.
- Panel de alineaciones vinculado a la convocatoria del partido en vivo.
- Historial de convocatorias por temporada por jugadora.