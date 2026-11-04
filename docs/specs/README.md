# Especificaciones (specs)

Cada spec describe **el comportamiento real** de un módulo, verificado en el código. No se documentan funcionalidades pensadas como implementadas: lo que no exista se marca como extensión futura.

## Índice

| Spec | Área | Estado |
|---|---|---|
| [users-and-roles.md](users-and-roles.md) | Autenticación, usuarios, roles y permisos | Implementado (auth custom) / Parcial (permisos) |
| [matches.md](matches.md) | Partidos: eventos, hockey, listado, setup | Implementado / Parcial |
| [live-match.md](live-match.md) | Seguimiento en vivo (panel admin) | Implementado |
| [spectator-mode.md](spectator-mode.md) | Modo espectador público | Implementado |
| [teams-and-players.md](teams-and-players.md) | Equipos, jugadoras, convocatorias | Implementado |
| [notifications.md](notifications.md) | Notificaciones push | Parcial |
| [monitoring.md](monitoring.md) | Configuración · Mantenimiento (keep-alive de Supabase) | Implementado (cron de producción pendiente de verificar) |
| [pwa.md](pwa.md) | PWA, offline, actualización | Parcial |

## Estructura de cada spec

1. **Objetivo** — qué resuelve el módulo.
2. **Usuarios implicados** — quién lo usa.
3. **Comportamiento actual** — qué hace realmente el código.
4. **Reglas de negocio** — invariantes y restricciones verificadas.
5. **Datos implicados** — tablas y campos.
6. **Permisos** — roles o mecanismos que controlan el acceso.
7. **Integraciones** — Supabase Realtime, edge functions, PWA, etc.
8. **Estado** — Implementado / Parcial (+ motivos y riesgos).
9. **Futuras extensiones** — ideas que NO existen hoy (solo se añaden cuando se deciden).

## Guía de mantenimiento

- Actualizar una spec cuando un cambio de código altere su **Comportamiento actual** o **Reglas de negocio**.
- No ampliar una spec con funcionalidades no construidas: pasan a **Futuras extensiones** o se crean nuevas specs en `docs/decisions/`.
- Cada spec debe poder leerse en menos de 2 minutos: mantenerlas concisas.