# Migraciones SQL — orden de aplicación y estado

Este repositorio **no** usa la CLI de migraciones de Supabase: los `.sql` de
`supabase/` se aplican a mano en el SQL Editor. Como no hay un orden garantizado
por nombre de fichero, este documento fija el orden correcto y marca qué ficheros
son peligrosos de re-aplicar (AUDITORIA-2026-07 M4).

## Cómo levantar la BD desde cero

El estado canónico es **`supabase/migrations/20260831000000_canonical_schema.sql`**,
un `supabase db dump` de producción del 2026-08-31: 22 tablas, 64 policies, 7
funciones, sin datos.

Refleja producción **tal como está**, con el endurecimiento de mayo y julio ya
dentro. Comprobado: no contiene la policy `"Lessons are viewable by everyone"`
que `rbac_setup.sql` sí recrearía.

### Entorno local (Docker)

```bash
supabase start
```

Aplica sola la migración y `supabase/seed.sql`. No toca ninguna base de datos en
la nube.

### Otro proyecto en la nube

```bash
supabase db push --db-url '<cadena de conexión del destino>'
```

### Regenerar el canónico cuando cambie el esquema de producción

```bash
supabase db dump --linked -f supabase/migrations/<timestamp>_canonical_schema.sql
```

### El camino antiguo, y por qué ya no se usa

Aplicar los 69 ficheros sueltos en orden produce una base de datos **distinta**
de producción: reabre agujeros ya cerrados. Ver la sección siguiente. Se
conservan por valor histórico, no como receta.

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

## Regresión de agosto 2026 — ✅ RESUELTA en producción (2026-08-11)

`scripts/verify-anon-read.ts` pasa las 6 comprobaciones. `/curso-bachatango`
volvió a responder 200 a visitantes anónimos.


`2026_07_fix2` (B5) revocó a `anon` el SELECT sobre `public.profiles` y se lo
devolvió solo por columnas, dejando `role` fuera a propósito. Correcto en sí,
pero no se revisaron las policies RLS que comprueban el rol leyendo esa columna.
PostgreSQL no garantiza cortocircuito en `OR`, así que evalúa la rama de admin
aunque `is_published = true` ya sea cierta — y para `anon` esa evaluación aborta
el SELECT entero.

Verificado con la anon key contra producción el 2026-08-11:

| Tabla | Lectura anónima |
|---|---|
| `courses` | 🔴 `permission denied for table profiles` |
| `lessons` | 🔴 `permission denied for table profiles` |
| `events` | 🔴 `permission denied for table profiles` |
| `posts` | ✅ OK |
| `profiles` | ✅ OK (columnas sociales) |

Efecto en la app: `/curso-bachatango` responde **404** a todo visitante anónimo,
`/courses` sale vacío y `sitemap.xml` pierde las URLs de curso. El embudo de
venta y la superficie de SEO, muertos.

