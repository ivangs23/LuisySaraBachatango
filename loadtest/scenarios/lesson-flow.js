import http from 'k6/http'
import { check, sleep } from 'k6'

// 500 VUs sustained for 3 minutes. Simulates an authenticated user
// browsing the courses list, a course detail, and an actual lesson page
// (the authenticated hot path required by the June 2026 audit, finding A5).
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
    // Lesson page (access check + Mux token signing) gets its own budget.
    'http_req_duration{stage:lesson}': ['p(95)<2500'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

// Reuse a single test session cookie copied from a logged-in test user
// (e.g. `seed-e2e-users.mjs` output). All VUs share the cookie — that's
// fine for load profiling; a real-traffic mix would shard.
const COOKIE = __ENV.COOKIE || ''
// Optional: a course ID to drill into. Without it we just hit /courses.
const COURSE_ID = __ENV.COURSE_ID || ''
// Optional: path to an actual lesson page, e.g. '/courses/abc/def'.
// This is the authenticated hot path (audit finding A5).
const LESSON_PATH = __ENV.LESSON_PATH || ''

const params = COOKIE ? { headers: { Cookie: COOKIE } } : {}

export function setup() {
  if (!LESSON_PATH) {
    console.warn(
      'LESSON_PATH not set — skipping the lesson page stage. ' +
        'Set LESSON_PATH=/courses/<courseId>/<lessonId> to exercise the ' +
        'authenticated hot path required by the June audit (A5).'
    )
  }
}

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

  // Step 3 — lesson page (if configured). Tagged so the p95 threshold
  // above applies specifically to this request.
  if (LESSON_PATH) {
    r = http.get(`${BASE_URL}${LESSON_PATH}`, {
      ...params,
      tags: { stage: 'lesson' },
    })
    check(r, { 'lesson 200': res => res.status === 200 })
    sleep(2)
  }
}
