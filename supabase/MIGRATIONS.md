# Migraciones SQL — orden de aplicación y estado

Este repositorio **no** usa la CLI de migraciones de Supabase: los `.sql` de
`supabase/` se aplican a mano en el SQL Editor. Como no hay un orden garantizado
por nombre de fichero, este documento fija el orden correcto y marca qué ficheros
son peligrosos de re-aplicar (AUDITORIA-2026-07 M4).

## Cómo levantar la BD desde cero

El estado canónico es `schema.sql` **más** los parches aditivos posteriores.
Aplicar en este orden por bloques:

1. `schema.sql` (tablas base, RLS inicial, `handle_new_user`).
2. Los parches de features (por fecha/tema): `rbac_setup.sql`, `course_types.sql`,
   `course_purchases*.sql`, `events.sql`, `lesson_hierarchy.sql`,
   `assignments_submissions.sql`, `community_setup.sql`, `comments_setup.sql`,
   `notifications*.sql`, `enhanced_upload.sql`, `mux_migration.sql`, etc.
3. Los endurecimientos de auditoría de mayo 2026 (`2026_05_audit*.sql`), en orden
   numérico (`audit` → `audit2` → `audit3` → `audit4`).
4. Los cambios de julio 2026 (`2026_07_*.sql`), en orden numérico.
5. Los **fixes de la auditoría de julio 2026** (ver abajo), en orden `fix1`→`fix4`.

## ⚠️ Ficheros peligrosos de re-aplicar sobre una BD ya endurecida

Un replay léxico "de todo el repo" REABRE agujeros ya cerrados. NO re-aplicar
estos sobre producción sin revisar:

- `rbac_setup.sql` — recrea `Lessons/Courses viewable by everyone using (true)`,
  deshaciendo el paywall de `2026_05_audit_rls_lessons/courses.sql`.
- `events.sql` — recrea `set_events_updated_at()` sin `search_path`, deshaciendo
  `2026_07_events_trigger_search_path.sql`.
- `full_setup.sql` / `schema.sql` (bloque `handle_new_user`) — recrean la función
  sin pin de `search_path`, deshaciendo `2026_05_audit2_handle_new_user_safe.sql`.

Si hay que recrear el esquema, lo recomendable es un `supabase db dump` del estado
real de producción como nuevo `schema_canonical.sql` y trabajar desde ahí.

## Fixes de la auditoría de julio 2026 — ✅ APLICADOS en producción (2026-07-19)

Aplicados vía el conector de Supabase contra el proyecto `jytokoxbsykoyifzbjkd`
(migraciones `audit_2026_07_fix1..fix5` en el historial de Supabase). Los
prechecks salieron limpios (0 emails duplicados, 0 cursos con `is_published`
NULL, 0 comentarios huérfanos) y las 12 comprobaciones post-aplicación pasaron.

| # | Fichero | Qué hace | Estado |
|---|---|---|---|
| 1 | `2026_07_fix1_refunds.sql` | Columnas `refunded_at` + `stripe_payment_intent` en `course_purchases`; RLS de lessons ignora compras reembolsadas. | ✅ Aplicado |
| 2 | `2026_07_fix2_security_hardening.sql` | Cierra auto-calificación por INSERT (M1), foro legible por anon (M2), escalada de rol por INSERT (M3), `role` visible por anon (B5), gating de `assignments` (B9), `coalesce(is_published)` (B10), constraint XOR en comments. | ✅ Aplicado (constraint validada directa: 0 filas huérfanas) |
| 3 | `2026_07_fix3_indexes.sql` | `unique index on lower(email)` (B1) + índices FK de los cascades (B11). | ✅ Aplicado |
| 4 | `2026_07_fix4_last_admin_atomic.sql` | Función `set_user_role` con guard atómico del último admin (B8). | ✅ Aplicado |
| 5 | `2026_07_fix5_definer_function_lockdown.sql` | Revoca EXECUTE de anon/authenticated en `handle_new_user` y `upsert_notification` (hallazgo del advisor 0028/0029). | ✅ Aplicado |

### Pendiente NO-SQL tras aplicar

- **Stripe** → Developers → Webhooks → endpoint de prod: añadir los eventos
  `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed` (los usa
  el handler de fix1).
- **Supabase** → Authentication → Policies: activar **Leaked Password
  Protection** (advisor lo marca deshabilitado; es un toggle gratis, alto valor).

### Backlog opcional (advisors, no bloqueante)

- 2 buckets públicos permiten listado (`mux-track-sources`, `thumbnails`) —
  tradeoff documentado (Mux/thumbnails se sirven por URL); bajo riesgo.
- ~34 policies con `auth.uid()` sin envolver en `(select auth.uid())` (perf
  init-plan) y ~30 policies permisivas duplicadas (p. ej. dos policies DELETE
  casi idénticas en `comments`). Optimización de rendimiento, no seguridad.
- Índices FK nuevos aparecen como "unused" en el advisor: es normal, aún no han
  recibido tráfico.

Cada fichero lleva sus queries de validación comentadas al final.
