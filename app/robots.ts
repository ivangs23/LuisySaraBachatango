import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://luisysarabachatango.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/*',
          '/dashboard',
          '/profile',
          '/api/',
          '/auth/callback',
          '/auth/signout',
          '/login',
          '/signup',
          '/forgot-password',
          '/reset-password',
          '/courses/create',
          '/courses/*/edit',
          '/courses/*/add-lesson',
          '/courses/*/*/edit',
          '/courses/*/*/submissions',
          '/community/create',
          '/monitoring',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
