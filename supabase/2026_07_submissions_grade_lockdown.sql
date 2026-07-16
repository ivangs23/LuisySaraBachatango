-- MEDIUM (M1): the submissions UPDATE policy (auth.uid()=user_id AND status='pending')
-- has no column scope, and `authenticated` holds a TABLE-LEVEL UPDATE grant
-- (Supabase default GRANT ALL). A column-level REVOKE of (grade,feedback) would be a
-- no-op against the table grant — the same trap as the profiles role lockdown. So a
-- student could set their own grade/feedback on a pending submission via direct PostgREST.
--
-- Fix: drop the table-level UPDATE grant and re-grant ONLY the columns a student
-- legitimately edits on their own pending row. grade/feedback are now written solely by
-- the service role (gradeSubmission, admin-gated), which bypasses grants + RLS. `status`
-- stays grantable because the student re-submit upsert writes status='pending'; its value
-- is pinned by the student UPDATE policy's WITH CHECK, so it can't be used to self-review.
revoke update on public.submissions from anon, authenticated;
grant update (text_content, file_url, status, updated_at) on public.submissions to authenticated;
