# `@mudra/realtime`

Standalone Node.js Socket.IO service for restaurant-scoped operational notifications. It is a notification channel only: PostgreSQL/API remains canonical, and connected clients cannot create or mutate orders, items, tables, or menu data through Socket.IO.

## Requirements and run

- Node.js `>=22` and pnpm workspace dependencies installed.
- `REALTIME_JWT_SECRET` is **required**. Startup fails before listening if it is missing or shorter than 32 UTF-8 bytes. No anonymous or development bypass exists.
- `SOCKET_IO_PORT` (default `3001`), optional `HOST` (default `0.0.0.0`).
- Optional `REALTIME_CORS_ORIGINS`: comma-separated exact browser origins. An unset/empty value disables cross-origin browser polling; it does not replace authentication.
- Optional `REALTIME_JWT_ISSUER` and `REALTIME_JWT_AUDIENCE`: when set, both are checked against the verified JWT.
- Optional `REDIS_URL`: when set, the service connects publisher/subscriber Redis clients and installs the Socket.IO Redis Adapter before listening. Redis failure is a startup failure; it never silently downgrades to a single-instance adapter. Without this variable, Socket.IO uses its in-process adapter.

The JWT secret is treated as UTF-8 text, not base64-decoded. Configure the same signing key only in trusted server environments; never put it in a browser/mobile bundle, client response, URL, source control, or logs. Use a securely generated value of at least 32 bytes and rotate it through a coordinated deployment.

```sh
pnpm --filter @mudra/realtime dev
pnpm --filter @mudra/realtime build
pnpm --filter @mudra/realtime start
```

Turbo-compatible scripts are provided for `build`, `lint`, `typecheck`, and `test`.

## JWT handshake contract

The client sends its short-lived signed token in the Socket.IO handshake `auth` object (never query parameters):

```ts
const socket = io(REALTIME_URL, {
  auth: { token: shortLivedRealtimeJwt },
  // Socket.IO reconnects automatically; polling remains available as fallback.
  transports: ["polling", "websocket"],
});
```

Accepted tokens must be compact JWTs signed with **HS256** using `REALTIME_JWT_SECRET` and contain:

| Claim | Requirement |
|---|---|
| `userId` | UUID v7 for the authenticated user |
| `restaurantId` | UUID v7 for the restaurant the user is authorized to access |
| `role` | One of `ADMIN`, `MANAGER`, `WAITER`, `CASHIER`, `KITCHEN`, `SCALE` |
| `exp` | Standard numeric JWT expiration, required and in the future |
| `iss`, `aud` | Optional unless the corresponding realtime environment setting is configured |

The service validates signature, algorithm, expiration and claims before assigning room membership. Missing claims, invalid roles, expiration and invalid signatures return the same generic `unauthorized` connection error. The restaurant and role come exclusively from verified signed claims; client event payloads and requested room names are not used to grant access. Tokens are rechecked on every reconnect. An established connection is forcibly disconnected at token expiration so the client must reconnect with a newly authenticated token.

`REALTIME_JWT_SECRET` is a dedicated verifier/signing secret. Do **not** assume an Auth.js session cookie or Auth.js encrypted session JWT is acceptable as-is: Auth.js does not currently issue this realtime token. A future authenticated server-side Auth.js session flow must validate the logged-in user and active restaurant membership, map the canonical role, then issue a short-lived HS256 JWT with these claims using the shared secret. The browser/app should receive only that short-lived token from the future server-side flow. Token issuance, refresh/revocation, membership lookup and that Auth.js endpoint are not implemented here.

This MVP verifies signed claims but does not query the database for user suspension or membership revocation. Keep tokens short-lived and ensure the issuer only mints them after authoritative authorization; add a revocation/active-membership strategy before relying on long sessions in production.

## Rooms and event role matrix

All rooms are computed and joined by the server after authentication:

- `restaurant:<restaurantId>` — authenticated operational profiles.
- `restaurant:<restaurantId>:kitchen` — `KITCHEN` only.
- Internal `restaurant:<restaurantId>:role:<role>` rooms are server-derived fan-out targets, used to enforce the per-event role matrix. Clients cannot request/join these rooms.

`SCALE` is a recognized shared role but has no room access because its permissions are explicitly unmapped in `@mudra/shared`. Event policy is explicit:

