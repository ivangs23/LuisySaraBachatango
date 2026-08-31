import '@testing-library/jest-dom'

// Set required env vars for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy'
process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000'

process.env.MUX_TOKEN_ID = 'test-token-id'
process.env.MUX_TOKEN_SECRET = 'test-token-secret'
process.env.MUX_SIGNING_KEY_ID = 'test-signing-key-id'
// base64 of a dummy RSA private key PEM header — never used in tests (signPlaybackToken paths are exercised via mocks)
process.env.MUX_SIGNING_KEY_PRIVATE = 'dGVzdC1wcml2YXRlLWtleQ=='

process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'test-unsubscribe-secret'
process.env.LANDING_ANALYTICS_SECRET = 'test-landing-analytics-secret'

// jsdom no implementa IntersectionObserver, y motion/react lo necesita para
// `whileInView` (components/Reveal.tsx) y hooks/useInView.ts. Sin este stub,
// cualquier test de componente que renderice una sección animada revienta con
// "ReferenceError: IntersectionObserver is not defined".
//
// El stub reporta el elemento como visible en cuanto se observa, que es el
// estado que los tests quieren afirmar: contenido revelado, no oculto.
class IntersectionObserverStub implements IntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin: string = '0px'
  readonly thresholds: ReadonlyArray<number> = [0]

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element): void {
    this.callback(
      [{ isIntersecting: true, intersectionRatio: 1, target } as IntersectionObserverEntry],
      this,
    )
  }

  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] { return [] }
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver
}