| # | Fichero | Qué hace | Estado |
|---|---|---|---|
| 1 | `2026_08_fix_anon_read_admin_check.sql` | Añade `public.is_admin()` (SECURITY DEFINER, `search_path` fijado) y reescribe las policies de `courses`, `lessons` y `events` para usarla en lugar de leer `profiles.role` directamente. No relaja el endurecimiento de julio. Idempotente. | ✅ Aplicado 2026-08-11 — `courses` y `events` arreglados, `lessons` no (ver #2) |
| 2 | `2026_08_fix2_lessons_refund_regression.sql` | **Corrige una regresión de #1:** aquella copió la policy de `lessons` de `2026_05_audit4_rls_lessons_null_guard.sql`, pero la versión vigente era la de `2026_07_fix1_refunds.sql`, con `and cp.refunded_at is null`. Sin esa línea, **una compra reembolsada recupera el acceso**. | ⏭️ Superada por #3, que la incluye |
| 3 | `2026_08_fix3_lessons_purchase_check.sql` | Añade `public.has_course_purchase(uuid)` y lo usa en la policy de `lessons`. La rama de compra hacía una subconsulta a `course_purchases`, cuya propia policy lee `profiles.role` y revienta para `anon` — el error se propagaba a `lessons`. Incluye el arreglo de reembolsos de #2. | ✅ Aplicado 2026-08-11 |
| 4 | `2026_08_fix4_course_purchases_policy.sql` | Reescribe `"Admins can view all purchases"` con `public.is_admin()`. Definición vigente leída de `pg_policy` antes de tocarla; las otras dos policies de la tabla no se tocan. | ✅ Aplicado 2026-08-31 |

**#3 contiene lo de #2**, así que aplicar solo #3 es suficiente.

## Consentimiento del art. 103.m — septiembre 2026 · ⛔ SIN APLICAR

**Bloquea el despliegue.** El código del checkout ya escribe
`digital_execution_consent_at` al insertar en `pending_registrations`. Si se
despliega antes de aplicar esta migración, ese insert falla y **la compra deja
de funcionar para todo el mundo**. Aplicar primero, desplegar después.

| # | Fichero | Qué hace | Estado |
|---|---|---|---|
| 1 | `2026_09_digital_execution_consent.sql` | Columna `digital_execution_consent_at` en `pending_registrations` y en `profiles`: evidencia de que el comprador consintió el acceso inmediato y reconoció perder el desistimiento (art. 103.m RDL 1/2007). Sin esa prueba el alumno conserva los 14 días. Aditiva e idempotente. | ⛔ Sin aplicar |

## Contenido editable de la landing — agosto 2026 · ✅ APLICADA (2026-08-13)

| # | Fichero | Qué hace | Estado |
|---|---|---|---|
| 1 | `2026_08_landing_content.sql` | Tablas `landing_stats`, `landing_testimonials` y `landing_faq` (texto en `jsonb` por idioma, español obligatorio por constraint), índices parciales y RLS: lectura pública de lo publicado, escritura solo admin vía `public.is_admin()`. Sembradas con los valores actuales. Idempotente. | ✅ Aplicada |

El seed lo genera `scripts/generate-landing-seed.ts` desde los diccionarios: 3
testimonios y 3 preguntas por 6 idiomas transcritos a mano invitan a erratas.

Verificado tras aplicar: 4/3/3 filas, los 6 idiomas presentes, cifras guardadas
**sin signo** (`25`, no `+25`), e `INSERT` anónimo denegado por RLS.

---

## Analítica de la landing — agosto 2026 · ✅ APLICADA (2026-08-13)

| # | Fichero | Qué hace | Estado |
|---|---|---|---|
| 1 | `2026_08_landing_events.sql` | Tabla `landing_events` (vistas de página sin cookies), índices por fecha y por ruta, y RLS: solo admin lee (vía `public.is_admin()`), nadie escribe con la anon key. Aditiva e idempotente. | ✅ Aplicada |

Verificado tras aplicar: con la anon key, `SELECT` devuelve 0 filas e `INSERT`
falla con *"new row violates row-level security policy"*. Las escrituras van con
service role desde `/api/landing-event`, que valida la ruta contra una allowlist.

Requiere la variable `LANDING_ANALYTICS_SECRET` (ver `CLAUDE.md`). Sin ella la
ruta responde 204 y no guarda nada.

---

## Newsletter — agosto 2026 · ✅ APLICADA (2026-08-12)

| # | Fichero | Qué hace | Estado |
|---|---|---|---|
| 1 | `2026_08_newsletter_consent.sql` | Columnas `consent_ip`, `consent_at`, `consent_source` en `newsletter_subscribers` (prueba de consentimiento, RGPD art. 7.1) + índice parcial sobre `unsubscribed_at`. Aditiva e idempotente. | ✅ Aplicada |

Verificado contra producción: un upsert con el payload exacto de
`subscribeNewsletter` (incluidas las tres columnas nuevas) se acepta.

La tabla tenía **0 filas** al escribir la migración (2026-08-12), así que el
backfill es un no-op y el riesgo es nulo.

Requiere además la variable `NEWSLETTER_UNSUBSCRIBE_SECRET` (ver `CLAUDE.md`).
Sin ella el email de bienvenida **no se envía**: no podría llevar enlace de
baja, y enviar comunicación comercial sin él incumple el art. 21 de la LSSI.

---

**Deuda que queda (revisada 2026-08-31).** `course_purchases` ya está cerrada
(`2026_08_fix4_course_purchases_policy.sql`). Quedan **12 policies** que siguen
comprobando el rol leyendo `profiles.role` directamente:

| Tabla | Policies |
|---|---|
| `account_deletions`, `contact_submissions`, `newsletter_subscribers` | SELECT de admin |
| `assignments` | SELECT + ALL |
| `comments` | SELECT |
| `submissions` | SELECT + UPDATE |
| `courses`, `lessons` | solo UPDATE y DELETE |

**Ninguna rompe nada hoy.** Comprobado con la anon key el 2026-08-31: las cinco
tablas afectadas (`account_deletions`, `assignments`, `contact_submissions`,
`newsletter_subscribers`, `submissions`) son tablas que `anon` **no debe leer
nunca**, así que fallar es el resultado correcto — solo que falla con
*"permission denied for table profiles"* en vez de devolver cero filas. Las de
`courses` y `lessons` son UPDATE/DELETE, que no intervienen en un SELECT.

El riesgo es latente, no actual: si alguna policy de una tabla pública llegara a
subconsultar una de estas —exactamente lo que pasó con `lessons` →
`course_purchases`— volvería a romperse la lectura anónima. Migrarlas todas a
`public.is_admin()` es mejora de robustez, no corrección de un fallo, y toca
policies de tablas sensibles: merece su propia migración y su propia validación.

**Lección para futuras migraciones de RLS:** antes de recrear una policy, comprobar
cuál es la definición **vigente** en la BD (`pg_policy`), no la del fichero que
parezca canónico. En este repo varias migraciones recrean la misma policy por
nombre, así que el fichero más descriptivo no es necesariamente el más reciente.

Tras aplicarlo, ejecutar la sección **VALIDACIÓN** del propio fichero. La
comprobación crítica es que `GET /rest/v1/profiles?select=role` con la anon key
**siga fallando**: si empieza a funcionar, el endurecimiento se ha roto.

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
