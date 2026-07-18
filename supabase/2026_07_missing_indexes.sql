-- M8: hot FK lookup columns without a dedicated index -> seq scans as tables grow.
-- comment_likes has UNIQUE(user_id, comment_id) but its leading column is user_id,
-- so lookups/deletes by comment_id alone are not served by it.
create index if not exists comment_likes_comment_id_idx on public.comment_likes (comment_id);
create index if not exists comments_parent_id_idx on public.comments (parent_id);
create index if not exists assignments_lesson_id_idx on public.assignments (lesson_id);
