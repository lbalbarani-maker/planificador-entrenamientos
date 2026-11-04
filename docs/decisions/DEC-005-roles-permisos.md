# DEC-005 — Roles y permisos: CSV en `profiles.role` + dashboardPermissions

## Contexto

La app gestiona distintos tipos de usuario del club (dirección, cuerpo técnico, jugadoras, familias) y necesita adaptar las vistas (especialmente el dashboard) al perfil de cada uno, sin un sistema de autenticación basado en tokens por ahora (ver DEC-001).

## Decisión

- El rol se almacena como **cadena separada por comas** en `profiles.role`, con valores normalizados: `admin`, `admin_club`, `entrenador`, `preparador`, `coordinador`, `delegado`, `tesorero`, `jugador`, `padre`.
- El control de acceso se hace en el **frontend**:
  - `hasRole(user.role, 'admin')` en rutas (p.ej. `/users`, `/categories`, `/clubs`, `/admin/push`).
  - `config/dashboardPermissions.ts` + `hook useRolePermissions` para filtrar métricas, secciones y filtros del dashboard (`allTeams`, `ownTeam`, `playerView`).
- **Excepción explícita**: el panel de control de partido (`MatchAdmin`) no usa roles, sino **PIN** (SHA-256 sobre `admin_pin_hash` en `hockey_matches`).

## Motivo

- Evolución natural: el modelo de permisos creció junto a los módulos del club sin necesidad de una plataforma de identidad al principio.
- Rápido de adaptar: un usuario puede acumular varios roles.

## Consecuencias

- **Positivo**: flexible (multi-rol), fácil de leer al usarse en rutas y dashboard.
- **Negativo / riesgos**:
  - Centraliza la seguridad en el frontend (CLI de la BD no protege por rol; RLS mayoritariamente abierta — ver ARCHITECTURE.md).
  - La cadena CSV no permite granularidad fina (p.ej. ámbito por equipo/temporada) sin convenciones ad hoc.
  - El módulo hockey queda fuera del modelo de roles (protegido por PIN), lo que impide auditar quién controla un partido.
  - Roles no validados contra una lista canónica en BD (se definen también en `Users.tsx`).

## Estado

Aceptada. Prevista a evolucionar hacia roles con base de datos + RLS real (ver `docs/specs/users-and-roles.md` → Futuras extensiones) si se percibe la necesidad de auditaridad.