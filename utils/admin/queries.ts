import { createSupabaseAdmin } from '@/utils/supabase/admin'
import { requireAdmin } from '@/utils/admin/guard'

export type OverviewKpis = {
  totalStudents: number
  newThisWeek: number
  newToday: number
  activeSubs: number
  mrrEur: number
  monthRevenueEur: number
  prevMonthRevenueEur: number
  publishedCourses: number
  totalLessons: number
  pendingSubmissions: number
  oldestPendingDays: number | null
}

const WEEK_MS = 7 * 86_400_000
const DAY_MS = 86_400_000

function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export async function getOverviewKpis(): Promise<OverviewKpis> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - WEEK_MS).toISOString()
  const dayAgo = new Date(now.getTime() - DAY_MS).toISOString()
  const monthStart = startOfMonthUTC(now).toISOString()
  const prevMonthStart = startOfMonthUTC(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  ).toISOString()

  const [
    studentsCount,
    newWeekCount,
    newTodayCount,
    activeSubsRows,
    monthPurchases,
    prevMonthPurchases,
    coursesCount,
    lessonsCount,
    pendingSubs,
    oldestPending,
  ] = await Promise.all([
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('profiles').select('id', { count: 'exact', head: true }).gte('updated_at', weekAgo),
    sb.from('profiles').select('id', { count: 'exact', head: true }).gte('updated_at', dayAgo),
    sb.from('subscriptions')
      .select('plan_type')
      .in('status', ['active', 'trialing']),
    sb.from('course_purchases')
      .select('amount_paid')
      .gte('created_at', monthStart),
    sb.from('course_purchases')
      .select('amount_paid')
      .gte('created_at', prevMonthStart)
      .lt('created_at', monthStart),
    sb.from('courses').select('id', { count: 'exact', head: true }).eq('is_published', true),
    sb.from('lessons').select('id', { count: 'exact', head: true }),
    sb.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('submissions')
      .select('created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const { computeMRR, centsToEur } = await import('@/utils/admin/metrics')

  const monthRev = (monthPurchases.data ?? [])
    .reduce((s: number, r: { amount_paid: number | null }) => s + centsToEur(r.amount_paid), 0)
  const prevMonthRev = (prevMonthPurchases.data ?? [])
    .reduce((s: number, r: { amount_paid: number | null }) => s + centsToEur(r.amount_paid), 0)

  const oldestDays = oldestPending.data?.created_at
    ? Math.floor((Date.now() - new Date(oldestPending.data.created_at).valueOf()) / DAY_MS)
    : null

  return {
    totalStudents: studentsCount.count ?? 0,
    newThisWeek: newWeekCount.count ?? 0,
    newToday: newTodayCount.count ?? 0,
    activeSubs: (activeSubsRows.data ?? []).length,
    mrrEur: computeMRR((activeSubsRows.data ?? []) as { plan_type: '1month' | '6months' | '1year' | null }[]),
    monthRevenueEur: monthRev,
    prevMonthRevenueEur: prevMonthRev,
    publishedCourses: coursesCount.count ?? 0,
    totalLessons: lessonsCount.count ?? 0,
    pendingSubmissions: pendingSubs.count ?? 0,
    oldestPendingDays: oldestDays,
  }
}

export type LatestStudent = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  created_at: string  // we use updated_at as proxy
}

export type RecentPayment =
  | { kind: 'purchase'; userId: string; userName: string | null; courseTitle: string; amountEur: number; date: string }
  | { kind: 'subscription'; userId: string; userName: string | null; planType: string | null; date: string }

export type ActiveCourse = {
  id: string
  title: string
  image_url: string | null
  completedCount: number
}

export async function getLatestStudents(limit = 5): Promise<LatestStudent[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const { data } = await sb
    .from('profiles')
    .select('id, full_name, email, avatar_url, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit)
  return (data ?? []).map((r) => ({
    id: r.id as string,
    full_name: r.full_name as string | null,
    email: r.email as string | null,
    avatar_url: r.avatar_url as string | null,
    created_at: r.updated_at as string,
  }))
}

export async function getRecentPayments(limit = 5): Promise<RecentPayment[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const { centsToEur } = await import('@/utils/admin/metrics')

  const [purchases, subs] = await Promise.all([
    sb.from('course_purchases')
      .select('user_id, amount_paid, created_at, courses(title), profiles!inner(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit),
    sb.from('subscriptions')
      .select('user_id, plan_type, created_at, profiles!inner(full_name)')
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  type PurchaseRow = {
    user_id: string; amount_paid: number | null; created_at: string;
    courses: { title: string } | { title: string }[] | null;
    profiles: { full_name: string | null } | { full_name: string | null }[] | null;
  }
  type SubRow = {
    user_id: string; plan_type: string | null; created_at: string;
    profiles: { full_name: string | null } | { full_name: string | null }[] | null;
  }

  const pickFirst = <T,>(v: T | T[] | null): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : v

  const merged: RecentPayment[] = [
    ...(purchases.data ?? []).map((r: PurchaseRow): RecentPayment => ({
      kind: 'purchase',
      userId: r.user_id,
      userName: pickFirst(r.profiles)?.full_name ?? null,
      courseTitle: pickFirst(r.courses)?.title ?? '—',
      amountEur: centsToEur(r.amount_paid),
      date: r.created_at,
    })),
    ...(subs.data ?? []).map((r: SubRow): RecentPayment => ({
      kind: 'subscription',
      userId: r.user_id,
      userName: pickFirst(r.profiles)?.full_name ?? null,
      planType: r.plan_type,
      date: r.created_at,
    })),
  ]

  return merged
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
}

export async function getActiveCourses(limit = 5): Promise<ActiveCourse[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()

  const sinceIso = new Date(Date.now() - 30 * 86_400_000).toISOString()

  // 1. recent completed lesson_progress with course_id via lessons join
  const { data: progress } = await sb
    .from('lesson_progress')
    .select('lessons!inner(course_id)')
    .eq('is_completed', true)
    .gte('updated_at', sinceIso)

  type Row = { lessons: { course_id: string } | { course_id: string }[] | null }
  const counts = new Map<string, number>()
  for (const r of (progress ?? []) as Row[]) {
    const lessons = Array.isArray(r.lessons) ? r.lessons[0] : r.lessons
    const cid = lessons?.course_id
    if (!cid) continue
    counts.set(cid, (counts.get(cid) ?? 0) + 1)
  }

  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)

  if (top.length === 0) return []

  const { data: courses } = await sb
    .from('courses')
    .select('id, title, image_url')
    .in('id', top.map(([id]) => id))

  const byId = new Map((courses ?? []).map(c => [c.id as string, c]))
  return top.map(([id, count]) => ({
    id,
    title: (byId.get(id)?.title as string) ?? '—',
    image_url: (byId.get(id)?.image_url as string | null) ?? null,
    completedCount: count,
  }))
}
