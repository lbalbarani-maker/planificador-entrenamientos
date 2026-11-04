# CONVENTIONS.md — Convenciones del proyecto

Reglas simples para que futuras implementaciones sean consistentes con el proyecto actual. **No son opcionales**: síguelas salvo que una decisión en `docs/decisions/` diga lo contrario.

---

## Código

- **TypeScript** obligatorio en todo el frontend. Tipos por dominio en `src/types/*.ts`.
- **Reutilizar componentes existentes** antes de crear nuevos (p.ej. `BackButton`, `OfflineBanner`, banners de `components/notifications/`). Buscar primero con glob/grep.
- **Evitar duplicación**: si la lógica ya existe en `src/lib/supabase*.ts`, úsala; no abras otra vía de acceso a los datos.
- **Respetar la estructura actual** de carpetas (`lib/`, `types/`, `hooks/`, `components/<Dominio>/`, `pages/`).
- **Nombres de archivos y componentes**: PascalCase para componentes de React (`MatchAdmin.tsx`), camelCase para utils/hooks (`useRolePermissions.ts`), prefijo `use` en hooks.
- **No añadir dependencias nuevas** sin justificación y sin verificar compatibilidad (react-scripts 5 + React 19 + Vite conviven de forma delicada; usa `npm install --legacy-peer-deps`).
- **Sin comentarios salvo que aporten contexto** sobre *por qué* se hace algo (no *qué*).
- **Mobile-first**: probar la UI en viewport móvil antes que en escritorio.

## Supabase

- **Usar las capas existentes** (`src/lib/supabase*.ts`): si existe una función que cubre la operación, no escribir `supabase.from(...)` directo en un componente.
- **Respetar la RLS existente**: hoy la base es mayormente permisiva (ver ARCHITECTURE.md / DEC-005). Al trabajar con datos sensibles (`profiles`, PINs, pagos) no asumir que la BD protege: seguir validando en frontend hasta que se refuerce RLS.
- **Mantener tipos sincronizados**: si se añade una columna o tabla, actualizar los tipos de `src/types/` y, si es relevante, la spec correspondiente.
- **No ejecutar migraciones SQL** sin revisarlas en el contexto del esquema real (hay scripts sueltos en la raíz y migraciones en `supabase/migrations/`). Registrar el cambio en el SDD si modifica comportamiento.
- **Realtime**: seguir el patrón actual (`supabase.channel(...).on("postgres_changes", ...)`) y añadir siempre un mecanismo de respaldo por polling cuando el dato sea crítico (patrón del módulo hockey).

## UI/UX

- **Diseño mobile-first**: la mayoría de usuarios usa la app desde el móvil (PWA instalable). Todo lo nuevo debe verse y usarse bien en pantallas pequeñas.
- **Consistencia visual**: Tailwind con la paleta del club (`#0A1F44` navy, blue-700) y los estilos existentes. Mantener gradientes, botones y tarjetas similares a los actuales.
- **No crear nuevos patrones de navegación** sin motivo: la app navega con react-router y botones de atrás propios. Si un patrón ya existe (banners, modales, overlays de partido), reutilízalo.
- **Feedback al usuario**: errores y vacíos visibles; estados de carga claros.

## OpenCode

### Antes de implementar

1. Leer `docs/README.md`.
2. Revisar `docs/PRODUCT.md` (estado y scope de módulos).
3. Revisar `docs/ARCHITECTURE.md` (stack real, riesgos, inconsistencias conocidas).
4. Buscar specs relacionadas en `docs/specs/`.
5. Revisar decisiones relacionadas en `docs/decisions/`.
6. Analizar el código actual (el código manda sobre la documentación).

### Después de implementar

1. Comprobar el build con `npm run build` (incluye `tsc`).
2. Comprobar TypeScript (cubierto por el build; corregir errores de tipos).
3. Comprobar las funcionalidades afectadas (routing, permisos, datos, realtime, PWA).
4. Ejecutar `npm run lint` si es posible sin romper el proyecto.
5. **Actualizar el SDD si corresponde** (spec si cambia comportamiento; decisión solo si hay decisión arquitectónica relevante).