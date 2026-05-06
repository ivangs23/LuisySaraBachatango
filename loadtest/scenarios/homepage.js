import http from 'k6/http'
import { check, sleep } from 'k6'

// Ramp 0 → 1000 VUs over 5 minutes, hold for 1 min, ramp down.
export const options = {
  scenarios: {
    rampup: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 100 },
        { duration: '1m',  target: 500 },
        { duration: '2m',  target: 1000 },
        { duration: '1m',  target: 1000 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },
  thresholds: {
    // SLOs:
    http_req_failed: ['rate<0.01'],     // <1% errors
    http_req_duration: ['p(95)<1500'],   // 95% of requests under 1.5s
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export default function () {
  const res = http.get(`${BASE_URL}/`)
  check(res, {
    'status is 200': r => r.status === 200,
    'is HTML': r => r.headers['Content-Type']?.includes('text/html') ?? false,
  })
  // Simulate user think time between page views.
  sleep(Math.random() * 3 + 1) // 1-4s
}
