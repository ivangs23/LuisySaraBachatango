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
          // Lleva un token de un solo uso en la query: si un rastreador la
          // visita, lo gasta y quien abre el correo se encuentra el error.
          '/auth/confirm',
          '/auth/signout',
          '/login',
          '/signup',
          '/forgot-password',
          '/reset-password',
          '/unsubscribe',
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
