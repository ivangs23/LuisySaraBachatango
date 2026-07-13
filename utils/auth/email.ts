/**
 * Shared email pattern. Promoted out of app/login/actions.ts so landingCheckout
 * and signup use the same validation.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
