# Audit 2026-05 — follow-ups diferidos

Hallazgos de la auditoría completa del 2026-05-06 que NO se abordaron en la rama `chore/audit-remediation` y la razón. Reabrir cuando los criterios cambien.

## Operativos

### Webhook Stripe asíncrono / encolado

**Estado:** diferido.
**Razón:** el volumen actual (suscripciones puntuales) está muy por debajo del umbral donde el handler síncrono se vuelve un cuello de botella. Si en el futuro se ven >5 eventos/seg sostenidos o timeouts en logs de Vercel, mover el procesamiento a una cola (p. ej. Supabase queue, Inngest) y responder 200 inmediatamente tras encolar.

### COUNT exact en dashboards admin

**Estado:** aceptado.
**Razón:** `select('id', { count: 'exact' })` es lineal en filas pero hoy el universo es <10k usuarios y <500 cursos. Por encima de ~100k filas, sustituir por estimaciones de `pg_stat_user_tables` o vistas materializadas.

### `session_id` de Stripe en query string al volver al perfil

**Estado:** aceptado.
**Razón:** la URL `/profile?session_id=...` solo es útil para confirmar el pago durante la ventana de retorno. El handler ya no escribe en BD (Task 2.3) y la información que expone es no-PII. Mientras la app sea HTTPS-only y los logs roten <30 días, el riesgo es bajo. Reconsiderar si se añade tracking externo que registre URLs completas.

## Lint / calidad

### 26 warnings de lint pre-existentes

**Estado:** dejados como warnings.
**Razón:** son `react-hooks` y similares en código legacy que no era objetivo de la auditoría. La migración de `main` a 0 errores se hizo en Task 0.2; los warnings se pueden limpiar en su propia rama.

## Diferidos por scope

### CSP sin nonce (queda `'unsafe-inline'` en `script-src`)

**Estado:** parcial.
**Razón:** Next.js inyecta scripts inline (runtime config, JSON-LD) que requieren `'unsafe-inline'` salvo que se implemente nonce per-request. Eso requiere middleware adicional y propagar el nonce a cada `<script>`. Reabrir cuando el equipo decida invertir el día/dos en hacer el nonce. La CSP actual aún protege con `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`.

### LanguageContext lazy initializer escribe `document.cookie` durante render

**Estado:** aceptado.
**Razón:** detectado en review post-Task 0.2. Es una violación menor de las reglas de React (efectos en render), pero funcional y observable=cero. Mover a `useEffect` aumentaría el flicker de hidratación. Reconsiderar si React 19+ empieza a fallar con strict mode.

### `<img>` raw que sobreviven (4 sitios)

**Estado:** aceptado por incompatibilidad técnica (Task 6.2).
**Razón:** son previews `URL.createObjectURL(blob)` que `next/image` no maneja, o un fallback dinámico a `ui-avatars.com` que no está en `remotePatterns`. Documentado en la propia Task 6.2.

## Acción humana pendiente

Las siguientes migraciones SQL están commiteadas en la rama pero NO se aplican automáticamente. Aplicarlas manualmente en el dashboard de Supabase / vía CLI **antes** de mergear a main:

- `supabase/2026_05_audit_rls_courses.sql`
- `supabase/2026_05_audit_rls_lessons.sql`
- `supabase/2026_05_audit_course_purchases_insert.sql`
- `supabase/2026_05_audit_indexes.sql`
- `supabase/2026_05_audit_notifications_archive.sql`

Validación post-aplicación:
- `select * from courses where is_published = false` ejecutado como member → 0 filas.
- `select * from lessons where is_free = false and course_id = '<paid>'` ejecutado como member sin compra → 0 filas.
- `insert into course_purchases (...)` desde sesión de usuario → error de RLS.
- `\d+ notifications` muestra `deleted_at timestamptz` y el partial index `idx_notifications_active`.

## Verificación end-to-end recomendada antes de merge

- [ ] Aplicar las 5 migraciones SQL en el branch de Supabase.
- [ ] Test manual: signup, login, checkout en modo test, lección sin acceso (404), lección con suscripción, comentario + reply.
- [ ] Logs de Supabase Auth: tras Task 3.2, los hits a `/` y `/courses` sin sesión NO deben pegarle a `auth.getUser`.
- [ ] Verificar que la cookie `locale` viene con `Secure; SameSite=Lax` desde DevTools.
- [ ] Smoke test en producción tras merge: login, ver una lección, hacer un comentario.
