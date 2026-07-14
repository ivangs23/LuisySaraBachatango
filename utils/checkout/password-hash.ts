import bcrypt from 'bcryptjs'

/**
 * Hash a plaintext password with bcrypt (cost 10). The hash is stored in
 * pending_registrations and later imported by Supabase GoTrue via
 * admin.createUser({ password_hash }). Plaintext is NEVER stored anywhere.
 *
 * Cost 10 matches Supabase Auth / GoTrue's own default bcrypt cost, so a
 * landing-registered user's hash is identical in strength to a normally
 * signed-up user's — no weaker, and ~4x cheaper on CPU than cost 12
 * (bcryptjs is pure-JS and synchronous, so cost directly caps registration
 * throughput per serverless instance).
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}
