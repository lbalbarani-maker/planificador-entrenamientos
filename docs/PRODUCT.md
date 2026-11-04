# PRODUCT.md — Club OS / Sanse Complu

## Nombre

**Club OS / Sanse Complu** — App de gestión integral del club de hockey Sanse Complu.

## Propósito

Plataforma única para gestionar el día a día del club: equipos, jugadoras, entrenamientos, partidos con seguimiento en vivo, convocatorias, torneos, loterías, tienda y notificaciones. Sirve tanto a la directiva y cuerpo técnico como a jugadoras, familias y público que sigue los partidos.

## Usuarios objetivo

- **Directiva y staff del club** (admin, admin_club, coordinador, delegado, tesorero): gestión global, usuarios, equipos, finanzas, loterías, notificaciones masivas.
- **Cuerpo técnico** (entrenador, preparador): entrenamientos, ejercicios, convocatorias, partidos en vivo.
- **Jugadoras y familias** (jugador, padre): consultar convocatorias y aceptarlas/declinarlas, ver su próximo partido, comprar números de lotería, seguir partidos en vivo.
- **Público externo**: seguir un partido en vivo (modo espectador por enlace compartido), ver loterías públicas, consultar entrenamientos compartidos, tienda.

## Problema que resuelve

Concentrar la operativa del club en una sola app accesible desde el móvil (PWA), eliminando papeles, grupos de WhatsApp y hojas de cálculo dispersas, y ofreciendo **seguimiento en vivo de partidos** para las familias que no pueden asistir.

## Filosofía del producto

- **Mobile-first**: la mayoría de usuarios accede desde el teléfono (PWA instalable).
- **Una sola fuente de datos**: Supabase como base de datos única para todos los módulos.
- **Acceso sencillo**: sesiones por email + PIN para usuarios internos; enlaces públicos para compartir (partidos en vivo, entrenamientos, loterías).
- **En vivo**: los partidos se transmiten con marcador, cronómetro, eventos y reacciones del público en tiempo real.
- **Evolución incremental**: cada módulo se añade cuando aporta valor real al club.

## Módulos y estado actual

Estado verificado en el código del repositorio. Leyenda: **Implementado** (funcional de principio a fin), **Parcial** (funcionando con limitaciones o inconsistencias), **Inseguro/Riesgo** (implementado pero con problemas de seguridad o fiabilidad detectados).

| Módulo | Estado | Descripción |
|---|---|---|
| Usuarios | Implementado | CRUD de usuarios, roles, relaciones a jugadoras/equipos y activación/desactivación. Usa login custom (email + contraseña + PIN opcional) contra la tabla `profiles`. |
| Roles y permisos | Parcial | Roles como cadena CSV en `profiles.role` (`admin`, `admin_club`, `entrenador`, `preparador`, `coordinador`, `delegado`, `tesorero`, `jugador`, `padre`) con permisos por dashboard/API. **No aplica en el módulo hockey**, donde el control se protege con PIN. |
| Equipos | Implementado | CRUD de equipos, plantilla de jugadoras (`team_players` con dorsal y posición), eventos por equipo (entrenamientos y partidos). |
| Jugadoras | Implementado | CRUD de jugadoras con dorsal, posición, género, relaciones con padres y exportación/importación XLSX. |
| Partidos | Implementado | Eventos de tipo `match` (con marcador local/rival) + partidos de hockey dedicados (`hockey_matches`) con stream de YouTube, sponsor y enlace compartido. |
| Seguimiento en vivo | Implementado | Panel admin de partido: marcador, cronómetro por cuartos, goles, tarjetas, paradas, penalty/stroke, shootouts e incidencias, con Realtime + polling. |
| Modo espectador | Implementado | Vista pública por `share_token` con marcador en vivo, cronómetro, eventos overlay, vídeo y reacciones. No requiere login. |
| Reacciones | Implementado | Reacciones de público (`clap`, `heart`, `fire`, `muscle`) visibles como animaciones flotantes; se obtienen por polling cada 3s. |
| Entrenamientos | Implementado | Planificación de entrenamientos con ejercicios y categorías, compartibles públicamente por `share_id`. |
| Convocatorias | Implementado | Convocatorias por evento (`convocation`), vista de jugadora/padre (`MyConvocations`), widget de próximo partido en el dashboard y compartición como imagen (html2canvas). |
| Torneos | Parcial | CRUD de torneos, jornadas, clasificaciones (`standings`) y estadísticas `match_events`; presenta incoherencias de esquema (ver ARCHITECTURE.md). |
| Loterías | Implementado | Loterías con bloques de números por jugadora, venta y reserva de tickets, páginas públicas comprador/jugador y patrocinadores. |
| Dashboard | Parcial | KPIs, gráficas, cumpleaños, accesos rápidos, próximos partidos y ventas de lotería con permisos por rol. Algún dato de ejemplo no proviene de BD (`teamPerformance` usa `Math.random()`). |
| Notificaciones | Parcial | Suscripciones push (`push_subscriptions`), edge function `send-push`, panel admin de envío y prefs por usuario. **La visualización de notificaciones push en el SW no está operativa** (ver PWA/ARCHITECTURE). |
| PWA | Parcial | Instalable con service worker (vite-plugin-pwa), offline parcial y banner de actualización. El SW generado no incluye los handlers de push de `src/sw.ts`. |
| Tienda | Parcial | Tienda oficial (enlace estático a Futbol Emotion + acceso con contraseña) y marketplace del club (`marketplace_items`) con contacto por WhatsApp (placeholder sin verificar) y venta de merchandising. |
| Clubes | Implementado | CRUD de clubes (solo admin), con logo y colores. |
| Ubicaciones | Implementado | Pistas/canchas (`locations` con superficie, parking, vestuarios, enlace Google Maps) y equipos rivales. |
| Configuración | Implementado | Sección admin (`/configuracion`) con mantenimiento de Supabase: cron diario (keep-alive) que hace una lectura ligera y registra cada ejecución en `cron_runs`; muestra estado, última ejecución automática/manual (UTC) y botón "Ejecutar ahora". |

## Nota sobre el estado de los datos (riesgos reales)

Documentados en `ARCHITECTURE.md` para que no se tomen como decisión de diseño:

- RLS mayoritariamente abierta (políticas `USING(true)`) para varias tablas; sin políticas verificables en el repo para `profiles` y tablas `hockey_*`.
- Auth custom con hash débil (`simpleHash`) para contraseñas/PIN en `profiles`.
- Cronómetro de partidos basado en reloj local de cada dispositivo (posible deriva).

## Módulos planificados / futuros

No hay funcionalidades inventadas. El documento `MEJORAS/MEJORAS EVOLUCION APP CLUB.docx` contiene ideas y mejoras del club, fuera del scope de esta documentación.