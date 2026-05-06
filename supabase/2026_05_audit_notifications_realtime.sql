-- Habilita suscripciones Realtime sobre cambios en `notifications`.
-- Sin esto la suscripción client-side recibe el `subscribe()` ack pero
-- nunca eventos de INSERT/UPDATE.

-- 1) Añadir la tabla a la publication usada por Supabase Realtime.
do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- 2) REPLICA IDENTITY FULL: garantiza que DELETE incluye la fila completa
--    en el WAL para que el cliente reciba el old record.
alter table public.notifications replica identity full;
