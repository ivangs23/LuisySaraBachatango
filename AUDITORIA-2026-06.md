# Auditoría exhaustiva — Junio 2026

**Objetivo:** validar la app para ~1000 usuarios simultáneos.
**Fecha:** 2026-06-10 · **Alcance:** rendimiento, seguridad, base de datos, Stripe, calidad de código.

## Veredicto

**APTO con reservas.** La app está en muy buen estado: la remediación de la auditoría de mayo 2026 se aplicó de forma efectiva y el load test de homepage con 1000 VUs pasó con holgura (p95 = 671 ms, 0.005% errores). No se encontró ningún hallazgo crítico nuevo. Quedan **2 acciones de prioridad alta** antes de confiar en los 1000 concurrentes: ejecutar el load test del flujo autenticado y verificar la cuota de conexiones Realtime de Supabase.

## Estado verificado (junio 2026)

| Verificación | Resultado |
|---|---|
| Tests unitarios/integración | ✅ 450 pasan, 0 fallan (48 ficheros) |
| Lint | ✅ 0 errores, 20 warnings (deuda documentada) |
| Load test homepage 1000 VU | ✅ PASS (p95 671 ms, 62.118 req, 0.005% error) |
| Load test lección autenticada | ❌ **Nunca ejecutado** |
| Webhook Stripe | ✅ Firma verificada, idempotente, 500→retry en fallo BD |
| RLS | ✅ Policies con `(select auth.uid())` (init-plan), guard de NULL en lessons |
| Middleware | ✅ Omite Supabase Auth para tráfico anónimo en rutas públicas |
| Rate limiting | ✅ Upstash + fallback local en checkout, monitoring, acciones |
| Índices BD | ✅ Aplicados en migraciones (`2026_05_audit_indexes.sql`, `add_indexes.sql`) |
| Conexiones Postgres | ✅ Todo vía PostgREST/HTTP — sin riesgo de agotar el pool |
| Uploads | ✅ Validación de magic bytes, no solo MIME |
| Secretos | ✅ Sin claves hardcodeadas; service role solo en servidor |

## Hallazgos

### ALTO

**A1. El flujo autenticado de lección no está validado bajo carga.**
`docs/load-test-2026-05-results.md` lo declara "NOT YET RUN". Es la ruta más cara del sistema: RLS con 3 subqueries EXISTS sobre `lessons`, 8 queries por página y firma de JWTs de Mux. El test de homepage no la cubre. Con 1000 usuarios, la mayoría estará viendo lecciones, no la portada.
*Acción:* ejecutar `loadtest/scenarios/lesson-flow.js` (500 VUs sostenidos, criterio p95 < 2500 ms) contra un Preview Deployment con usuario de prueba. ~1 h.

**A2. Cuota de conexiones Realtime de Supabase sin verificar.**
`components/NotificationBell.tsx:87` abre un canal Realtime por usuario logueado. 1000 usuarios simultáneos = ~1000 websockets concurrentes; el plan Pro tiene una cuota de pico de conexiones Realtime que puede quedarse corta. El fallback (poll cada 5 min) amortigua el fallo, pero las notificaciones llegarían con retraso.
*Acción:* revisar Dashboard Supabase → Settings → Realtime y subir la cuota si el pico permitido es < 1500. ~15 min.

### MEDIO

**M1. El cliente descarga los 6 idiomas.**
`context/LanguageContext.tsx:5` importa `utils/dictionaries.ts` completo (~80 KB fuente, ~15-20 KB gzip en bundle) aunque el usuario use un solo idioma. Ya está reconocido como deuda en el propio fichero; el servidor sí carga solo el locale activo (`get-dict.ts`).
*Acción:* carga dinámica del diccionario por locale en el cliente (`import()` + estado). Afecta a TTI en móvil, no al servidor.

**M2. `verifyStripeSession` no valida la propiedad de la sesión.**
`app/profile/actions.ts:171` — un usuario autenticado puede pasar cualquier `session_id` y saber si está pagado. No persiste nada (el webhook es la fuente de verdad), así que el impacto es solo divulgación menor.
*Acción:* comprobar `session.metadata?.userId === user.id` antes de responder. 5 min.

