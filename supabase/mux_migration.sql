-- Adds Mux-related columns to lessons. Additive only; old columns remain until cleanup (see mux_cleanup.sql).
-- Idempotent: safe to re-run.

alter table lessons add column if not exists mux_asset_id text;
alter table lessons add column if not exists mux_playback_id text;
alter table lessons add column if not exists mux_upload_id text;
alter table lessons
  add column if not exists mux_status text not null default 'pending_upload'
  check (mux_status in ('pending_upload','preparing','ready','errored'));

create index if not exists idx_lessons_mux_asset on lessons (mux_asset_id) where mux_asset_id is not null;
create index if not exists idx_lessons_mux_upload on lessons (mux_upload_id) where mux_upload_id is not null;
