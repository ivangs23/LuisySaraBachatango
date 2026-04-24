-- Add UNIQUE constraint on stripe_session_id so the webhook upsert can be
-- truly idempotent. Without this, Stripe retries that race past the
-- pre-check race against UNIQUE(user_id, course_id) and surface a 500.
ALTER TABLE public.course_purchases
  ADD CONSTRAINT course_purchases_stripe_session_id_key UNIQUE (stripe_session_id);

NOTIFY pgrst, 'reload schema';
