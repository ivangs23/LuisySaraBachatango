import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://luisysarabachatango.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/courses`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/community`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE_URL}/events`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/music`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE_URL}/sobre-nosotros`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${BASE_URL}/legal/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/legal/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/legal/cookies`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE_URL}/legal/notice`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Static blog slugs (hardcoded; migrate to DB-driven when blog moves to CMS)
  const staticBlog: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/blog/que-es-bachatango`, lastModified: new Date('2024-01-15'), changeFrequency: 'yearly', priority: 0.5 },
    { url: `${BASE_URL}/blog/errores-postura`, lastModified: new Date('2024-02-10'), changeFrequency: 'yearly', priority: 0.5 },
    { url: `${BASE_URL}/blog/musicalidad-tango-bachata`, lastModified: new Date('2024-03-05'), changeFrequency: 'yearly', priority: 0.5 },
  ];

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Courses: no updated_at column in DB — use created_at
    const { data: courses } = await supabase
      .from('courses')
      .select('id, created_at')
      .eq('is_published', true);

    const courseRoutes: MetadataRoute.Sitemap = (courses ?? []).map((course) => ({
      url: `${BASE_URL}/courses/${course.id}`,
      lastModified: new Date(course.created_at),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }));

    // Events: has updated_at, end_date and is_published — filter future published only
    const { data: events } = await supabase
      .from('events')
      .select('id, end_date, updated_at, created_at')
      .eq('is_published', true)
      .gte('end_date', new Date().toISOString().slice(0, 10));

    const eventRoutes: MetadataRoute.Sitemap = (events ?? []).map((e) => ({
      url: `${BASE_URL}/events#event-${e.id}`,
      lastModified: e.updated_at ? new Date(e.updated_at) : (e.created_at ? new Date(e.created_at) : now),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

    // Community posts: no updated_at column in DB — use created_at
    const { data: posts } = await supabase
      .from('posts')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    const postRoutes: MetadataRoute.Sitemap = (posts ?? []).map((p) => ({
      url: `${BASE_URL}/community/${p.id}`,
      lastModified: new Date(p.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }));

    return [...staticRoutes, ...staticBlog, ...courseRoutes, ...eventRoutes, ...postRoutes];
  } catch {
    return [...staticRoutes, ...staticBlog];
  }
}
