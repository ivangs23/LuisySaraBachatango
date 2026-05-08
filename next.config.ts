import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_HOST = SUPABASE_URL.replace(/^https?:\/\//, '') || '*.supabase.co';

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    // 24h. Avatars and thumbnails change rarely; reduces re-optimization cost.
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'jytokoxbsykoyifzbjkd.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
        pathname: '/w40/**',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
        pathname: '/w80/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            // 'unsafe-inline' in script-src is required because Next.js inlines runtime config
            // and JSON-LD scripts. Removing it would require switching to nonces (larger refactor).
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.mux.com https://www.instagram.com https://platform.instagram.com https://www.gstatic.com`,
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: https://${SUPABASE_HOST} https://image.mux.com https://*.googleusercontent.com https://flagcdn.com https://*.cdninstagram.com https://*.fbcdn.net`,
              "media-src 'self' blob: https://stream.mux.com https://*.mux.com",
              `connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.mux.com`,
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://open.spotify.com https://www.instagram.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: 'javascript-nextjs-mx',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  tunnelRoute: '/monitoring',
})
