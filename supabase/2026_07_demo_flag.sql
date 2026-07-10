-- Flag para identificar y limpiar datos creados en modo demo.
alter table course_purchases
  add column if not exists is_demo boolean not null default false;
