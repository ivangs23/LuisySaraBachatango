import { createClient } from '@/utils/supabase/server'
import FooterClient from './FooterClient'

export default async function Footer() {
  const supabase = await createClient()
  
  // Fetch the most recently updated profile that has an Instagram link
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('instagram, facebook, tiktok, youtube')
    .neq('instagram', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  return <FooterClient adminProfile={adminProfile} />
}
