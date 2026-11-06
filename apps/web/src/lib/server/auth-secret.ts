/**
 * Validate the required Auth.js secret at the point authentication is accessed.
 * No development fallback is allowed.
 */
export function requireAuthSecret(secret = process.env.AUTH_SECRET): string {
  const configured = secret?.trim();
  if (!configured) {
    throw new Error('AUTH_SECRET must be configured before authentication is used.');
  }
  return configured;
}
