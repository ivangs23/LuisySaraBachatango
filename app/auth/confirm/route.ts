import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'
import { isSafeRedirect } from '../callback/redirect'
import { avisoAuth } from '@/utils/alerta'

/**
 * Tipos de enlace por email que emite este proyecto. Se comprueba contra la
 * lista antes de llamar a Supabase: `type` viene de la URL y acaba dentro de
 * `verifyOtp`, así que no puede pasar en crudo.
 *
 * `email` está aquí aunque hoy no se use: es el valor que aparece en la
 * plantilla de ejemplo de la documentación de Supabase para Confirm signup y
 * Magic link. Sin él, migrar el alta a esta ruta copiando esa línea mandaría
 * cada confirmación a la página de error, y el motivo no se vería por ningún
 * lado.
 */
const ALLOWED_TYPES = ['recovery', 'invite', 'signup', 'magiclink', 'email_change', 'email'] as const

function isAllowedType(value: string | null): value is EmailOtpType {
  return !!value && (ALLOWED_TYPES as readonly string[]).includes(value)
}

/**
 * Canjea el `token_hash` de un enlace enviado por email y deja la sesión en una
 * cookie.
 *
 * Por qué existe, además de `/auth/callback`: el callback usa PKCE, que exige un
 * `code_verifier` guardado en el navegador que PIDIÓ el enlace. Para restablecer
 * la contraseña eso no sirve —quien pide el enlace en el portátil lo abre en el
 * móvil, y el estado PKCE además caduca en minutos—, y así es como el reset
 * llevaba roto desde que existe: 3 intentos en producción, 0 completados. El
 * último murió con `422 flow_state_expired` a los 48 minutos.
 *
 * `verifyOtp` en servidor no necesita `code_verifier` ni estado previo: fija la
 * cookie directamente, que es justo lo que espera `updatePassword`
 * (`app/reset-password/actions.ts`) al leer la sesión.
 *
 * El callback se queda como está: el alta por email funciona (14 de 16) y no
 * hay motivo para tocarla.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url)

  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const nextParam = searchParams.get('next')
  // Misma allowlist que el callback: `next` llega de la URL y no puede mandar a
  // un dominio de fuera.
  const next = isSafeRedirect(nextParam) ? nextParam! : '/'

  // El host público detrás del proxy, igual que en /auth/callback.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocalEnv = process.env.NODE_ENV === 'development'
  const base = !isLocalEnv && forwardedHost ? `https://${forwardedHost}` : origin

  if (tokenHash && isAllowedType(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

    // La redirección deja el token fuera de la URL: no queda en el historial ni
    // se filtra por el Referer de la página siguiente.
    if (!error) return NextResponse.redirect(`${base}${next}`)

    avisoAuth('confirm: verifyOtp rechazó el enlace', {
      tipo: type,
      codigo: error.code,
      estado: error.status,
    })
  } else {
    avisoAuth('confirm: enlace sin token_hash o con type no permitido', {
      tipo: type,
      tokenPresente: !!tokenHash,
    })
  }

  return NextResponse.redirect(`${base}/auth/auth-code-error`)
}
