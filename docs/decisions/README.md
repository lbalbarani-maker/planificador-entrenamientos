# Decisiones arquitectónicas (ADRs)

Aquí se registran las **decisiones arquitectónicas importantes** del proyecto. Son decisiones que afectan a cómo se construye y mantiene el sistema y que **no deben revertirse o repetirse por error**.

## Estructura

- Formato: `DEC-XXX-titulo-corto.md`.
- Cada decisión usa esta plantilla:

```
# DEC-XXX — Título

## Contexto    — situación y problema que motivó la decisión
## Decisión    — qué se decidió (concreta)
## Motivo      — por qué se eligió esta opción
## Consecuencias — qué implica (positivo y negativo/riesgos)
## Estado      — Aceptada / Propuesta / Reemplazada / Deprecada
```

## Índice

| ADR | Título | Estado |
|---|---|---|
| [DEC-001](DEC-001-supabase-backend.md) | Supabase como backend (con auth custom en `profiles`) | Aceptada |
| [DEC-002](DEC-002-vercel-hosting.md) | Hosting en Vercel con rewrite SPA y cron de keep-alive | Aceptada |
| [DEC-003](DEC-003-pwa-vite-plugin.md) | PWA con vite-plugin-pwa (generateSW / autoUpdate) | Aceptada |
| [DEC-004](DEC-004-realtime-live.md) | Seguimiento en vivo con Supabase Realtime + timestamp | Aceptada |
| [DEC-005](DEC-005-roles-permisos.md) | Roles y permisos: CSV en `profiles.role` + dashboardPermissions | Aceptada |
| [DEC-006](DEC-006-keep-alive-cron.md) | Keep-alive de Supabase con endpoint interno autenticado y heartbeat append-only | Aceptada |

## Regla

- **Solo se crea una decisión nueva cuando se adopta una decisión arquitectónica relevante** (nuevo servicio, cambio de modelo de datos global, cambio de estrategia de seguridad, cambio de hosting, etc.).
- No documentar cada pequeño cambio en `decisions/`; los cambios de comportamiento se reflejan en las specs.
- Si una decisión queda obsoleta, marcarla **Reemplazada/Deprecada** en el propio archivo en lugar de borrarla, y referenciar la nueva que la sustituye.