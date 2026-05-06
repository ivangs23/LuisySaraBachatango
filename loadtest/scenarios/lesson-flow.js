import http from 'k6/http'
import { check, sleep } from 'k6'

// 500 VUs sustained for 3 minutes. Simulates an authenticated user
// browsing the courses list and a course detail.
export const options = {
  scenarios: {
    sustained: {
      executor: 'constant-vus',
      vus: 500,
      duration: '3m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<2500'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Reuse a single test session cookie copied from a logged-in test user
// (e.g. `seed-e2e-users.mjs` output). All VUs share the cookie — that's
// fine for load profiling; a real-traffic mix would shard.
const COOKIE = __ENV.SESSION_COOKIE || ''
// Optional: a course ID to drill into. Without it we just hit /courses.
const COURSE_ID = __ENV.COURSE_ID || ''

const params = COOKIE ? { headers: { Cookie: COOKIE } } : {}

export default function () {
  // Step 1 — courses listing.
  let r = http.get(`${BASE_URL}/courses`, params)
  check(r, { 'courses 200': res => res.status === 200 })
  sleep(1)

  // Step 2 — course detail (if configured).
  if (COURSE_ID) {
    r = http.get(`${BASE_URL}/courses/${COURSE_ID}`, params)
    check(r, { 'course detail 200': res => res.status === 200 })
    sleep(2)
  }
}
