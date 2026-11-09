import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(args, env = process.env) {
  const result = spawnSync(pnpm, args, {
    cwd: root,
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.VERCEL_ENV === "production") {
  const directDatabaseUrl =
    process.env.DIRECT_DATABASE_URL ??
    process.env.STORAGE_PRISMA_DATABASE_URL ??
    process.env.STORAGE_POSTGRES_URL;
  if (!directDatabaseUrl) {
    throw new Error(
      "Production migrations require DIRECT_DATABASE_URL or the direct Prisma Storage URL (STORAGE_PRISMA_DATABASE_URL/STORAGE_POSTGRES_URL).",
    );
  }

  console.info("Applying pending production database migrations.");
  run(["--filter", "@13axis/database", "db:migrate:deploy"], {
    ...process.env,
    DIRECT_DATABASE_URL: directDatabaseUrl,
  });
  console.info("Production database migrations completed.");
}

run(["--filter", "@13axis/web...", "build"]);