**M3. Migraciones SQL de aplicación manual — confirmar en producción.**
`docs/audit-2026-05-followups.md` lista 5 migraciones que debían aplicarse a mano (RLS de courses/lessons, índices, archive de notifications). Las migraciones posteriores (`audit2`–`audit4`) sugieren que se continuó el trabajo, pero desde el código no puede verificarse el estado real de la BD.
*Acción:* ejecutar las queries de validación listadas en ese mismo doc contra producción (member no ve cursos sin publicar, lección de pago devuelve 0 filas sin acceso, etc.). ~20 min.

### BAJO (deuda documentada y aceptada — sin cambios necesarios ahora)

- **B1.** Webhook Stripe síncrono: aceptable hasta >5 eventos/s sostenidos; entonces, encolar (Inngest/Supabase queue).
- **B2.** CSP con `'unsafe-inline'` en `script-src`: mitigado por `frame-ancestors 'none'` y sanitización (`safeJsonLd`, `sanitizeUrl`); el nonce per-request queda diferido.
- **B3.** `COUNT exact` en dashboards admin: lineal en filas, aceptable hasta ~100k.
- **B4.** 20 warnings de lint (react-hooks legacy, 4 `<img>` técnicos justificados, vars sin usar en scripts/seeds).
- **B5.** Caché de tokens Mux 20 min por (playbackId, userId): correcto; la revocación de acceso tarda como máximo 30 min (TTL del JWT) — asumido por diseño.

## Hallazgos de agentes descartados tras verificación

Para transparencia, estas afirmaciones de la fase de exploración **se comprobaron falsas** contra el código actual: `/api/mux/status` sí exige auth + rol admin (`route.ts:13-16`); el webhook no permite inyectar userId (la firma de Stripe cubre la metadata, escrita solo por `/api/checkout`); la página de lección no tiene N+1 (2 lotes con `Promise.all` + sidebar cacheado 5 min); no falta el índice `subscriptions(user_id, status)` (existe en `2026_05_audit_indexes.sql:11`); el `force-dynamic` solo está en `/admin/*`, donde es correcto; y `make_date(NULL,…)` ya tiene guard (`2026_05_audit4_rls_lessons_null_guard.sql`).

## Capacidad estimada para 1000 concurrentes

- **Vercel (SSR):** validado a 204 req/s sostenidos con picos de 280; escala horizontal automática. Sin riesgo.
- **Supabase Postgres:** acceso 100% vía PostgREST (multiplexado), índices de acceso en su sitio, RLS optimizada con init-plan. Riesgo bajo; vigilar `pg_stat_statements` durante el primer pico real (runbook ya existe: `docs/runbook-scaling.md`).
- **Supabase Realtime:** punto más incierto — ver A2.
- **Mux:** tokens cacheados 20 min por usuario/lección; el streaming lo sirve la CDN de Mux, no la app. Sin riesgo (vigilar coste de minutos de visionado).
- **Stripe:** picos de compra simultánea cubiertos por idempotencia (UNIQUE en `stripe_session_id`, upsert por `subscription.id`) y race guards en creación de customer.

## Plan de acción priorizado

| # | Acción | Esfuerzo | Cuándo |
|---|---|---|---|
| 1 | Ejecutar load test `lesson-flow.js` (A1) | 1 h | Antes del evento de carga |
| 2 | Verificar cuota Realtime (A2) | 15 min | Antes del evento de carga |
| 3 | Validar migraciones manuales en prod (M3) | 20 min | Esta semana |
| 4 | Check de propiedad en `verifyStripeSession` (M2) | 5 min | Esta semana |
| 5 | Diccionarios por locale en cliente (M1) | 2-4 h | Cuando convenga |
| 6 | Día del pico: monitorizar Sentry + `pg_stat_statements` + Vercel Functions | — | Durante |
