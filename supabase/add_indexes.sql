-- Performance indexes for frequently queried columns
-- Run this migration to improve query performance

CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON lessons(course_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_course_purchases_user_id ON course_purchases(user_id);

CREATE INDEX IF NOT EXISTS idx_comments_lesson_id ON comments(lesson_id);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment_user ON submissions(assignment_id, user_id);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_lesson ON lesson_progress(user_id, lesson_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
