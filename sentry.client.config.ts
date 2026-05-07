import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',
  sendDefaultPii: false,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,
  beforeSend(event) {
    if (event.request?.headers) {
      const h = event.request.headers as Record<string, string>
      delete h.cookie
      delete h.authorization
      delete h['x-vercel-id']
    }
    return event
  },
})
