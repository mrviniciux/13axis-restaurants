import { pathToFileURL } from "node:url";
import { startServer } from "./server.js";

export * from "./auth.js";
export * from "./authorization.js";
export * from "./events.js";
export * from "./server.js";

const entrypoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (entrypoint) {
  startServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    if (
      message.startsWith("REALTIME_JWT_SECRET is required") ||
      message.startsWith("REALTIME_JWT_SECRET must contain") ||
      message.startsWith("SOCKET_IO_PORT must be")
    ) {
      console.error(message);
    } else {
      // Avoid leaking URLs, credentials, or provider-specific error details.
      console.error("Realtime server startup failed; check server configuration and dependencies.");
    }
    process.exitCode = 1;
  });
}
