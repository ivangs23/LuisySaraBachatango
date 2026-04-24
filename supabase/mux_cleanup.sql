-- Run AFTER all code no longer references video_url, video_source, or media_config.
-- Idempotent.

alter table lessons drop column if exists video_url;
alter table lessons drop column if exists video_source;
alter table lessons drop column if exists media_config;
