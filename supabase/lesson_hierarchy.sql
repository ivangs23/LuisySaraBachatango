-- Add parent_lesson_id to support nested lessons (e.g. 3 → 3.1, 3.2)
ALTER TABLE lessons
  ADD COLUMN IF NOT EXISTS parent_lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL;
