import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();

  // Logic: Find the next lesson that is released or about to be released (e.g., today)
  // For this MVP, let's find the most recent lesson that was released within the last 3 days
  // OR the next upcoming lesson in the next 24 hours.
  
  const now = new Date();
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(now.getDate() - 3);
  
  const next24Hours = new Date();
  next24Hours.setHours(now.getHours() + 24);

  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('*')
    .gte('release_date', threeDaysAgo.toISOString())
    .lte('release_date', next24Hours.toISOString())
    .order('release_date', { ascending: true }) // Get the earliest one in this window
    .limit(1)
    .single();

  if (error) {
    // It's okay if no lesson is found, just return null
    return NextResponse.json(null);
  }

  return NextResponse.json(lesson);
}
