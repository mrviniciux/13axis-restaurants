import { createServer, type Server as HttpServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createAdapter } from "@socket.io/redis-adapter";
import { RoleSchema, type Role } from "@mudra/shared";
import { createClient } from "redis";
import { Server as SocketIOServer, type Socket } from "socket.io";
import {
  loadJwtSecret,
  verifyRealtimeToken,
  type RealtimeIdentity,
} from "./auth.js";
import {
  canJoinRestaurantRoom,
  canReceiveEvent,
  restaurantRoleRoom,
  roomsForIdentity,
  rolesForEvent,
} from "./authorization.js";
import {
  parseRealtimeEvent,
  type RealtimeEventName,
  type RealtimeEventPayload,
} from "./events.js";

declare module "socket.io" {
  interface SocketData {
    identity: RealtimeIdentity;
  }
}

export type RealtimeServerConfig = {
  jwtSecret: Uint8Array;
  jwtIssuer?: string;
  jwtAudience?: string;
  corsOrigins?: readonly string[];
};

function publishHttpEvent(
  request: import("node:http").IncomingMessage,
  response: import("node:http").ServerResponse,
  io: SocketIOServer,
  secret: Uint8Array,
): void {
  if (request.method !== "POST" || request.url !== "/internal/events") return;
  const authorization = request.headers.authorization;
  const provided = authorization?.startsWith("Bearer ")
    ? Buffer.from(authorization.slice(7), "utf8")
    : Buffer.alloc(0);
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "unauthorized" }));
    return;
  }
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
    response.writeHead(415, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "unsupported_media_type" }));
    return;
  }

  const chunks: Buffer[] = [];
  let size = 0;
  let rejected = false;
  request.on("data", (chunk: Buffer | string) => {
    if (rejected) return;
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 16_384) {
      rejected = true;
      response.writeHead(413, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "payload_too_large" }));
      return;
    }
    chunks.push(buffer);
  });
  request.on("end", () => {
    if (response.writableEnded) return;
    try {
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (
        body === null ||
        typeof body !== "object" ||
        !("name" in body) ||
        typeof body.name !== "string" ||
        !("payload" in body)
      ) {
        throw new Error("invalid_event");
      }
      const name = body.name as RealtimeEventName;
      const payload = parseRealtimeEvent(name, body.payload);
      publishDomainEvent(io, name, payload);
      response.writeHead(202, { "content-type": "application/json" });
      response.end(JSON.stringify({ accepted: true }));
    } catch {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "invalid_event" }));
    }
  });
}

export function createRealtimeServer(
  httpServer: HttpServer,
  config: RealtimeServerConfig,
): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    serveClient: false,
    transports: ["polling", "websocket"],
    cors: {
      origin: config.corsOrigins?.length ? [...config.corsOrigins] : false,
      credentials: false,
    },
  });
  httpServer.on("request", (request, response) => {
    publishHttpEvent(request, response, io, config.jwtSecret);
  });

  io.use(async (socket, next) => {
    try {
      const identity = await verifyRealtimeToken(
        socket.handshake.auth?.token,
        config.jwtSecret,
        { issuer: config.jwtIssuer, audience: config.jwtAudience },
      );
      if (!canJoinRestaurantRoom(identity.role)) {
        next(new Error("unauthorized"));
        return;
      }
      socket.data.identity = identity;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket: Socket) => {
    // All room names are derived from verified claims on the server.
    void socket.join(roomsForIdentity(socket.data.identity));
    let expiryTimer: NodeJS.Timeout | undefined;
    const disconnectAtExpiry = (): void => {
      const remainingMs = socket.data.identity.exp * 1000 - Date.now();
      if (remainingMs <= 0) {
        socket.disconnect(true);
        return;
      }
      // Avoid Node's timer overflow for unusually long-lived tokens; checking
      // again early is safe and still guarantees disconnection by exp.
      expiryTimer = setTimeout(disconnectAtExpiry, Math.min(remainingMs, 2_147_000_000));
    };
    disconnectAtExpiry();
    socket.once("disconnect", () => clearTimeout(expiryTimer));
    // There are deliberately no client-to-server domain event handlers.
  });

  return io;
}

export function publishDomainEvent<Name extends RealtimeEventName>(
  io: Pick<SocketIOServer, "to">,
  name: Name,
  payload: RealtimeEventPayload<Name>,
): void {
  const validatedPayload = parseRealtimeEvent(name, payload);
  const restaurantId = validatedPayload.restaurantId;
  const allowedRoles = rolesForEvent(name).filter((role: Role) => canReceiveEvent(role, name));

  // Socket.IO room unions deduplicate sockets which happen to occupy more than
  // one target room. Each target is derived from the validated event tenant.
  const targets = allowedRoles.map((role) => restaurantRoleRoom(restaurantId, role));
  if (targets.length === 0) return;
  io.to(targets).emit(name, validatedPayload);
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? "3001");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SOCKET_IO_PORT must be an integer between 1 and 65535.");
  }
  return port;
}

function parseCorsOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export async function startServer(env: NodeJS.ProcessEnv = process.env): Promise<{
  io: SocketIOServer;
  httpServer: HttpServer;
  close: () => Promise<void>;
}> {
  // Validate required auth before opening a listener or attempting Redis.
  const jwtSecret = loadJwtSecret(env.REALTIME_JWT_SECRET);
  const port = parsePort(env.SOCKET_IO_PORT);
  const host = env.HOST || "0.0.0.0";
  const httpServer = createServer();
  const io = createRealtimeServer(httpServer, {
    jwtSecret,
    jwtIssuer: env.REALTIME_JWT_ISSUER,
    jwtAudience: env.REALTIME_JWT_AUDIENCE,
    corsOrigins: parseCorsOrigins(env.REALTIME_CORS_ORIGINS),
  });

  let redisPublisher: ReturnType<typeof createClient> | undefined;
  let redisSubscriber: ReturnType<typeof createClient> | undefined;
  try {
    if (env.REDIS_URL) {
      redisPublisher = createClient({ url: env.REDIS_URL });
      redisSubscriber = redisPublisher.duplicate();
      redisPublisher.on("error", () => console.error("Redis publisher connection error."));
      redisSubscriber.on("error", () => console.error("Redis subscriber connection error."));
      await Promise.all([redisPublisher.connect(), redisSubscriber.connect()]);
      io.adapter(createAdapter(redisPublisher, redisSubscriber));
    }

    await new Promise<void>((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(port, host, () => {
        httpServer.off("error", reject);
        resolve();
      });
    });
  } catch (error) {
    io.close();
    await Promise.allSettled([
      redisPublisher?.isOpen ? redisPublisher.quit() : Promise.resolve(),
      redisSubscriber?.isOpen ? redisSubscriber.quit() : Promise.resolve(),
    ]);
    throw error;
  }

  console.info(`Realtime Socket.IO listening on ${host}:${port}; Redis adapter ${env.REDIS_URL ? "enabled" : "disabled"}.`);

  let closing: Promise<void> | undefined;
  const close = (): Promise<void> => {
    closing ??= (async () => {
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await Promise.allSettled([
        redisPublisher?.isOpen ? redisPublisher.quit() : Promise.resolve(),
        redisSubscriber?.isOpen ? redisSubscriber.quit() : Promise.resolve(),
      ]);
    })();
    return closing;
  };

  return { io, httpServer, close };
}

export { RoleSchema };
