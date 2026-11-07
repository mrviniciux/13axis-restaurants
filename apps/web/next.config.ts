import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

const workspaceEnv = resolve(import.meta.dirname, '../../.env');
if (existsSync(workspaceEnv)) {
  loadEnvFile(workspaceEnv);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Gera .next/standalone com apenas os arquivos necessários ao runtime,
  // usado pela imagem de produção em apps/web/Dockerfile.
  output: 'standalone',
  // Em monorepo o rastreamento precisa alcançar packages/* (shared/database),
  // que ficam fora de apps/web.
  outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
};

export default nextConfig;
