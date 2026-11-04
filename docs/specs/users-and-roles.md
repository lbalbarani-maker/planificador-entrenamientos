# Users and Roles

## Objetivo

Gestionar usuarios del club, sus roles y su relación con jugadoras/equipos, y controlar qué puede ver o hacer cada rol dentro de la app.

## Usuarios implicados

- **Admin** (`role` incluye `admin`): gestión completa de usuarios y clubes.
- **Resto de roles** (`admin_club`, `entrenador`, `preparador`, `coordinador`, `delegado`, `tesorero`, `jugador`, `padre`): consumen permisos según rol.

## Comportamiento actual

- **Login custom sin Supabase Auth**: `Login.tsx` consulta `profiles` por email y contraseña (hash JS débil `simpleHash` o comparación en claro), soporta PIN de 6 dígitos, y guarda la sesión en `localStorage['user']`. `App.tsx` lee esa clave (con polling de 1s) como guard de rutas.
- **Vinculación de jugadora**: al iniciar sesión, `loginUser` rellena en `localStorage` `selectedPlayerId`, `parentPlayerIds`, `parentPlayers` y `user_relations` (tipo `plays`), y la relación de padres vía tabla `parents`.
- **Gestión de usuarios** (`Users.tsx`): CRUD de usuarios con rol (cadena CSV), `is_active`, relaciones `user_relations`, `playerIds`, `teamIds` y roles disponibles constantes (`admin`, `admin_club`, `entrenador`, `preparador`, `coordinador`, `delegado`, `tesorero`, `jugador`, `padre`).
- **Permisos por rol**: `config/dashboardPermissions.ts` + `hooks/useRolePermissions.ts` controlan métricas, secciones y filtros del dashboard (`allTeams`, `ownTeam`, `playerView`).
- **Guard de rutas**: rutas admin (`/users`, `/categories`, `/clubs`, `/admin/push`) exigen `hasRole(user.role, 'admin')`; el resto exige sesión.

## Reglas de negocio

- Un usuario puede tener varios roles en un mismo campo `role` separados por coma.
- `jugador`/`padre` solo ven su propia información (convocatoria propia o de la hija vinculada).
- El rol NO se aplica al módulo hockey: el control del partido se protege con PIN en `hockey_matches.admin_pin_hash` (SHA-256), no con roles.
- La sesión se considera válida si `localStorage['user']` existe en el navegador.

## Datos implicados

- `profiles` (email, full_name, role, password, pin, is_active, club_id, phone, is_super_admin).
- `user_relations` (relation_type: player/team), `parents` (email → player_id).
- `clubs`, `players` (para las relaciones).

## Permisos

- **Admin**: `/users`, `/categories`, `/clubs`, `/admin/push`.
- **Roles staff**: dashboard y módulos de equipo.
- **jugador/padre**: dashboard en modo `playerView` y `MyConvocations`.
- Seguridad real: dependiente del guard de frontend; RLS no verificada como protector (ver ARCHITECTURE.md).

## Integraciones

- Login → rellena session data en `localStorage`.
- `useRolePermissions` → comida por el dashboard.
- Edge function `send-push` valida rol `admin`/`staff` en `profiles` (independiente del frontend).

## Estado

**Implementado** (auth + gestión de usuarios). **Parcial** en: permisos (rol CSV sin RLS de soporte, hockey fuera del sistema de roles) y riesgos de seguridad conocidos (hash débil, sesión en localStorage).

## Futuras extensiones

- Migración a Supabase Auth real.
- Refuerzo de RLS por rol en la base de datos.
- Sistema de departamentos/ámbitos por rol más fino que el CSV.