import bcrypt from 'bcryptjs'

/**
 * Hash a plaintext password with bcrypt (cost 12). The hash is stored in
 * pending_registrations and later imported by Supabase GoTrue via
 * admin.createUser({ password_hash }). Plaintext is NEVER stored anywhere.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12)
}
