import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { AuthenticationError, loadJwtSecret, verifyRealtimeToken } from "../src/auth.js";

const secret = loadJwtSecret("a-test-secret-that-is-at-least-32-bytes");
const userId = "018f47a2-7b6c-7abc-8def-0123456789ab";
const restaurantId = "018f47a2-7b6c-7abc-8def-1123456789ab";

async function token(claims: Record<string, unknown> = {}) {
  return new SignJWT({
    userId,
    restaurantId,
    role: "WAITER",
    ...claims,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secret);
}

describe("realtime JWT authentication", () => {
  it("fails closed when the secret is missing or too short", () => {
    expect(() => loadJwtSecret(undefined)).toThrow(/REALTIME_JWT_SECRET is required/);
    expect(() => loadJwtSecret("short")).toThrow(/at least 32/);
  });

  it("accepts a signed token with required identity claims", async () => {
    await expect(verifyRealtimeToken(await token(), secret)).resolves.toMatchObject({
      userId,
      restaurantId,
      role: "WAITER",
    });
  });

  it("rejects a token signed by another key", async () => {
    const forged = await token();
    await expect(verifyRealtimeToken(forged, new TextEncoder().encode("a-different-key-with-at-least-32-bytes")))
      .rejects.toBeInstanceOf(AuthenticationError);
  });

  it("rejects missing identity claims and invalid roles", async () => {
    const missingIdentity = await new SignJWT({ role: "WAITER" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("5m")
      .sign(secret);
    const invalidRole = await token({ role: "OWNER" });
    await expect(verifyRealtimeToken(missingIdentity, secret)).rejects.toBeInstanceOf(AuthenticationError);
    await expect(verifyRealtimeToken(invalidRole, secret)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it("rejects expired JWTs", async () => {
    const expired = await new SignJWT({ userId, restaurantId, role: "WAITER" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 30)
      .sign(secret);
    await expect(verifyRealtimeToken(expired, secret)).rejects.toBeInstanceOf(AuthenticationError);
  });
});
