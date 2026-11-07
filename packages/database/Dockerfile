# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Imagem de ferramentas: migrações e CLIs do Prisma (create-admin, seeds).
# Não é um serviço de longa duração; executa sob demanda:
#   docker compose --profile migrate run --rm migrate
#   docker compose --profile migrate run --rm migrate pnpm --filter @mudra/database create-admin
# O build context é a RAIZ do monorepo.
# ---------------------------------------------------------------------------
FROM node:22-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable

# Necessário para o Prisma detectar a variante correta do engine (ver
# apps/web/Dockerfile); `prisma migrate deploy` usa o CLI nesta imagem.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

COPY . .

# Inclui devDependencies (Prisma CLI e TypeScript) — necessários para
# `prisma migrate deploy`, `create-admin` e os seeds.
RUN --mount=type=cache,id=mudra-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @mudra/database... --store-dir /pnpm/store

CMD ["pnpm", "--filter", "@mudra/database", "db:migrate:deploy"]
