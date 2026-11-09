import { createServer, type Server as HttpServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createAdapter } from "@socket.io/redis-adapter";
import { RoleSchema, type Role } from "@13axis/shared";
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
  /** Estado atual da conexão com Redis, reportado em GET /health. */
  redisStatus?: () => "connected" | "disconnected" | "disabled";
};

type HttpRequest = import("node:http").IncomingMessage;
type HttpResponse = import("node:http").ServerResponse;
type RedisStatus = () => "connected" | "disconnected" | "disabled";

function writeJson(
  response: HttpResponse,
  status: number,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload),
    ...extraHeaders,
  });
  response.end(payload);
}

function handleHttpRequest(
  request: HttpRequest,
  response: HttpResponse,
  io: SocketIOServer,
  secret: Uint8Array,
  redisStatus: RedisStatus,
): void {
  const path = (request.url ?? "/").split("?", 1)[0] ?? "/";

  // Health check sem autenticação: processo vivo e estado do Redis, sem
  // expor versão, credenciais ou detalhes internos.
  if (path === "/health") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      writeJson(
        response,
        405,
        { error: "method_not_allowed" },
        { allow: "GET, HEAD" },
      );
      return;
    }
    const payload = JSON.stringify({ status: "ok", redis: redisStatus() });
    response.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store",
      "content-length": Buffer.byteLength(payload),
    });
    response.end(request.method === "HEAD" ? undefined : payload);
    return;
  }

  // O Socket.IO registra o próprio listener de requisições; não responder
  // por ele para não conflitar com o handshake e o long-polling.
  if (path.startsWith("/socket.io")) return;

  if (path === "/internal/events") {
    if (request.method !== "POST") {
      writeJson(
        response,
        405,
        { error: "method_not_allowed" },
        { allow: "POST" },
      );
      return;
    }
    const authorization = request.headers.authorization;
    const provided = authorization?.startsWith("Bearer ")
      ? Buffer.from(authorization.slice(7), "utf8")
      : Buffer.alloc(0);
    const expected = Buffer.from(secret);
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      writeJson(response, 401, { error: "unauthorized" });
      return;
    }
    if (
      !request.headers["content-type"]
        ?.toLowerCase()
        .startsWith("application/json")
    ) {
      writeJson(response, 415, { error: "unsupported_media_type" });
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
        writeJson(response, 413, { error: "payload_too_large" });
        return;
      }
      chunks.push(buffer);
    });
    request.on("end", () => {
      if (response.writableEnded) return;
      try {
        const body: unknown = JSON.parse(
          Buffer.concat(chunks).toString("utf8"),
        );
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
        writeJson(response, 202, { accepted: true });
      } catch {
        writeJson(response, 400, { error: "invalid_event" });
      }
    });
    return;
  }

  // Caminho desconhecido: responder 404 em vez de deixar a requisição
  // pendurada até o cliente desistir.
  writeJson(response, 404, { error: "not_found" });
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
    handleHttpRequest(
      request,
      response,
      io,
      config.jwtSecret,
      config.redisStatus ??
        ((): "connected" | "disconnected" | "disabled" => "disabled"),
    );
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
      expiryTimer = setTimeout(
        disconnectAtExpiry,
        Math.min(remainingMs, 2_147_000_000),
      );
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
  const allowedRoles = rolesForEvent(name).filter((role: Role) =>
    canReceiveEvent(role, name),
  );

  // Socket.IO room unions deduplicate sockets which happen to occupy more than
  // one target room. Each target is derived from the validated event tenant.
  const targets = allowedRoles.map((role) =>
    restaurantRoleRoom(restaurantId, role),
  );
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

export type RealtimeRuntime = {
  io: SocketIOServer;
  httpServer: HttpServer;
  port: number;
  host: string;
  close: () => Promise<void>;
};

/**
 * Monta o runtime (auth, Socket.IO e Redis opcional) sem abrir listener.
 * É o caminho usado como entrypoint em plataformas que roteiam requisições
 * para o `http.Server` exportado (Vercel Services); `startServer` adiciona
 * o listen para dev local e Docker.
 */
export async function createRuntime(
  env: NodeJS.ProcessEnv = process.env,
): Promise<RealtimeRuntime> {
  // Validate required auth before opening a listener or attempting Redis.
  const jwtSecret = loadJwtSecret(env.REALTIME_JWT_SECRET);
  // SOCKET_IO_PORT (dev/Docker) tem prioridade; PORT é o padrão de plataformas.
  const port = parsePort(env.SOCKET_IO_PORT || env.PORT || undefined);
  const host = env.HOST || "0.0.0.0";
  const httpServer = createServer();
  let redisPublisher: ReturnType<typeof createClient> | undefined;
  let redisSubscriber: ReturnType<typeof createClient> | undefined;
  const io = createRealtimeServer(httpServer, {
    jwtSecret,
    jwtIssuer: env.REALTIME_JWT_ISSUER,
    jwtAudience: env.REALTIME_JWT_AUDIENCE,
    corsOrigins: parseCorsOrigins(env.REALTIME_CORS_ORIGINS),
    redisStatus: () => {
      if (!env.REDIS_URL) return "disabled";
      return redisPublisher?.isOpen ? "connected" : "disconnected";
    },
  });

  try {
    if (env.REDIS_URL) {
      redisPublisher = createClient({ url: env.REDIS_URL });
      redisSubscriber = redisPublisher.duplicate();
      redisPublisher.on("error", () =>
        console.error("Redis publisher connection error."),
      );
      redisSubscriber.on("error", () =>
        console.error("Redis subscriber connection error."),
      );
      await Promise.all([redisPublisher.connect(), redisSubscriber.connect()]);
      io.adapter(createAdapter(redisPublisher, redisSubscriber));
    }
  } catch (error) {
    io.close();
    await Promise.allSettled([
      redisPublisher?.isOpen ? redisPublisher.quit() : Promise.resolve(),
      redisSubscriber?.isOpen ? redisSubscriber.quit() : Promise.resolve(),
    ]);
    throw error;
  }

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

  return { io, httpServer, port, host, close };
}

/**
 * Mensagem de erro segura para logs de startup: só repassa detalhes de
 * configuração de auth/porta; o resto vira um texto genérico para não
 * vazar URLs, credenciais ou detalhes do provedor.
 */
export function describeStartupError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (
    message.startsWith("REALTIME_JWT_SECRET is required") ||
    message.startsWith("REALTIME_JWT_SECRET must contain") ||
    message.startsWith("SOCKET_IO_PORT must be")
  ) {
    return message;
  }
  return "Realtime server startup failed; check server configuration and dependencies.";
}

export async function startServer(
  env: NodeJS.ProcessEnv = process.env,
): Promise<RealtimeRuntime> {
  const runtime = await createRuntime(env);
  try {
    await new Promise<void>((resolve, reject) => {
      runtime.httpServer.once("error", reject);
      runtime.httpServer.listen(runtime.port, runtime.host, () => {
        runtime.httpServer.off("error", reject);
        resolve();
      });
    });
  } catch (error) {
    // Mesmo caminho de limpeza do erro de montagem: encerra io e Redis.
    await runtime.close();
    throw error;
  }

  console.info(
    `Realtime Socket.IO listening on ${runtime.host}:${runtime.port}; Redis adapter ${env.REDIS_URL ? "enabled" : "disabled"}.`,
  );

  return runtime;
}

export { RoleSchema };
