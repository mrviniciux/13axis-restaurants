import { pathToFileURL } from "node:url";
import { describeStartupError, startServer } from "./server.js";

export * from "./auth.js";
export * from "./authorization.js";
export * from "./events.js";
export * from "./server.js";

const entrypoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href === import.meta.url
  : false;

if (entrypoint) {
  startServer().catch((error: unknown) => {
    console.error(describeStartupError(error));
    process.exitCode = 1;
  });
}
