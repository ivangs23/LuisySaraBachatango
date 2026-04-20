import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://luisysarabachatango.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/profile',
          '/api/',
          '/courses/create',
          '/courses/*/edit',
          '/courses/*/add-lesson',
          '/courses/*/*/edit',
          '/courses/*/*/submissions',
          '/community/create',
          '/debug-profiles',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
