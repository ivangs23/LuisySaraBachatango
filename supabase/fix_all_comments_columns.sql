-- Ensure lesson_id column exists
ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS lesson_id uuid references public.lessons(id) on delete cascade not null;

-- Ensure parent_id column exists
ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS parent_id uuid references public.comments(id) on delete cascade;

-- Ensure user_id column exists (just in case)
ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS user_id uuid references public.profiles(id) on delete cascade not null;

-- Ensure content column exists
ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS content text not null;

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
