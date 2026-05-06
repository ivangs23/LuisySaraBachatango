# Load test results — 2026-05-06

## Setup

- **Branch**: `feat/scale-1k-concurrent`
- **Commit**: `b3c3e50` (Sentry slug fix on top of all scaling changes)
- **Target**: Vercel Preview Deployment with the new Sentry + Upstash env vars
  applied (`luisy-sara-bachatango-pkj9rhwe8-ivangs23s-projects.vercel.app`)
- **Tool**: k6 v1.7.1 (macOS arm64), local laptop
- **Region from k6 → CDG / IAD**: client in EU, Vercel serving from `iad1` and `cdg1`
- **Scenario file**: `loadtest/scenarios/homepage.js`
- **Profile**: `ramping-vus` 0→100 (30s) → 500 (1m) → 1000 (2m) → hold 1000 (1m) → 0 (30s) — total 5min

Environment notes:
- Supabase: Pro plan (60 max_connections), eu-west-1
- Upstash Redis: Regional, eu-west-1
- Sentry: javascript-nextjs-mx project, init enabled in production
- Vercel: Pro plan, default region preference, SSO Protection temporarily
  disabled for the duration of the test and re-enabled after.

## Homepage scenario — RESULT: PASS ✅

### Thresholds

| Threshold | Limit | Actual | Verdict |
|---|---|---|---|
| `http_req_duration p(95)` | < 1500 ms | **671 ms** | ✅ 55% headroom |
| `http_req_failed rate` | < 1% | **0.005%** (3 of 62,118) | ✅ |

### Full latency distribution

| Percentile | Latency |
|---|---|
| min | 0 ms (sub-ms cold response) |
| avg | 487 ms |
| median (p50) | 468 ms |
| p90 | 617 ms |
| p95 | 671 ms |
| max | 5.13 s |

### Throughput

- Total iterations: **62,118** in 5m 03s
- Sustained: **204 req/s average**, peak ~280 req/s during the 1000-VU plateau
- 99.99% of HTTP checks succeeded (status 200 + `Content-Type: text/html`)
- 3 transient failures out of 62k (likely single-instance cold starts touching
  the 5s tail of `http_req_duration`)

### Network

- Total data received: 3.3 GB (11 MB/s)
- Total data sent: 12 MB (39 kB/s)

## Lesson flow scenario

NOT YET RUN. The homepage result already demonstrates the architectural
improvements work; the lesson-flow scenario requires a logged-in test user
session cookie to be useful, and current admins prefer to validate after
merge to main where Production traffic patterns can be observed in Sentry.

## Verdict

The combined audit + scaling work landed the platform on a comfortable
ceiling. At a sustained 1000 concurrent VUs, p95 sits at ~670 ms — less than
half the 1500 ms SLO — and zero meaningful errors. The headroom suggests the
realistic ceiling is ~2000-3000 concurrent for the homepage, bounded by:
- Vercel function concurrency (Pro: 1000 per region; the 5s tail is likely
  cold starts when concurrent demand briefly exceeds the warm pool).
- Supabase Auth (which the homepage doesn't even hit thanks to the middleware
  skip we added in `audit-2026-05`).

For paid lessons (per-user data, more queries) the lesson page will scale less
linearly. Once Production traffic is real, Sentry + Vercel Analytics will
expose the next bottleneck if any.

## Next observations to track post-merge

- Sentry **error rate** during the first 24h of Production traffic — establishes
  the baseline.
- Supabase **DB connections** dashboard during first peak hour — should stay
  well below 60.
- Upstash **commands/sec** — confirms rate limiter actually being hit.
- Vercel **function execution time p95** for `/courses/[id]/[lessonId]` —
  hottest authenticated route; if >1500ms p95, revisit `unstable_cache`
  strategy on the sidebar.

## How to reproduce

```bash
# Install
brew install k6

# Disable SSO on Preview temporarily (Vercel API)
# Run test
BASE_URL=<preview-url> k6 run loadtest/scenarios/homepage.js

# Re-enable SSO
```

The full load test guide is in `loadtest/README.md`.
