import * as argon2 from "argon2";

/**
 * Verify an Argon2id password hash created by the database bootstrap flow.
 * This Node.js-only function must only be called from trusted server code.
 *
 * Malformed hashes and non-Argon2id encodings are rejected without exposing
 * hashing-library errors to callers.
 */
export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  if (
    typeof password !== "string" ||
    typeof passwordHash !== "string" ||
    !passwordHash.startsWith("$argon2id$")
  ) {
    return false;
  }

  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}
