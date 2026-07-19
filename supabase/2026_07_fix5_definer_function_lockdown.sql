-- supabase/2026_07_fix5_definer_function_lockdown.sql
-- AUDITORIA-2026-07 — hallazgo del Supabase advisor (lints 0028/0029), detectado
-- al aplicar los fixes contra producción.
--
-- Dos funciones SECURITY DEFINER quedaron ejecutables por anon/authenticated vía
-- /rest/v1/rpc. La causa es el riesgo de orden de migraciones (M4): un
-- `create or replace function` posterior (p. ej. en la migración de archive de
-- notificaciones) resetea los grants al PUBLIC EXECUTE por defecto, deshaciendo
-- el revoke original de upsert_notification_fn.sql.
--
-- Revocar es seguro porque la app NO las llama por RPC de usuario:
--   - handle_new_user() es solo un trigger AFTER INSERT en auth.users
--     (los triggers se ejecutan sin depender del privilegio EXECUTE del rol).
--   - upsert_notification(...) se invoca solo desde el service role
--     (utils/notifications/server.ts vía createSupabaseAdmin).

revoke execute on function public.handle_new_user() from public, anon, authenticated;

revoke execute on function
  public.upsert_notification(uuid, uuid, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function
  public.upsert_notification(uuid, uuid, text, text, uuid, text)
  to service_role;

-- Validación:
--   Supabase Dashboard → Advisors → Security: los avisos 0028/0029 para
--   handle_new_user y upsert_notification deben desaparecer.
