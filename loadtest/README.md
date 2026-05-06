# Load testing with k6

## Install

macOS: `brew install k6`
Other platforms: https://k6.io/docs/get-started/installation/

Verify: `k6 version`

## Run locally (against dev server)

```bash
# Terminal 1
npm run dev

# Terminal 2
BASE_URL=http://localhost:3000 k6 run loadtest/scenarios/homepage.js
```

## Run against staging

```bash
BASE_URL=https://your-staging-url.vercel.app \
  k6 run loadtest/scenarios/homepage.js
```

## Authenticated flow

Get a session cookie by logging in to the app and copying the `sb-*-auth-token`
cookie from DevTools → Application → Cookies.

```bash
COOKIE='sb-access-token=...; sb-refresh-token=...' \
COURSE_ID=00000000-0000-0000-0000-000000000000 \
BASE_URL=https://your-staging-url.vercel.app \
  k6 run loadtest/scenarios/lesson-flow.js
```

## Acceptance criteria for 1000 concurrent

`homepage.js` (ramp 0→1000 VUs in 5min, hold 1min):
- p95 < 1500 ms
- error rate < 1%
- All thresholds reported as `✓` at the end

`lesson-flow.js` (500 sustained, 3min):
- p95 < 2500 ms
- error rate < 2%

## When the test fails

1. Check the k6 summary for which threshold was violated.
2. Open Sentry for any spikes in error events during the test window.
3. Open Supabase dashboard → SQL Editor → run:
   ```sql
   select query, calls, mean_exec_time, total_exec_time
     from pg_stat_statements
    order by total_exec_time desc
    limit 20;
   ```
   to spot the worst-offending query.
4. Open Vercel dashboard → Analytics → Function Execution to see if any route
   hit timeout or memory limits.

## Tips

- Run against a Preview Deployment, not production. Vercel Preview URLs
  point to the same Supabase project, so set up a separate Supabase
  project for load tests if you need true isolation.
- k6 has a free cloud option (k6.io) if you need >1000 VUs from local —
  local k6 maxes at the network capacity of your laptop.
- When a load test reveals a bottleneck, fix it AND add a regression test
  in this folder that codifies the SLO.
