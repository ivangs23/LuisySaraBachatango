# Runbook — Scaling

Quick reference for monitoring health at 1000+ concurrent users and
responding when something degrades.

## Indicators to watch

### Sentry — https://sentry.io
- **Error rate**: events/min. Threshold: investigate if sustained >5/min.
- Filter: `environment:production`. Pin "Issues" view as the default tab.
- Release tag: each Vercel deploy stamps a release; use it to correlate
  regressions with code changes.

### Supabase — Project dashboard
- **Database connections**: alert at 50/60 (Pro tier limit). PostgREST
  multiplexes, so reaching 50 means real saturation.
- **Query duration p95**: <100ms is healthy. Alert at 500ms.
- **Auth**: signins/signups per minute. Project-level rate limits exist
  but aren't published; if Auth starts returning 429s, that's the cap.
- **Realtime**: connection count. The notifications channel keeps one
  WebSocket per logged-in user with the bell open.

### Upstash — https://console.upstash.com
- **Commands/sec**: <100 normal. Alert at 500/sec sustained.
- **Bandwidth**: pay-per-use; check the daily total in the dashboard.
- If Upstash is unreachable, `utils/rate-limit.ts` falls back to local
  in-memory limiting. Rate limiting becomes per-instance (effectively
  off at scale) but no requests fail.

### Vercel — https://vercel.com/dashboard
- **Function concurrency**: Pro plan default is 1000 concurrent invocations
  per region. Throttling visible as 429s or queueing in the dashboard.
- **Cold start frequency**: high cold starts mean low warm pool reuse.
- **Bandwidth**: includes `next/image` optimization output.

## When something fails

| Symptom | Likely cause | First action |
|---|---|---|
| 500s on `/api/checkout` | Stripe rate limit (429) | Check Stripe dashboard → API logs. SDK now retries 3× automatically; if still failing, the burst exceeds Stripe's per-account limit. |
| 500s on Stripe webhook | Idempotent write failed or Stripe retry storm | Verify the event in Stripe → Webhooks → Recent deliveries. The webhook always returns 200 on guard violations; a 500 means a real DB error — check Sentry. |
| Slow `/courses/[id]/[lessonId]` | DB connection pool saturation OR cold start | Check Supabase DB connections. If <40, it's cold start (Mux JWT signing on uncached paths). If ≥50, scale up. |
| Bell never updates | Realtime down OR client did not subscribe | Devtools → WS → check subscription. Server-side: confirm `notifications` is in `supabase_realtime` publication. Fallback poll fires every 5min anyway. |
| Rate limit not blocking abuse | Upstash unreachable, fallback active | Upstash status page; project env vars set in Vercel. Redeploy with env to refresh runtime. |
| Homepage slow on first hit | ISR cache miss (first request after revalidate) | Expected behavior. Subsequent hits within 5min are CDN-cached. |

## Upgrade procedures

### Supabase Pro → Team — $599/mo
**Why**: raises `max_connections` from 60 to 200, adds priority Auth,
read replicas (eventually), BYO domain.

**When**: sustained DB connections >40/60 OR Auth 429s start surfacing in
Sentry. Before upgrading, attempt:
1. Reduce per-render queries on hot pages (Lesson page is the hottest at 8 queries).
2. Add more `unstable_cache` on per-course public data (sidebar already done).
3. Consider migrating heavy reads to a materialized view refreshed via cron.

### Upstash — pay-per-use → fixed plan
**Why**: at >500 cmd/sec sustained, fixed plan is cheaper than per-cmd.

**When**: monthly bill from Upstash exceeds $30.

### Vercel — Pro → Enterprise
**Why**: higher concurrency, isolated build infra, dedicated support.

**When**: function concurrency throttling shows up in dashboard, or
business needs a contractual SLA.

## Recovery procedures

### Cache stuck on stale data
- `revalidatePath('/path')` in a server action OR
- Trigger a redeploy from Vercel → Deployments → Redeploy.

### Realtime channel stops emitting events
1. Verify the table is in `supabase_realtime` publication:
   ```sql
   select tablename from pg_publication_tables where pubname='supabase_realtime';
   ```
2. If missing: `alter publication supabase_realtime add table public.<table>;`

### Rate limit lock-out (legitimate user blocked)
1. Find the bucket key in Sentry/logs (format `rl:<ip>:<action>`).
2. From Upstash console → Browser → run: `DEL <full key>`.
3. Or wait for the window to expire (max 15min for signup, 1min for others).
