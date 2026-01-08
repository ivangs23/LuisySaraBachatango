-- Make post_id nullable so we can insert comments for lessons without it
ALTER TABLE public.comments ALTER COLUMN post_id DROP NOT NULL;

-- Also ensure lesson_id is nullable if we want to support posts without lessons (though my code sends it)
-- But wait, my code sends lesson_id. The error is about post_id being NULL.
-- So we just need to drop the NOT NULL constraint on post_id.

NOTIFY pgrst, 'reload schema';
