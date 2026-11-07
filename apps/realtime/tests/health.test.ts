import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createRealtimeServer } from "../src/server.js";

const secret = new TextEncoder().encode("a-test-secret-longer-than-thirty-two-bytes");

describe("realtime health and http routing", () => {
  let closeServer: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await closeServer?.();
    closeServer = undefined;
  });

  async function startServer(redisStatus?: () => "connected" | "disconnected" | "disabled") {
    const httpServer = createServer();
    const io = createRealtimeServer(httpServer, { jwtSecret: secret, redisStatus });
    closeServer = () => new Promise((resolve) => io.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");
    return `http://127.0.0.1:${address.port}`;
  }

  it("responds to GET /health without authentication", async () => {
    const base = await startServer(() => "disabled");

    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok", redis: "disabled" });
  });

  it("reports the current redis state in GET /health", async () => {
    const base = await startServer(() => "connected");

    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok", redis: "connected" });
  });

  it("rejects non-GET methods on /health with 405", async () => {
    const base = await startServer();

    const response = await fetch(`${base}/health`, { method: "POST" });
    expect(response.status).toBe(405);
  });

  it("answers 404 for unknown paths instead of hanging", async () => {
    const base = await startServer();

    const response = await fetch(`${base}/definitely-not-a-route`);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "not_found" });
  });

  it("leaves Socket.IO paths to the Socket.IO request listener", async () => {
    const base = await startServer();

    const response = await fetch(`${base}/socket.io/?EIO=4&transport=polling`);
    expect(response.status).toBe(200);
    const body = await response.text();
    // Engine.IO handshake: pacote de abertura "0" seguido do payload JSON.
    expect(body.startsWith("0")).toBe(true);
  });
});
