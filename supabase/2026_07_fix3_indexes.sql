-- supabase/2026_07_fix_indexes.sql
-- AUDITORIA-2026-07 B1 + B11.
-- Aplicar a mano en el SQL Editor. Con las tablas al tamaño actual los CREATE
-- INDEX normales son instantáneos; si algún día superan ~1M filas, usar
-- CREATE INDEX CONCURRENTLY (fuera de transacción, sentencia a sentencia).

-- ============================================================================
-- B1: el aprovisionamiento del webhook (provision-registration/provision-guest)
-- resuelve cuentas con .eq('email', lowercase) y asume que profiles.email está
-- SIEMPRE en minúsculas. Nada garantizaba ese invariante: una fila con
-- mayúsculas → miss → createUser duplicado (GoTrue es case-insensitive) →
-- 500 en bucle de retries de Stripe con dinero cobrado y cuenta sin aprovisionar.
-- ============================================================================

-- Diagnóstico previo: ¿hay duplicados que impedirían el unique?
--   select lower(email), count(*) from public.profiles
--   where email is not null group by 1 having count(*) > 1;
-- Si devuelve filas, resolver a mano ANTES de continuar.

-- Backfill del invariante:
update public.profiles set email = lower(email)
  where email is not null and email <> lower(email);

-- Y fijarlo para siempre:
create unique index if not exists profiles_email_lower_uniq
  on public.profiles (lower(email))
  where email is not null;

-- ============================================================================
-- B11: FKs sin índice en el camino de borrado de cuenta. Cada DELETE en
-- auth.users/profiles dispara cascades que hacían seq-scan de estas tablas.
-- (Los índices existentes llevan otra columna en cabeza: idx_comments_post_created
-- empieza por post_id, add_indexes por assignment_id, etc.)
-- ============================================================================
create index if not exists idx_posts_user on public.posts (user_id);
create index if not exists idx_comments_user on public.comments (user_id);
create index if not exists idx_submissions_user on public.submissions (user_id);
create index if not exists idx_course_purchases_course on public.course_purchases (course_id);

-- Validación:
--   select indexname from pg_indexes where schemaname='public'
--   and indexname in ('profiles_email_lower_uniq','idx_posts_user',
--                     'idx_comments_user','idx_submissions_user',
--                     'idx_course_purchases_course');
--   → 5 filas.
