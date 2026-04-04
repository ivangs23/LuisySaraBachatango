-- Migration: assignments and submissions
-- Creates tables for lesson assignments (set by admin) and student submissions.

-- 1. Assignments table (admin creates tasks per lesson)
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Everyone with access can read assignments
CREATE POLICY "Authenticated users can view assignments" ON public.assignments
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only admins can create/update/delete assignments
CREATE POLICY "Admins can manage assignments" ON public.assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 2. Submissions table (students submit work per assignment)
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text_content text,
  file_url text,        -- storage://submissions/path/to/file
  status text DEFAULT 'pending' NOT NULL, -- 'pending' | 'reviewed'
  grade text,           -- admin's grade/mark (free text)
  feedback text,        -- admin's written feedback
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(assignment_id, user_id)
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Students can view their own submissions
CREATE POLICY "Users can view own submissions" ON public.submissions
  FOR SELECT USING (auth.uid() = user_id);

-- Students can insert their own submissions
CREATE POLICY "Users can insert own submissions" ON public.submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Students can update their own pending submissions (before reviewed)
CREATE POLICY "Users can update own pending submissions" ON public.submissions
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view all submissions
CREATE POLICY "Admins can view all submissions" ON public.submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update submissions (to grade/add feedback)
CREATE POLICY "Admins can update submissions" ON public.submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 3. Storage bucket for submissions (run in Supabase dashboard or via CLI)
 INSERT INTO storage.buckets (id, name, public) VALUES ('submissions', 'submissions', false)
 ON CONFLICT (id) DO NOTHING;

-- Storage policies for submissions bucket:
-- Students can upload to their own folder: submissions/{user_id}/
 CREATE POLICY "Users can upload own submissions" ON storage.objects
   FOR INSERT WITH CHECK (
     bucket_id = 'submissions' AND
     (storage.foldername(name))[1] = auth.uid()::text
   );

-- Students can read their own submissions
 CREATE POLICY "Users can read own submissions" ON storage.objects
   FOR SELECT USING (
     bucket_id = 'submissions' AND
     (storage.foldername(name))[1] = auth.uid()::text
   );
--
-- Admins can read all submissions
 CREATE POLICY "Admins can read all submissions" ON storage.objects
   FOR SELECT USING (
     bucket_id = 'submissions' AND
     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
   );
