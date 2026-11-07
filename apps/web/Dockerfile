# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Imagem de produção do back-office (Next.js 16, output: "standalone").
# O build context é a RAIZ do monorepo:
#   docker build -f apps/web/Dockerfile .
# O build roda em Linux, gerando Prisma Client e binários nativos (argon2)
# para a plataforma de execução — nunca copiar node_modules do Windows.
# ---------------------------------------------------------------------------
FROM node:22-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable

# Prisma (detecção de variante do engine) precisa do binário `openssl`; sem
# ele, `prisma generate`/migrate avisa "failed to detect libssl/openssl
# version" e assume openssl-1.1.x por padrão.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

# Contexto completo do monorepo para o install respeitar o pnpm-lock.yaml.
COPY . .

# Instala as dependências do web e dos pacotes do workspace
# (@mudra/shared e @mudra/database). O store fica em cache mount para
# reutilizar os downloads entre builds.
RUN --mount=type=cache,id=mudra-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @mudra/web... --store-dir /pnpm/store

# Placeholders apenas para o build (mesma abordagem da CI): o Prisma Client
# precisa de DATABASE_URL válido para gerar, e o prerender das páginas
# autenticadas (generateStaticParams + auth()) precisa de AUTH_SECRET para
# alcançar a leitura de cookies e marcar a rota como dinâmica. Nada disso é
# embutido no bundle: NEXT_PUBLIC_* e NODE_ENV são os únicos inlined; o
# container recebe os valores reais em runtime.
ENV DATABASE_URL="postgresql://ci:ci@localhost:5432/ci?schema=public"
ENV AUTH_SECRET="build-only-placeholder-not-used-at-runtime"

# URL pública do Socket.IO, embutida no bundle durante o build.
ARG NEXT_PUBLIC_REALTIME_URL=http://localhost:3001
ENV NEXT_PUBLIC_REALTIME_URL=$NEXT_PUBLIC_REALTIME_URL

RUN pnpm --filter @mudra/web... build

# ---------------------------------------------------------------------------
FROM node:22-slim AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# O client Prisma em runtime também detecta o OpenSSL (mesmo aviso do build).
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Apenas os arquivos rastreados pelo Next (standalone) + assets estáticos.
# server.js fica em apps/web/ porque o outputFileTracingRoot é a raiz do
# monorepo.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "apps/web/server.js"]
