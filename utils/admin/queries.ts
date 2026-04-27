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

export type RevenueDay = {
  date: string         // YYYY-MM-DD (UTC)
  purchases: number    // €
  subscriptions: number // €  (one-shot recognition on `created_at`, simple v1)
}

export async function getRevenueTimeseries(rangeDays: 30 | 90): Promise<RevenueDay[]> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const { centsToEur } = await import('@/utils/admin/metrics')
  const { PLAN_PRICES_EUR } = await import('@/utils/admin/plan-prices')

  const since = new Date(Date.now() - rangeDays * 86_400_000)
  since.setUTCHours(0, 0, 0, 0)
  const sinceIso = since.toISOString()

  const [purchases, subs] = await Promise.all([
    sb.from('course_purchases').select('amount_paid, created_at').gte('created_at', sinceIso),
    sb.from('subscriptions').select('plan_type, created_at').gte('created_at', sinceIso),
  ])

  const buckets = new Map<string, RevenueDay>()
  for (let i = 0; i < rangeDays; i++) {
    const d = new Date(since)
    d.setUTCDate(d.getUTCDate() + i)
    const key = d.toISOString().slice(0, 10)
    buckets.set(key, { date: key, purchases: 0, subscriptions: 0 })
  }

  for (const r of purchases.data ?? []) {
    const key = (r.created_at as string).slice(0, 10)
    const b = buckets.get(key); if (!b) continue
    b.purchases += centsToEur(r.amount_paid as number | null)
  }

  for (const r of subs.data ?? []) {
    const pt = r.plan_type as keyof typeof PLAN_PRICES_EUR | null
    if (!pt) continue
    const key = (r.created_at as string).slice(0, 10)
    const b = buckets.get(key); if (!b) continue
    b.subscriptions += PLAN_PRICES_EUR[pt] ?? 0
  }

  return [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export type StudentRole = 'member' | 'premium' | 'admin'
export type SubFilter = 'all' | 'active' | 'none' | 'newMonth'
export type SortKey = 'created' | 'recent' | 'name'

export type StudentRow = {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  role: StudentRole
  created_at: string
  lastActivity: string | null
  subPlan: string | null
  subPeriodEnd: string | null
}

const PAGE_SIZE = 25

export async function listStudents(args: {
  q?: string
  role?: StudentRole | 'all'
  sub?: SubFilter
  sort?: SortKey
  page?: number
}): Promise<{ rows: StudentRow[]; total: number; pageSize: number }> {
  await requireAdmin()
  const sb = createSupabaseAdmin()
  const page = Math.max(1, args.page ?? 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let q = sb.from('profiles')
    .select('id, full_name, email, avatar_url, role, updated_at, subscriptions(plan_type, status, current_period_end)', { count: 'exact' })

  if (args.q && args.q.trim()) {
    const term = `%${args.q.trim().replace(/[%_]/g, m => '\\' + m)}%`
    q = q.or(`full_name.ilike.${term},email.ilike.${term}`)
  }
  if (args.role && args.role !== 'all') {
    q = q.eq('role', args.role)
  }
  if (args.sub === 'newMonth') {
    const monthStart = new Date()
    monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0)
    q = q.gte('updated_at', monthStart.toISOString())
  }

  switch (args.sort) {
    case 'name': q = q.order('full_name', { ascending: true, nullsFirst: false }); break
    case 'recent': q = q.order('updated_at', { ascending: false }); break
    case 'created':
    default:
      q = q.order('updated_at', { ascending: false })
  }

  q = q.range(from, to)

  const { data, count, error } = await q
  if (error) throw error

  type RawSub = { plan_type: string | null; status: string | null; current_period_end: string | null }
  type RawRow = {
    id: string; full_name: string | null; email: string | null; avatar_url: string | null
    role: StudentRole; updated_at: string
    subscriptions: RawSub[] | RawSub | null
  }

  let rows: StudentRow[] = ((data ?? []) as RawRow[]).map((r) => {
    const subs = Array.isArray(r.subscriptions) ? r.subscriptions : r.subscriptions ? [r.subscriptions] : []
    const active = subs.find(s => s.status === 'active' || s.status === 'trialing') ?? null
    return {
      id: r.id,
      full_name: r.full_name,
      email: r.email,
      avatar_url: r.avatar_url,
      role: r.role,
      created_at: r.updated_at,
      lastActivity: r.updated_at,
      subPlan: active?.plan_type ?? null,
      subPeriodEnd: active?.current_period_end ?? null,
    }
  })

  if (args.sub === 'active') rows = rows.filter(r => r.subPlan !== null)
  if (args.sub === 'none') rows = rows.filter(r => r.subPlan === null)

  return { rows, total: count ?? rows.length, pageSize: PAGE_SIZE }
}

export type StudentDetail = {
  profile: {
    id: string; full_name: string | null; email: string | null
    avatar_url: string | null; role: StudentRole
    instagram: string | null; facebook: string | null
    tiktok: string | null; youtube: string | null
    created_at: string
    stripe_customer_id: string | null
  }
  subscription: {
    plan_type: string | null; status: string | null
    current_period_start: string | null; current_period_end: string | null
  } | null
  purchases: Array<{
    id: string; course_id: string; course_title: string
    amount_paid: number | null; created_at: string
  }>
  membershipCourses: Array<{ id: string; title: string }>
  lessonProgress: Array<{
    course_id: string; course_title: string
    total: number; completed: number
    lessons: Array<{ id: string; title: string; completed: boolean; updated_at: string | null }>
  }>
  submissions: Array<{
    id: string; assignment_id: string; lesson_id: string; course_id: string
    course_title: string; lesson_title: string; assignment_title: string
    status: string; grade: string | null; feedback: string | null
    created_at: string; updated_at: string
  }>
  community: {
    posts: Array<{ id: string; content: string; created_at: string }>
    comments: Array<{ id: string; content: string; post_id: string; created_at: string }>
  }
}

export async function getStudentDetail(userId: string): Promise<StudentDetail | null> {
  await requireAdmin()
  const sb = createSupabaseAdmin()

  const profileRes = await sb
    .from('profiles')
    .select('id, full_name, email, avatar_url, role, instagram, facebook, tiktok, youtube, updated_at, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()

  if (!profileRes.data) return null

  const [subRes, purchasesRes, allCoursesRes, progressRes, submissionsRes, postsRes, commentsRes] = await Promise.all([
    sb.from('subscriptions')
      .select('plan_type, status, current_period_start, current_period_end')
      .eq('user_id', userId)
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from('course_purchases')
      .select('id, course_id, amount_paid, created_at, courses(title)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    sb.from('courses').select('id, title, course_type, month, year, is_published'),
    sb.from('lesson_progress')
      .select('lesson_id, is_completed, updated_at, lessons(id, title, course_id, courses(id, title))')
      .eq('user_id', userId),
    sb.from('submissions')
      .select('id, assignment_id, status, grade, feedback, created_at, updated_at, assignments(title, lesson_id, course_id, lessons(title), courses(title))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    sb.from('posts').select('id, content, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    sb.from('comments').select('id, content, post_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
  ])

  const pickFirst = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

  // Membership courses derived from active subscription period
  const sub = subRes.data
  const membershipCourses: { id: string; title: string }[] = []
  if (sub?.status === 'active' || sub?.status === 'trialing') {
    const start = sub.current_period_start ? new Date(sub.current_period_start) : null
    const end = sub.current_period_end ? new Date(sub.current_period_end) : null
    for (const c of (allCoursesRes.data ?? []) as Array<{
      id: string; title: string; course_type: string; month: number | null; year: number | null; is_published: boolean
    }>) {
      if (c.course_type !== 'membership' || !c.is_published || !c.month || !c.year) continue
      const first = new Date(Date.UTC(c.year, c.month - 1, 1))
      const last = new Date(Date.UTC(c.year, c.month, 0, 23, 59, 59))
      if (start && end && start <= last && end >= first) {
        membershipCourses.push({ id: c.id, title: c.title })
      }
    }
  }

  // Lesson progress aggregation per course
  type ProgRow = {
    lesson_id: string; is_completed: boolean | null; updated_at: string | null
    lessons: {
      id: string; title: string; course_id: string;
      courses: { id: string; title: string } | { id: string; title: string }[] | null
    } | { id: string; title: string; course_id: string;
      courses: { id: string; title: string } | { id: string; title: string }[] | null
    }[] | null
  }
  const progressByCourse = new Map<string, StudentDetail['lessonProgress'][number]>()
  for (const r of (progressRes.data ?? []) as ProgRow[]) {
    const lesson = pickFirst(r.lessons)
    if (!lesson) continue
    const course = pickFirst(lesson.courses)
    if (!course) continue
    let bucket = progressByCourse.get(course.id)
    if (!bucket) {
      bucket = { course_id: course.id, course_title: course.title, total: 0, completed: 0, lessons: [] }
      progressByCourse.set(course.id, bucket)
    }
    bucket.total += 1
    if (r.is_completed) bucket.completed += 1
    bucket.lessons.push({
      id: lesson.id, title: lesson.title,
      completed: !!r.is_completed, updated_at: r.updated_at,
    })
  }

  type SubmRow = {
    id: string; assignment_id: string; status: string;
    grade: string | null; feedback: string | null
    created_at: string; updated_at: string
    assignments: {
      title: string; lesson_id: string; course_id: string;
      lessons: { title: string } | { title: string }[] | null
      courses: { title: string } | { title: string }[] | null
    } | { title: string; lesson_id: string; course_id: string;
      lessons: { title: string } | { title: string }[] | null
      courses: { title: string } | { title: string }[] | null
    }[] | null
  }

  type PurchaseRow = {
    id: string; course_id: string; amount_paid: number | null; created_at: string;
    courses: { title: string } | { title: string }[] | null
  }

  return {
    profile: {
      id: profileRes.data.id as string,
      full_name: profileRes.data.full_name as string | null,
      email: profileRes.data.email as string | null,
      avatar_url: profileRes.data.avatar_url as string | null,
      role: profileRes.data.role as StudentRole,
      instagram: profileRes.data.instagram as string | null,
      facebook: profileRes.data.facebook as string | null,
      tiktok: profileRes.data.tiktok as string | null,
      youtube: profileRes.data.youtube as string | null,
      created_at: profileRes.data.updated_at as string,
      stripe_customer_id: profileRes.data.stripe_customer_id as string | null,
    },
    subscription: sub ?? null,
    purchases: ((purchasesRes.data ?? []) as PurchaseRow[]).map((p) => ({
      id: p.id, course_id: p.course_id,
      course_title: pickFirst(p.courses)?.title ?? '—',
      amount_paid: p.amount_paid, created_at: p.created_at,
    })),
    membershipCourses,
    lessonProgress: [...progressByCourse.values()],
    submissions: ((submissionsRes.data ?? []) as SubmRow[]).map((s) => {
      const a = pickFirst(s.assignments)
      return {
        id: s.id, assignment_id: s.assignment_id,
        lesson_id: a?.lesson_id ?? '', course_id: a?.course_id ?? '',
        course_title: pickFirst(a?.courses)?.title ?? '—',
        lesson_title: pickFirst(a?.lessons)?.title ?? '—',
        assignment_title: a?.title ?? '—',
        status: s.status, grade: s.grade, feedback: s.feedback,
        created_at: s.created_at, updated_at: s.updated_at,
      }
    }),
    community: {
      posts: (postsRes.data ?? []).map(p => ({ id: p.id as string, content: p.content as string, created_at: p.created_at as string })),
      comments: (commentsRes.data ?? []).map(c => ({ id: c.id as string, content: c.content as string, post_id: c.post_id as string, created_at: c.created_at as string })),
    },
  }
}
