ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS lesson_id uuid references public.lessons(id) on delete cascade;

NOTIFY pgrst, 'reload schema';
