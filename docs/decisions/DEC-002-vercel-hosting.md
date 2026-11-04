# DEC-002 — Hosting en Vercel con rewrite SPA y cron de keep-alive

## Contexto

La app es un SPA (React + Vite) que necesita desplegarse sin servidores dedicados y mantener activo el proyecto Supabase en el plan free tier, que pausa la instancia tras inactividad.

## Decisión

- **Vercel** como hosting del frontend, con el root del deploy en `frontend/`.
- `vercel.json`:
  - `rewrites` de todas las rutas a `/` (soporte SPA para react-router).
  - `buildCommand`: `CI=false npm install --legacy-peer-deps && npm run build`.
  - `crons`: una vez al día (06:00 UTC) sobre `/api/cron/keep-alive` (función serverless en `frontend/api/cron/keep-alive.js`, protegida por `CRON_SECRET`, que ejecuta una query mínima contra Supabase y registra el heartbeat; ver DEC-006).

## Motivo

- Deploy gratuito, simple y con soporte nativo de rewrites para SPAs.
- El keep-alive por cron evita el enfriamiento de la base de datos en el plan gratuito de Supabase.

## Consecuencias

- **Positivo**: deploy reproducible, integración Git, cero mantenimiento de servidores.
- **Negativo / riesgos**:
  - Las variables de entorno deben existir en Vercel bajo prefijo `VITE_*` (el `.env` del repo usa `REACT_APP_*`; ver ARCHITECTURE.md).
  - El cron consume una función serverless diaria (mínimo).
  - Dependencia de ambos proveedores (Vercel + Supabase) para el funcionamiento continuo.

## Estado

Aceptada.