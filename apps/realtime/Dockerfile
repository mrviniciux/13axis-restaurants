# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Imagem de produção do serviço de tempo real (Socket.IO).
# O build context é a RAIZ do monorepo:
#   docker build -f apps/realtime/Dockerfile .
# O web e o realtime são processos Node.js independentes, em imagens separadas.
# ---------------------------------------------------------------------------
FROM node:22-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable

WORKDIR /repo

# Contexto completo do monorepo para o install respeitar o pnpm-lock.yaml.
COPY . .

# Dependências do realtime e do @mudra/shared (sem Next.js/Prisma).
RUN --mount=type=cache,id=mudra-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @mudra/realtime... --store-dir /pnpm/store

# Compila TypeScript para dist/ (tsc); dependências do workspace primeiro.
RUN pnpm --filter @mudra/realtime... build

# ---------------------------------------------------------------------------
FROM node:22-slim AS runner

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV SOCKET_IO_PORT=3001

WORKDIR /repo

# Runtime enxuto: manifestos, node_modules (pnpm), workspace compartilhado e
# o app compilado. Os symlinks relativos do pnpm são preservados.
COPY --from=build --chown=node:node /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/packages/shared ./packages/shared
COPY --from=build --chown=node:node /repo/apps/realtime ./apps/realtime

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/realtime/dist/index.js"]
