import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createRealtimeServer } from "../src/server.js";

const secret = new TextEncoder().encode("a-test-secret-longer-than-thirty-two-bytes");
const eventPayload = {
  eventId: "018f47a2-7b6c-7abc-8def-4123456789ab",
  schemaVersion: 1,
  restaurantId: "018f47a2-7b6c-7abc-8def-1123456789ab",
  occurredAt: "2026-01-01T12:00:00.000Z",
  aggregate: {
    type: "order",
    id: "018f47a2-7b6c-7abc-8def-2123456789ab",
    version: 3,
  },
  data: { orderId: "018f47a2-7b6c-7abc-8def-2123456789ab" },
};

describe("internal realtime event publisher", () => {
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await closeServer?.();
    closeServer = undefined;
  });

  it("requires the shared secret and publishes valid order-change events", async () => {
    const httpServer = createServer();
    const io = createRealtimeServer(httpServer, { jwtSecret: secret });
    closeServer = () => new Promise((resolve) => io.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");
    const endpoint = `http://127.0.0.1:${address.port}/internal/events`;
    const body = JSON.stringify({ name: "order:changed", payload: eventPayload });

    const unauthorized = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    expect(unauthorized.status).toBe(401);

    const accepted = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${Buffer.from(secret).toString("utf8")}`,
        "content-type": "application/json",
      },
      body,
    });
    expect(accepted.status).toBe(202);
    await expect(accepted.json()).resolves.toEqual({ accepted: true });

    const invalid = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${Buffer.from(secret).toString("utf8")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "order:changed", payload: { ...eventPayload, data: {} } }),
    });
    expect(invalid.status).toBe(400);
  });
});
