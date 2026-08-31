-- ============================================================================
-- Trigger de auth.users que el volcado canónico NO recoge.
--
-- `supabase db dump` vuelca solo el esquema `public`, y este trigger vive en
-- `auth.users`. Sin él, cualquier entorno reconstruido desde el canónico crea
-- usuarios SIN perfil: el registro parece funcionar y luego nada tiene rol.
--
-- Detectado al levantar el entorno local: el seed insertaba el admin en
-- auth.users pero `profiles` quedaba vacía.
--
-- Definición copiada literal de producción (pg_get_triggerdef).
--
-- Afecta también a recuperación ante desastres: reconstruir producción solo
-- con el volcado dejaría el registro de usuarios roto.
--
-- Idempotente.
-- ============================================================================

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
