import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";

const workspaceEnv = resolve(import.meta.dirname, "../../.env");
if (existsSync(workspaceEnv)) {
  loadEnvFile(workspaceEnv);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