| Server → client event | Allowed roles |
|---|---|
| `order:created` | `ADMIN`, `MANAGER`, `WAITER`, `CASHIER`, `KITCHEN` |
| `order:item:added` | `ADMIN`, `MANAGER`, `WAITER`, `KITCHEN` |
| `order:item:status` | `ADMIN`, `MANAGER`, `WAITER`, `KITCHEN` |
| `order:updated` | `ADMIN`, `MANAGER`, `WAITER`, `CASHIER`, `KITCHEN` |
| `order:closed` | `ADMIN`, `MANAGER`, `WAITER`, `CASHIER`, `KITCHEN` |
| `table:status` | `ADMIN`, `MANAGER`, `WAITER`, `CASHIER`, `KITCHEN` |
| `menu:updated` | `ADMIN`, `MANAGER`, `WAITER` |

There are no client-to-server domain event handlers. A room grants notification visibility only and never authorizes an API write. The REST/sync API must independently reauthorize each mutation.

## Event envelope and payloads

The channel names and minimal data fields follow `specification.md` section 8.2 and `docs/architecture/realtime-contracts.md`. Payload schemas are strict Zod schemas and use shared UUID v7, timestamp, order-item, status and money types from `@mudra/shared`. Every notification uses the proposed contract envelope:

```ts
{
  eventId: string;          // UUID v7; stable across retries for this fact
  schemaVersion: 1;
  restaurantId: string;     // tenant of the committed change
  occurredAt: string;       // UTC ISO-8601
  aggregate: {
    type: "order" | "orderItem" | "table" | "menuItem";
    id: string;             // UUID v7
    version: number;        // positive canonical aggregate version
  };
  mutationId?: string;      // source sync mutation, when present
  data: object;             // event-specific, strict schema
}
```

| Event | `data` |
|---|---|
| `order:created` | `{ orderId, tableId }` |
| `order:item:added` | `{ orderId, tableId, item }`; `item` is the canonical shared `OrderItem` DTO |
| `order:item:status` | `{ orderId, itemId, status }`; shared status enum |
| `order:updated` | `{ orderId, changes }`; only `tableId`, `waiterId`, `status`, `total` |
| `order:closed` | `{ orderId, tableId }` |
| `table:status` | `{ tableId, status }`; shared table status enum |
| `menu:updated` | `{ itemId, changes }`; only category, name, price, description, image, code and availability |

`changes` rejects unknown fields and empty patches. The envelope is the proposed envelope in the architecture contract, not yet a cross-package frozen schema; coordinate adoption with API, web, Android and `packages/shared`. `order:closed` is implemented as a notification contract only: callers must publish it only after the canonical close operation commits. It does not imply a payment or validate closure rules.

Trusted in-process code can publish a validated server event with `publishDomainEvent(io, eventName, payload)`. Call this only after a successful canonical persistence/commit, preferably from a transactional outbox publisher. Duplicate delivery must be harmless: events never mutate business state; consumers should deduplicate by `eventId`, compare aggregate versions and pull canonical state when versions skip. This package does not expose a network-level authenticated publisher endpoint/client yet; coordinating that API-to-process bridge is a separate deployment integration.

## Runtime resilience and failures

- Socket.IO provides automatic reconnection on the client and polling fallback when WebSocket transport is unavailable; disconnected clients must reconcile through API sync/pull because the service does not persist missed events.
- `REDIS_URL` enables cross-instance Socket.IO fan-out only. It is not a durable queue or outbox. Redis disconnection is logged as a fixed message with no connection details; configure process supervision/health monitoring and recover/restart according to deployment policy.
- Invalid/malformed event payloads throw before fan-out. Internal callers should handle that as an application contract error, not report mutation success as a realtime delivery guarantee.
- The service does not implement payments, iFood, Claude, external provider calls, or provider mocks.

## Compatibility choices

Versions selected and checked against the package registry at implementation time: Socket.IO `4.8.4`; `@socket.io/redis-adapter` `8.3.0` (Socket.IO adapter peer range `^2.5.4`); Redis client `5.12.1` (Node `>=20`); JOSE `6.2.15`; Zod `4.6.7`. The repository targets Node `>=22`; the shared package already uses Zod `4.6.7`. The adapter is only installed when `REDIS_URL` is configured.
