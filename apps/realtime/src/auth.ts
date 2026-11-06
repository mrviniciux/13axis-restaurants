import { RoleSchema, UuidV7Schema, type Role } from "@mudra/shared";
import { jwtVerify, type JWTPayload } from "jose";
import { z } from "zod";

const IdentityClaimsSchema = z.object({
  userId: UuidV7Schema,
  restaurantId: UuidV7Schema,
  role: RoleSchema,
  exp: z.number().int().positive(),
}).passthrough();

export type RealtimeIdentity = {
  userId: string;
  restaurantId: string;
  role: Role;
  exp: number;
};

export class AuthenticationError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "AuthenticationError";
  }
}

export function loadJwtSecret(secret: string | undefined): Uint8Array {
  if (!secret) {
    throw new Error("REALTIME_JWT_SECRET is required; refusing to start without authentication.");
  }
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("REALTIME_JWT_SECRET must contain at least 32 UTF-8 bytes.");
  }
  return new TextEncoder().encode(secret);
}

export async function verifyRealtimeToken(
  token: unknown,
  secret: Uint8Array,
  options: { issuer?: string; audience?: string } = {},
): Promise<RealtimeIdentity> {
  if (typeof token !== "string" || token.length === 0 || token.length > 8192) {
    throw new AuthenticationError();
  }

  try {
    const verifyOptions: {
      algorithms: ["HS256"];
      issuer?: string;
      audience?: string;
    } = { algorithms: ["HS256"] };
    if (options.issuer) verifyOptions.issuer = options.issuer;
    if (options.audience) verifyOptions.audience = options.audience;

    const { payload } = await jwtVerify(token, secret, verifyOptions);
    const claims = IdentityClaimsSchema.parse(payload as JWTPayload);
    if (claims.exp <= Math.floor(Date.now() / 1000)) {
      throw new AuthenticationError();
    }

    return {
      userId: claims.userId,
      restaurantId: claims.restaurantId,
      role: claims.role,
      exp: claims.exp,
    };
  } catch {
    // Keep signature, claim, and expiry failures indistinguishable to clients.
    throw new AuthenticationError();
  }
}
