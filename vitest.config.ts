import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [
      // Components and hooks need jsdom
      ['__tests__/components/**', 'jsdom'],
      ['__tests__/hooks/**', 'jsdom'],
    ],
    // Playwright E2E tests live under e2e/ and are run via `npm run test:e2e`.
    exclude: ['e2e/**', 'node_modules/**', '.next/**', 'test-results/**', 'playwright-report/**', '.claude/**'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: [
        'utils/**',
        'app/actions/**',
        'app/api/**',
        'app/login/**',
        'app/community/**',
        'app/courses/actions.ts',
        'app/profile/actions.ts',
        'app/auth/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
