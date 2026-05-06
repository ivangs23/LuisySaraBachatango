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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User not authenticated')
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return { success: false, error: 'Payment not completed' }
    }

    // The Stripe webhook is the single source of truth for persisting
    // subscriptions and course_purchases. Here we only confirm to the client
    // that the payment is settled.
    return { success: true }
  } catch {
    return { success: false, error: 'Error al verificar el pago' }
  }
}
