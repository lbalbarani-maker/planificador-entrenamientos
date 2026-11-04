# SDD — Specification-Driven Development

Este proyecto utiliza **Specification-Driven Development (SDD)**: los documentos de la carpeta `docs/` son la **fuente de verdad** del proyecto Club OS / Sanse Complu.

Antes de implementar una funcionalidad nueva o modificar una existente, **revisar las especificaciones y decisiones relacionadas y actualizar el SDD cuando la implementación cambie el comportamiento o la arquitectura del sistema**.

---

## Qué es este SDD

Un conjunto de documentos concisos y mantenibles que describen:

- **Qué hace el producto** (módulos y su estado real).
- **Cómo está construido** (arquitectura verificada).
- **Qué reglas seguir** al escribir código.
- **Qué comportamiento concreto tiene cada módulo** (especificaciones).
- **Qué decisiones arquitectónicas se han tomado** (para no repetirlas ni revertirlas por error).

La documentación describe **el estado real del código**, no intenciones. Si una funcionalidad está a medias, se marca como **Parcial**.

## Estructura

| Carpeta/Archivo | Contenido |
|---|---|
| `PRODUCT.md` | Qué es el producto, usuarios objetivo y tabla de módulos con su estado. |
| `ARCHITECTURE.md` | Cómo está construido: frontend, Supabase, auth, Realtime, PWA, deploy y seguridad. |
| `CONVENTIONS.md` | Reglas para escribir código y usar Supabase/UI de forma consistente. |
| `specs/` | Especificaciones por módulo. **Una por área funcional.** |
| `decisions/` | Decisiones arquitectónicas (ADRs) de alto impacto. |

## Cómo debe utilizarlo OpenCode

Antes de implementar cualquier nueva funcionalidad o modificar una existente:

1. Analizar el SDD existente (empezar por este `README.md`).
2. Buscar una spec relacionada en `specs/`.
3. Revisar decisiones arquitectónicas relacionadas en `decisions/`.
4. Analizar el código actual (los documentos describen el estado real, pero el código manda).
5. Proponer cambios antes de implementarlos.
6. Implementar.
7. Verificar build/typecheck.
8. Actualizar la spec si el comportamiento ha cambiado.
9. Crear una nueva decisión **solamente** si se ha tomado una decisión arquitectónica relevante.

**NO** crear documentación por cada pequeño cambio. El SDD debe mantenerse ligero; solo se actualiza cuando el comportamiento o la arquitectura cambian de forma significativa.

## Regla para OpenCode

> **Antes de trabajar, leer `docs/README.md` y las specs relacionadas.**
>
> En cada sesión de desarrollo:
> 1. Leer `docs/README.md`.
> 2. Revisar `docs/PRODUCT.md` para conocer módulos y su estado.
> 3. Revisar `docs/ARCHITECTURE.md` para conocer el stack real.
> 4. Buscar specs relacionadas en `docs/specs/`.
> 5. Revisar decisiones relacionadas en `docs/decisions/`.
> 6. Implementar respetando `docs/CONVENTIONS.md`.
> 7. Verificar build y sanity de las funcionalidades afectadas.
> 8. Actualizar el SDD solo si el comportamiento o la arquitectura han cambiado.