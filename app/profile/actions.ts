'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sanitizeUrl, safeAvatarUrl } from '@/utils/sanitize'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const fullName = formData.get('fullName') as string
  const avatarMode = formData.get('avatarMode') as string
  // URL mode: validate against the allowlisted hosts (next.config.ts remotePatterns).
  // Anything else returns null so the user falls back to the placeholder rather
  // than crashing the page with a Next/Image runtime error.
  let avatarUrl: string | null = avatarMode === 'upload'
    ? null
    : safeAvatarUrl(formData.get('avatarUrl'))
  
  // Handle Avatar Upload
  const avatarFile = formData.get('avatarFile') as File
  if (avatarMode === 'upload' && avatarFile && avatarFile.size > 0) {
      const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      const MAX_SIZE = 5 * 1024 * 1024 // 5MB

      if (!ALLOWED_TYPES.includes(avatarFile.type)) {
        throw new Error('Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, WebP, GIF).')
      }
      if (avatarFile.size > MAX_SIZE) {
        throw new Error('El archivo es demasiado grande. El tamaño máximo es 5MB.')
      }

      const fileExt = avatarFile.name.split('.').pop()
      const fileName = `${user.id}-${crypto.randomUUID()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('thumbnails')
        .upload(filePath, avatarFile, { upsert: true })

      if (uploadError) {
        throw new Error('Error al subir el avatar. Inténtalo de nuevo.')
      } else {
         const { data: { publicUrl } } = supabase.storage
          .from('thumbnails')
          .getPublicUrl(filePath)

         avatarUrl = publicUrl
      }
  }

  const instagram = sanitizeUrl(formData.get('instagram'))
  const facebook = sanitizeUrl(formData.get('facebook'))
  const tiktok = sanitizeUrl(formData.get('tiktok'))
  const youtube = sanitizeUrl(formData.get('youtube'))

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
    throw new Error('Could not update profile')
  }

  revalidatePath('/profile')
  revalidatePath('/', 'layout') // Update header avatar
}

export async function deleteAccount(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) {
    redirect('/login')
  }

  const email = user.email
  const userId = user.id

  const password = formData.get('password')
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('Contraseña requerida para confirmar el borrado.')
  }

  // Re-authenticate with the user's current session email + provided password.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (reauthError) {
    throw new Error('Contraseña incorrecta.')
  }

  const supabaseAdmin = await createClientWithServiceRole()

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (error) {
    throw new Error('No se pudo borrar la cuenta.')
  }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login?message=account_deleted')
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
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      const subscriptionId = session.subscription as string;

      if (subscriptionId) {
        const subscriptionResponse = await stripe.subscriptions.retrieve(subscriptionId);
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
        // One-time course purchase — idempotent on stripe_session_id (UNIQUE).
        // Mirrors the webhook at app/api/webhooks/stripe/route.ts.
        const courseId = session.metadata?.courseId;
        if (!courseId) {
          return { success: false, error: 'No course associated with this session' };
        }

        const { error: upsertError } = await supabaseAdmin
          .from('course_purchases')
          .upsert(
            {
              user_id: user.id,
              course_id: courseId,
              stripe_session_id: session.id,
              amount_paid: session.amount_total ?? null,
            },
            { onConflict: 'stripe_session_id', ignoreDuplicates: true }
          );

        if (upsertError) {
          return { success: false, error: 'Error al procesar el pago' };
        }
      }

      return { success: true }
    } else {
      return { success: false, error: 'Payment not completed' }
    }
  } catch (error: unknown) {
    return { success: false, error: 'Error al verificar el pago' }
  }
}
