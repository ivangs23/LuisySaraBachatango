-- ============================================================================
-- `profiles.created_at`: fecha de alta real del alumno.
--
-- Por qué: la tabla nunca tuvo columna de alta, así que el panel usaba
-- `updated_at` como sustituto (lo decía por escrito en utils/admin/queries.ts).
-- Pero `handle_new_user` inserta solo (id, email, full_name) y `updated_at` no
-- tiene default: queda NULL hasta que el alumno edita su perfil, cosa que casi
-- nadie hace. Medido el 2026-09-02: 17 de 18 perfiles con `updated_at` NULL, y
-- el panel mostraba «1 nuevo esta semana» cuando habían sido 9.
--
-- `updated_at` se queda como lo que de verdad es —la última edición del perfil,
-- que app/profile/actions.ts sí escribe— y pasa a alimentar solo «última
-- actividad». El alta se lee de `created_at`.
--
-- Idempotente.
-- ============================================================================

-- 1. Columna nullable primero. Crearla ya con `default now()` pondría la fecha
--    de HOY a todos los perfiles existentes y perdería el histórico real.
alter table public.profiles
  add column if not exists created_at timestamptz;

-- 2. Histórico desde la fuente de verdad: la cuenta de auth.
update public.profiles p
set    created_at = u.created_at
from   auth.users u
where  u.id = p.id
  and  p.created_at is null;

-- 3. Red de seguridad para un perfil sin cuenta auth (no debería existir; si
--    existe, es preferible una fecha aproximada a bloquear el NOT NULL).
update public.profiles
set    created_at = coalesce(updated_at, now())
where  created_at is null;

-- 4. Perfiles que faltan. Dos cuentas anteriores al trigger actual se quedaron
--    sin fila —una de ellas con una compra real de 199 €— y por eso no salían
--    en /admin/alumnos ni contaban en «Alumnos totales». `role` toma su default
--    ('member') y `updated_at` se queda NULL: nunca han editado su perfil.
insert into public.profiles (id, email, full_name, created_at)
select u.id, u.email, u.raw_user_meta_data->>'full_name', u.created_at
from   auth.users u
left   join public.profiles p on p.id = u.id
where  p.id is null;

-- 5. Ahora sí: default para las altas nuevas y NOT NULL para que no se repita.
--    El default cubre a `handle_new_user` sin tener que tocar la función.
alter table public.profiles
  alter column created_at set default now();

alter table public.profiles
  alter column created_at set not null;

-- ============================================================================
-- VALIDACIÓN — ejecutar después:
--
--   select count(*) from public.profiles where created_at is null;   → 0
--
--   -- Ningún perfil sin cuenta ni cuenta sin perfil:
--   select count(*) from auth.users u
--     left join public.profiles p on p.id = u.id where p.id is null; → 0
--
--   -- La cifra del panel debe coincidir con la realidad:
--   select (select count(*) from public.profiles
--             where created_at >= now() - interval '7 days') as panel,
--          (select count(*) from auth.users
--             where created_at >= now() - interval '7 days') as real;
--                                                            → iguales
-- ============================================================================
