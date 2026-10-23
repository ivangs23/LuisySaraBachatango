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
          // Clases por email: lleva el email de la persona en la query. La
          // página ya manda noindex; esto evita incluso la petición.
          '/clase-gratis/mas',
          '/courses/create',
          '/courses/*/edit',
          '/courses/*/add-lesson',
          '/courses/*/*/edit',
          '/courses/*/*/submissions',
          // Documento privado con el nombre de una persona. La página ya manda
          // noindex, pero esto evita incluso la petición.
          '/courses/*/certificado',
          '/community/create',
          '/monitoring',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
