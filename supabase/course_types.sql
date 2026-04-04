-- Migration: course types (complete vs membership)
-- Adds course_type, category, price_eur to courses table.
-- Also makes month/year nullable since complete courses don't need them.

-- 1. Add course_type: 'membership' (default, existing) or 'complete'
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS course_type text NOT NULL DEFAULT 'membership';

-- 2. Add category for complete courses (bachatango, bachata, tango, chachacha, etc.)
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS category text;

-- 3. Add price_eur for display and billing (in full euros, e.g. 19)
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS price_eur integer;

-- 4. Make month and year nullable (complete courses don't have a month/year)
ALTER TABLE public.courses ALTER COLUMN month DROP NOT NULL;
ALTER TABLE public.courses ALTER COLUMN year DROP NOT NULL;

-- Verify: existing courses keep their month/year and default to 'membership' type
-- UPDATE public.courses SET course_type = 'membership' WHERE course_type IS NULL;
