-- Migration: course_purchases
-- Adds stripe_price_id to courses, stripe_customer_id to profiles,
-- plan_type to subscriptions, and creates course_purchases table.

-- 1. Add stripe_price_id to courses (each course has its own Stripe price)
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- 2. Add stripe_customer_id to profiles (avoids duplicate Stripe customers)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- 3. Add plan_type to subscriptions
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_type text;
-- plan_type values: '1month' | '6months' | '1year'

-- 4. Create course_purchases table (individual one-time course purchases)
CREATE TABLE IF NOT EXISTS public.course_purchases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  stripe_session_id text NOT NULL,
  amount_paid integer, -- in cents
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, course_id)
);

-- RLS for course_purchases
ALTER TABLE public.course_purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases
CREATE POLICY "Users can view own purchases" ON public.course_purchases
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all purchases
CREATE POLICY "Admins can view all purchases" ON public.course_purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only service role can insert (via webhook)
-- No INSERT policy needed for normal users; inserts happen via service role in webhook
