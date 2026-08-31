-- ============================================================================
-- Última policy con el patrón que tumbó el embudo en julio.
--
-- 2026_07_fix2 revocó a `anon` el SELECT sobre profiles.role, pero varias
-- policies seguían leyéndolo. PostgreSQL no cortocircuita `OR`, así que la
-- rama de admin se evalúa igualmente y el error aborta el SELECT entero.
-- `courses`, `lessons` y `events` ya se arreglaron (fix1 y fix3);
-- `course_purchases` es la que queda.
--
-- Hoy no rompe nada visible: `lessons` dejó de subconsultarla en fix3. Se
-- cierra para que el patrón no vuelva a morder.
--
-- Definición vigente obtenida de pg_policy antes de tocar nada:
--
--   Admins can view all purchases  | SELECT | EXISTS (SELECT 1 FROM profiles
--       WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::app_role)
--
-- Las otras dos policies de la tabla NO se tocan: están limpias.
--   course_purchases_insert_service_only | INSERT | with check (false)
--   Users can view own purchases         | SELECT | auth.uid() = user_id
--
-- Única sustitución: la comprobación de admin pasa a public.is_admin()
-- (SECURITY DEFINER, search_path fijado). Misma semántica.
--
-- Idempotente.
-- ============================================================================

drop policy if exists "Admins can view all purchases" on public.course_purchases;
create policy "Admins can view all purchases" on public.course_purchases
  for select using (public.is_admin());

-- ============================================================================
-- VALIDACIÓN — ejecutar después:
--
--   npx tsx scripts/verify-anon-read.ts        -> 6/6
--   Con la anon key: select * from course_purchases  -> 0 filas o denegado,
--     NUNCA filas con datos de compras ajenas.
-- ============================================================================
