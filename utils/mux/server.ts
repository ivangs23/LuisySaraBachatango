import Mux from '@mux/mux-node';

/**
 * Mux Node SDK singleton. Uses MUX_TOKEN_ID + MUX_TOKEN_SECRET for API calls.
 * JWT signing uses MUX_SIGNING_KEY_ID (jwtSigningKey) and MUX_SIGNING_KEY_PRIVATE
 * (jwtPrivateKey, base64-encoded PEM) passed at construction time.
 * Used by server actions and API routes. Never import from client code.
 *
 * NOTE: @mux/mux-node v14 removed the static Mux.JWT.signPlaybackId() helper.
 * JWT signing is now done via the instance: mux.jwt.signPlaybackId() (async).
 * The signing key ID is passed as jwtSigningKey and the private key (base64 PEM)
 * as jwtPrivateKey in ClientOptions — or overridden per-call via keyId/keySecret.
 */
export const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
  jwtSigningKey: process.env.MUX_SIGNING_KEY_ID,
  jwtPrivateKey: process.env.MUX_SIGNING_KEY_PRIVATE,
});

/**
 * Sign a playback JWT for a given Mux playback ID. Used to gate video access
 * in the lesson server component after the access check passes.
 * RS256 with the key from MUX_SIGNING_KEY_PRIVATE (base64 PEM).
 *
 * Returns a Promise<string> — await at the call site.
 */
export async function signPlaybackToken(
  playbackId: string,
  expiration: string = '4h',
): Promise<string> {
  return mux.jwt.signPlaybackId(playbackId, {
    type: 'video',
    expiration,
  });
}

/**
 * Sign a thumbnail JWT for a given Mux playback ID. Used as a poster fallback
 * when the lesson has no custom thumbnail_url — Mux Player fetches the auto-
 * extracted frame from image.mux.com using this token.
 */
export async function signThumbnailToken(
  playbackId: string,
  expiration: string = '4h',
): Promise<string> {
  return mux.jwt.signPlaybackId(playbackId, {
    type: 'thumbnail',
    expiration,
  });
}
