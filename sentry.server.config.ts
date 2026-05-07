import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',
  sendDefaultPii: false,
  beforeSend(event) {
    // Strip sensitive headers that the Next.js integration might capture.
    if (event.request?.headers) {
      const h = event.request.headers as Record<string, string>
      delete h.cookie
      delete h.authorization
      delete h['x-vercel-id']
    }
    return event
  },
})
