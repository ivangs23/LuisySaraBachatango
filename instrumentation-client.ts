// Client-side Sentry init. With Turbopack (the default bundler in Next.js 16)
// the SDK does NOT auto-inject `sentry.client.config.ts`; browser init must
// live in `instrumentation-client.ts` at the project root. (AUDITORIA-2026-07 A4)
import * as Sentry from '@sentry/nextjs'
import { scrubSensitive } from '@/utils/sentry/scrub'

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
    scrubSensitive(event)
    return event
  },
  beforeSendTransaction(event) {
    scrubSensitive(event)
    return event
  },
})

// Instruments App Router navigations for performance tracing.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
