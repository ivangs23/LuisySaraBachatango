import { createClient } from '@/utils/supabase/server'
import CommunityClient from '@/components/CommunityClient'

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
