-- Limpieza de datos de prueba creados en modo demo. REVISA antes de ejecutar.
-- Borra las compras demo y los usuarios creados en demo (cascada a profiles y
-- a las compras restantes de esos usuarios).
delete from course_purchases where is_demo = true;
delete from auth.users
  where (raw_user_meta_data->>'is_demo')::boolean is true;
