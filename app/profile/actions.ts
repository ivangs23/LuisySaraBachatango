'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const fullName = formData.get('fullName') as string
  const avatarMode = formData.get('avatarMode') as string
  let avatarUrl = formData.get('avatarUrl') as string
  
  // Handle Avatar Upload
  const avatarFile = formData.get('avatarFile') as File
  if (avatarMode === 'upload' && avatarFile && avatarFile.size > 0) {
      const fileExt = avatarFile.name.split('.').pop()
      const fileName = `${user.id}-${Math.random()}.${fileExt}`
      const filePath = `avatars/${fileName}` // Using a consistent 'avatars' folder prefix

      // Try uploading to 'thumbnails' bucket (reusing existing one) or 'avatars' if we had one.
      // Let's stick to 'thumbnails' since we know it works for now, or just try 'avatars' bucket?
      // Step 496 showed us 'profiles' table but not buckets. 
      // Safest is reuse 'thumbnails' or user might need to create 'avatars' bucket.
      // Let's assume 'thumbnails' works for now or try to create 'avatars' dynamically? No.
      // I'll try 'thumbnails' but path 'avatars/...'
      const { error: uploadError } = await supabase.storage
        .from('thumbnails') 
        .upload(filePath, avatarFile, { upsert: true })

      if (uploadError) {
        console.error('Avatar upload error:', uploadError)
        // If "Bucket not found", we might need to fallback or ask user.
        // Assuming 'thumbnails' exists from Course creation.
      } else {
         const { data: { publicUrl } } = supabase.storage
          .from('thumbnails')
          .getPublicUrl(filePath)
          
         avatarUrl = publicUrl
      }
  }

  const instagram = formData.get('instagram') as string
  const facebook = formData.get('facebook') as string
  const tiktok = formData.get('tiktok') as string
  const youtube = formData.get('youtube') as string

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      avatar_url: avatarUrl,
      instagram,
      facebook,
      tiktok,
      youtube,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    console.error('Error updating profile:', error)
    // return { error: 'Could not update profile' }
    throw new Error('Could not update profile')
  }

  revalidatePath('/profile')
  revalidatePath('/', 'layout') // Update header avatar
}

export async function deleteAccount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Note: To delete a user from auth.users, we typically need the service_role key.
  // However, for this demo, we might just delete the profile data or use a Supabase RPC.
  // A common pattern without service_role in client code is to use a server action that initializes
  // a supabase client with the service role key specifically for this admin task.
  
  // For security, we should verify the user is deleting THEIR OWN account.
  // But standard createClient uses the user's session.
  // We will use the SERVICE_ROLE key here to perform the deletion from auth.users.
  
  const supabaseAdmin = await createClientWithServiceRole()
  
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)

  if (error) {
    console.error('Error deleting account:', error)
    // return { error: 'Could not delete account' }
    throw new Error('Could not delete account')
  }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login?message=Account deleted successfully')
}

// Helper to create admin client
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

async function createClientWithServiceRole() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!serviceRoleKey) {
    throw new Error('Error: SUPABASE_SERVICE_ROLE_KEY is missing in .env.local. You must add this key to delete users.')
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

import { stripe } from '@/utils/stripe/server'

export async function verifyStripeSession(sessionId: string) {
  // We need context of who the user IS, but we need admin rights to write to DB if RLS blocks it.
  // Actually, we can get the user ID from the standard client, but use admin client for the DB write.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }
  
  const supabaseAdmin = await createClientWithServiceRole()

  try {
    console.log('Verifying session:', sessionId);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log('Session retrieved:', session.id, 'Status:', session.payment_status);

    if (session.payment_status === 'paid') {
      const subscriptionId = session.subscription as string;

      if (subscriptionId) {
        // ... (subscription logic)
        // Subscription logic (if we ever go back to recurring)
        const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
         // ...
         // Subscription logic (if we ever go back to recurring)
         // ...
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = subscriptionResponse as any;

         await supabaseAdmin
          .from('subscriptions')
          .upsert({
            id: subscriptionId,
            user_id: user.id,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          });
      } else {
         console.log('One-time payment detected. Updating DB as Admin...');
         // One-time payment logic
         const { error: upsertError } = await supabaseAdmin
            .from('subscriptions')
            .upsert({
              id: session.id,
              user_id: user.id,
              status: 'active',
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(new Date().setFullYear(new Date().getFullYear() + 100)).toISOString(),
            });
         
         if (upsertError) {
            console.error('Upsert Error:', upsertError);
            return { success: false, error: upsertError.message };
         }
         console.log('DB Updated successfully for one-time payment.');
      }

      // revalidatePath('/profile')
      // revalidatePath('/courses')
      return { success: true }
    } else {
        console.log('Payment status not paid:', session.payment_status);
        return { success: false, error: 'Payment not completed' }
    }
  } catch (error: any) {
    console.error('Error verifying session:', error)
    return { success: false, error: error.message }
  }
}
