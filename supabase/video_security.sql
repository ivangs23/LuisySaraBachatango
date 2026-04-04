-- Migration: video_security
-- Replaces the weak "any authenticated user can view course content" storage policy
-- with one that requires admin role.
--
-- The real access gate is the /api/video/[lessonId] proxy:
--   - It validates purchase / subscription on every request
--   - It generates 5-minute signed URLs via the service role
--   - Signed URLs bypass RLS, so paying users can still stream videos
--
-- Direct bucket access (without a proxy-generated signed URL) is now admin-only.

-- Drop the old weak policy
DROP POLICY IF EXISTS "Authenticated users can view course content" ON storage.objects;

-- Only admins can read course-content files directly.
-- Regular users receive short-lived signed URLs from the /api/video proxy instead.
CREATE POLICY "Admins can view course content directly"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'course-content' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
