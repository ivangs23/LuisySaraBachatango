-- Origen de cada compra: 'web' | 'landing'.
alter table course_purchases add column if not exists source text;
