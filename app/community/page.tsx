import type { Metadata } from 'next';
import { createClient } from '@/utils/supabase/server'
import CommunityClient from '@/components/CommunityClient'

export const metadata: Metadata = {
  title: "Comunidad",
  description: "Únete a la comunidad de bailarines de Luis y Sara Bachatango. Comparte tu progreso, haz preguntas y conecta con otros apasionados del Bachatango.",
  openGraph: {
    title: "Comunidad | Luis y Sara Bachatango",
    description: "Únete a la comunidad de bailarines de Bachatango. Comparte tu progreso y conecta con otros alumnos.",
    url: "/community",
    images: [{ url: '/luis-sara-about.jpg', width: 1200, height: 630, alt: 'Comunidad de bailarines de Bachatango' }],
  },
  alternates: { canonical: "/community" },
};

export default async function CommunityPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })

  const postIds = posts?.map(p => p.id) ?? []
  const safeIds = postIds.length ? postIds : ['00000000-0000-0000-0000-000000000000']

  const [{ data: postLikeRows }, { data: commentRows }] = await Promise.all([
    supabase.from('post_likes').select('post_id').in('post_id', safeIds),
    supabase.from('comments').select('post_id').in('post_id', safeIds),
  ])

  const likeCounts = new Map<string, number>()
  postLikeRows?.forEach((r: { post_id: string }) => likeCounts.set(r.post_id, (likeCounts.get(r.post_id) ?? 0) + 1))

  const commentCounts = new Map<string, number>()
  commentRows?.forEach((r: { post_id: string | null }) => {
    if (r.post_id) commentCounts.set(r.post_id, (commentCounts.get(r.post_id) ?? 0) + 1)
  })

  const enrichedPosts = (posts ?? []).map(p => ({
    ...p,
    likes_count: likeCounts.get(p.id) ?? 0,
    comments_count: commentCounts.get(p.id) ?? 0,
  }))

  return <CommunityClient user={user} posts={enrichedPosts} />;
}
