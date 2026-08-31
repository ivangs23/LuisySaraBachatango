-- ============================================================================
-- DIAGNÓSTICO — solo lee el catálogo. No modifica nada.
--
-- Localiza toda policy del esquema public que lea `profiles` directamente.
-- Cualquiera de ellas revienta para `anon`, porque 2026_07_fix2 le quitó el
-- SELECT sobre profiles.role. Basta con que UNA participe en la evaluación
-- de una consulta para tumbarla entera — incluso indirectamente, cuando la
-- policy de una tabla hace una subconsulta sobre otra.
-- ============================================================================

-- (1) ¿Qué policies leen profiles, y sobre qué tabla están?
select
  c.relname                                as tabla,
  p.polname                                as policy_name,
  case p.polcmd
    when 'r' then 'SELECT' when 'a' then 'INSERT' when 'w' then 'UPDATE'
    when 'd' then 'DELETE' when '*' then 'ALL'
  end                                      as command,
  pg_get_expr(p.polqual, p.polrelid)       as using_expression
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and pg_get_expr(p.polqual, p.polrelid) ilike '%profiles%'
order by c.relname, command, p.polname;

-- (2) La policy SELECT de lessons, completa y sin truncar.
--     Debe contener `is_admin()` y NO `FROM profiles`.
select pg_get_expr(polqual, polrelid) as lessons_select_using
from pg_policy
where polrelid = 'public.lessons'::regclass
  and polcmd = 'r';

-- (3) ¿is_admin() quedó bien creada? prosecdef debe ser true.
select
  p.proname,
  p.prosecdef            as security_definer,
  pg_get_userbyid(p.proowner) as owner,
  p.proconfig            as settings
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'is_admin';

-- (4) ¿Qué columnas de profiles puede leer anon? `role` NO debe aparecer.
select column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'profiles'
  and grantee = 'anon'
order by column_name;
