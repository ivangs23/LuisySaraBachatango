import '@testing-library/jest-dom'

// Silence console.error in tests (server actions log errors internally)
vi.spyOn(console, 'error').mockImplementation(() => {})

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
