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
  },
  alternates: { canonical: "/community" },
};

export default async function CommunityPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  /* Render Client Component to handle UI translation */

  const { data: posts } = await supabase
    .from('posts')
    .select('*, profiles(full_name)')
    .order('created_at', { ascending: false })

  return <CommunityClient user={user} posts={posts || []} />;
}
