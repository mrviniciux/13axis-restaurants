# Estratégia de deploy — Mudra for Restaurants

**Status:** proposta operacional para o MVP. Os Dockerfiles de produção
(`apps/web`, `apps/realtime`, `packages/database`), o `compose.yaml`, o
`vercel.json` (services e bindings) e os health checks estão versionados; a
automação de deploy na CI ainda não está implementada.

**Última revisão:** 07/11/2026

**Base:** `specification.md` (§§ 12–13), `README.md`,
`docs/architecture/realtime-contracts.md`, `apps/realtime/README.md` e o
workflow atual em `.github/workflows/ci.yml`.

## 1. Resumo da decisão

A recomendação é hospedar o back-office e o serviço de tempo real como dois
processos Node.js independentes em containers Docker em um servidor **Hetzner**
único, publicados pelo **Coolify**, com **PostgreSQL 16 em container** no
mesmo servidor e **Redis opcional**. O Railway permanece como alternativa PaaS
sem operação de servidor (seção 5.4). O app Android é distribuído separadamente
pelo **Expo EAS**.

| Componente                 | Decisão                                                            | Observação                                                        |
| -------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Web (`apps/web`)           | Next.js 16 (`output: "standalone"`) em container próprio           | Serve UI, API Routes e Auth.js; não usar export estático          |
| Realtime (`apps/realtime`) | Container Socket.IO independente                                    | WebSocket/WSS público e endpoint interno de publicação            |
| Banco                      | PostgreSQL 16 em container no servidor                             | Volume persistente; backup automático Hetzner                     |
| Publicação                 | Coolify self-hosted (grátis)                                        | git push → build Docker, proxy com TLS e health checks            |
| Redis                      | Opcional no MVP, obrigatório para múltiplas instâncias do realtime | Quando `REDIS_URL` é definido, o realtime não inicia sem Redis    |
| Mobile (`apps/mobile`)     | Expo EAS Build                                                     | APK interno no piloto; AAB/Play Store depois                      |
| CI                         | GitHub Actions                                                     | Já executa lint, typecheck, testes e build; deploy via Coolify    |
| Observabilidade            | Logs do servidor; Sentry previsto                                  | Sentry ainda não está integrado ao código                         |

O modelo atual é **uma instalação por restaurante**: o CLI `create-admin` cria
um restaurante e seu primeiro `ADMIN` e recusa a operação se já existir
restaurante no banco. Não há um plano de controle multi-tenant; cada restaurante
deve ter seu próprio projeto/banco.

> A especificação cita Railway como opção recomendada e Hetzner + Coolify como
> alternativa de custo. Esta estratégia usa **Hetzner + Coolify como prioridade**
> (ver `orcamento-whatsapp.md` e `pesquisa-opcoes-baratas.md`); o Railway está
> descrito como alternativa na seção 5.4 e o Vercel (services) na seção 5.5.

## 2. Arquitetura alvo

```text
                         Internet / HTTPS (Coolify / Traefik)
                                │
          ┌─────────────────────┼──────────────────────┐
          │                     │                      │
   app.exemplo.com      realtime.exemplo.com     App Android
   container: web        container: realtime     (EAS / HTTPS/WSS)
   Next.js (16)          Socket.IO
          │                     │
          │  rede interna       │
          └── /internal/events ─┘
          │                     │
          │ Prisma              └── Redis (opcional,
          ▼                          apenas com múltiplas
   PostgreSQL (container)           instâncias)
```

Fluxos importantes:

- O navegador e o Android falam com o web por HTTPS. O Socket.IO usa WSS e um
  JWT curto obtido em `GET /api/realtime-token`.
- O web publica eventos no realtime pela URL interna da rede Docker
  (`REALTIME_INTERNAL_URL`, por exemplo `http://realtime:3001`), usando o
  endpoint `POST /internal/events`; esse endpoint não é uma API pública de
  negócio.
- O PostgreSQL é acessado somente pelo web e pelo serviço pontual de
  migração. O realtime não precisa de banco no estado atual.
- O Redis é usado apenas como adapter de fan-out do Socket.IO. Ele não é fila
  durável e não substitui o banco nem a reconciliação por API.

## 3. Ambientes

| Ambiente       | Uso                     | Banco e Redis                                      | Regras                                                                                    |
| -------------- | ----------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Local          | Desenvolvimento         | PostgreSQL do `compose.yaml`                       | Seeds de demonstração permitidos; nunca usar dados reais                                  |
| Staging        | Validação de release    | Servidor ou banco separados                       | Dados sintéticos ou cópia anonimizada; mesmas variáveis da produção                       |
| Produção       | Operação do restaurante | PostgreSQL em container com backup Hetzner; Redis somente se necessário | Dados reais, acesso restrito, backup e aprovação de deploy          |
| Preview por PR | Opcional                | Banco efêmero isolado                              | Não usar segredos nem banco de produção; se não houver isolamento, limitar ao build da CI |

Staging deve ser o mais próximo possível da produção: mesmas versões de Node,
pnpm, Next.js e Prisma, mesmas rotas e mesmo tipo de conexão com o banco. Nunca
compartilhar `AUTH_SECRET`, `REALTIME_JWT_SECRET`, banco ou Redis entre
ambientes.

## 4. Pré-requisitos antes de expor produção

Estes itens são bloqueadores ou riscos altos no estado atual:

1. **Health checks.** Implementados: `GET /api/health` no web (responde
   `{"status":"ok"}` sem autenticação e sem expor detalhes internos) e
   `GET /health` no realtime (inclui o estado do Redis: `connected`,
   `disconnected` ou `disabled`). Os healthchecks do `compose.yaml` e o
   `HEALTHCHECK` das imagens já os utilizam.
2. **Configuração de deploy.** Versionada no repositório:
   `apps/web/Dockerfile` (Next.js standalone), `apps/realtime/Dockerfile`,
   `packages/database/Dockerfile` (migrações/CLIs) e `compose.yaml`. Ainda
   falta `eas.json` para o mobile.
3. **Backup e restauração testados.** Não basta habilitar snapshot; é preciso
   executar um restore de teste em banco isolado.
4. **Mobile operacional.** O app atual é demonstrativo, não possui configuração
   de API/sincronização nem `expo-updates`. Não distribuir como app operacional
   antes de concluir autenticação, sync e definição da URL da API.
5. **Observabilidade e proteção.** Sentry, rate limiting e métricas ainda não
   estão implementados. Para o piloto, usar logs e métricas do provedor e
   limitar tentativas de login no proxy, se possível.

## 5. Build e execução

### 5.1 Toolchain

- Node.js 22 LTS (o repositório exige `>=22`; o mobile também aceita versões
  compatíveis com o Expo).
- pnpm na versão declarada em `package.json` (`pnpm@12.11.2`), preferencialmente
  via Corepack.
- Build em Linux, no mesmo tipo de ambiente do runtime. Não copiar
  `node_modules` gerados no Windows: o Prisma Client e o módulo nativo `argon2`
  precisam ser gerados/compilados para a plataforma de execução.
- Instalar dependências de build (não apenas produção) para executar Prisma CLI
  e compilar os pacotes do workspace.

```bash
corepack enable
pnpm install --frozen-lockfile --prod=false
```

`DATABASE_URL` pode ser um valor de placeholder válido durante o build para
permitir `prisma generate`; o valor real é necessário na migração e no runtime
do web. O build também precisa de um `AUTH_SECRET` de placeholder: o
`generateStaticParams` pré-renderiza as páginas autenticadas e `auth()` lança
erro sem o segredo (com ele presente, a leitura de cookies marca a rota como
dinâmica e o prerender é abortado). Placeholders de build nunca são embutidos
no bundle — só `NEXT_PUBLIC_*` e `NODE_ENV` são inlined — e os Dockerfiles e a
CI já definem esses placeholders.

### 5.2 Comandos por serviço

| Serviço              | Build                                             | Start                                 | Porta                            |
| -------------------- | ------------------------------------------------- | ------------------------------------- | -------------------------------- |
| Web                  | `pnpm --filter @mudra/web... build`               | `pnpm --filter @mudra/web start`      | `PORT` do provedor (padrão 3000) |
| Realtime             | `pnpm --filter @mudra/realtime... build`          | `pnpm --filter @mudra/realtime start` | `SOCKET_IO_PORT`                 |
| Migração             | `pnpm --filter @mudra/database db:migrate:deploy` | —                                     | —                                |
| Mobile (verificação) | `pnpm --filter @mudra/mobile build`               | —                                     | —                                |

O sufixo `...` no filtro do pnpm inclui as dependências do workspace. O build do
web precisa gerar `@mudra/shared` e `@mudra/database` antes do `next build`; o
build do realtime precisa gerar `@mudra/shared` antes do `tsc`.

O comando `pnpm build` da raiz usa Turborepo, mas também compila o export do
mobile. Para os serviços de produção, prefira os comandos filtrados acima para
evitar acoplar o deploy do web ao build mobile.

Os Dockerfiles versionados executam exatamente esses comandos em imagens
`node:22-slim`. `apps/web` e `apps/realtime` usam dois estágios — build
(instalação com lockfile congelado + compilação) e runtime enxuto — e
`packages/database` é de estágio único (migrações/CLIs). A imagem do web usa o
`output: "standalone"` do Next.js (apenas os arquivos rastreados) e a do
realtime copia o workspace `realtime + shared` com o `dist/` compilado.

### 5.3 Configuração no Hetzner com Coolify

1. Criar servidor: **CX23** (2 vCPU / 4 GB / 40 GB, ~€ 6/mês); região
   **US-Ashburn** para menor latência do Brasil. Firewall liberando apenas
   SSH (22), HTTP (80) e HTTPS (443).
2. Instalar o Coolify com o script oficial:
   `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`
3. Apontar o DNS de `app.exemplo.com` e `realtime.exemplo.com` para o
   servidor; o Coolify emite e renova o TLS automaticamente.
4. Criar um projeto com os serviços:

   | Serviço    | Origem                                          | Configuração                                                                |
   | ---------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
   | `postgres` | imagem `postgres:16`                            | volume persistente; **sem** porta exposta publicamente                     |
   | `realtime` | build `apps/realtime/Dockerfile` (contexto raiz) | porta interna 3001; health check `GET /health`                             |
   | `web`      | build `apps/web/Dockerfile` (contexto raiz)      | porta interna 3000; health check `GET /api/health`; build arg `NEXT_PUBLIC_REALTIME_URL` |
   | `migrate`  | build `packages/database/Dockerfile`            | execução pontual (migrations/CLIs); nunca expor como serviço               |

   Em vez de serviços avulsos, o Coolify também aceita apontar para o
   `compose.yaml` do repositório (inclusive o perfil `migrate`).
5. Cadastrar as variáveis da seção 6 no painel de cada serviço (Coolify
   Secret Store), com valores únicos por ambiente.
6. Manter `web` e `realtime` na mesma rede Docker: o web usa
   `REALTIME_INTERNAL_URL=http://realtime:3001`; o navegador usa
   `NEXT_PUBLIC_REALTIME_URL` com a URL pública (exige **rebuild** do web ao
   mudar, pois é embutida no bundle).
7. Habilitar o backup automático do Hetzner no volume do banco (≈ +20% do
   preço do servidor; ver seção 7.4).
8. Executar migrations e bootstrap uma única vez (seção 7.3), por exemplo
   `docker compose --profile migrate run --rm migrate` no servidor.

O Coolify faz o deploy por git push (ou webhook), roda os builds Docker,
reinicia os containers e monitora os health checks. O realtime usa
`SOCKET_IO_PORT` (3001) internamente; o proxy expõe 443/WSS na frente.

### 5.4 Alternativa: Railway

Se a operação de servidor não estiver disponível, o Railway mantém o mesmo
modelo sem servidor:

| Serviço    | Configuração                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| `web`      | Build e start da tabela 5.2; domínio público `app.exemplo.com`; health check `/api/health`                     |
| `realtime` | Build e start da tabela 5.2; domínio público `realtime.exemplo.com`; health check `/health`                    |
| `postgres` | Plugin PostgreSQL 16; rede privada; sem exposição pública                                                      |
| `redis`    | Opcional; rede privada; somente se houver mais de uma instância do realtime ou necessidade de fan-out          |

O web deve usar a URL privada do realtime em `REALTIME_INTERNAL_URL`, por
exemplo `http://realtime.railway.internal:3001`. O navegador usa
`NEXT_PUBLIC_REALTIME_URL` com a URL pública `https://realtime.exemplo.com`.
O realtime lê `SOCKET_IO_PORT`, não `PORT`. Se o provedor oferecer "watch
paths", limite cada serviço aos caminhos que o afetam: `apps/web/**`,
`packages/shared/**`, `packages/database/**` e arquivos de lock/config para o
web; `apps/realtime/**`, `packages/shared/**` e arquivos de lock/config para o
realtime.

### 5.5 Alternativa: Vercel (services)

O repositório versiona um `vercel.json` que publica web e realtime no mesmo
projeto Vercel como dois serviços (docs:
<https://vercel.com/docs/services>).

| Serviço    | Root            | Configuração                                                             |
| ---------- | --------------- | ------------------------------------------------------------------------ |
| `realtime` | `apps/realtime` | `entrypoint: src/entry.ts`; build `pnpm --filter @mudra/realtime... build` |
| `web`      | `apps/web`      | `framework: nextjs`; build `pnpm --filter @mudra/web... build`            |

Topologia:

- **Públicos:** `web` em `/(.*)` (catch-all) e `realtime` somente em
  `/socket.io/(.*)` (handshake WebSocket/long-polling). `/health` e
  `/internal/events` não têm rewrite e ficam internos.
- **Binding:** o `web` declara `type: service`, `service: realtime`,
  `format: url`, `env: REALTIME_URL`. A URL é injetada somente em runtime de
  functions — nunca em build nem em middleware — e o web publica em
  `POST /internal/events` dessa URL (código com fallback para
  `REALTIME_INTERNAL_URL` e depois `127.0.0.1:3001`).
- **Entrypoint do realtime:** `src/entry.ts` monta o runtime e exporta o
  `http.Server` **sem** chamar `listen()`; a plataforma roteia as requisições
  para o servidor exportado. `src/index.ts` continua com o `listen()` do dev
  local e do Docker.
- **Build:** as bindings não resolvem em build, então `DATABASE_URL` e
  `AUTH_SECRET` devem existir como variáveis normais do projeto (inclusive no
  build). `NEXT_PUBLIC_REALTIME_URL` deve ficar **sem** valor no Vercel: sem
  ela, o browser usa `window.location.origin` e o rewrite `/socket.io`
  encaminha para o realtime. `runtime` não é fixado — o Vercel detecta Node
  (>= 22) automaticamente.
- **Redis:** configurar `REDIS_URL` (por exemplo Upstash) no projeto. Sem
  Redis, cada instância Fluid mantém os sockets em memória própria e um
  evento publicado não alcança clientes de outras instâncias.
- **Migrações:** o Vercel não executa `prisma migrate` automaticamente;
  aplicar manualmente no primeiro deploy (seção 7.3) com a `DATABASE_URL` de
  produção: `pnpm --filter @mudra/database db:migrate:deploy`.
- **Auth.js:** o Auth.js confia no host encaminhado quando `VERCEL=1` está
  presente; `AUTH_TRUST_HOST` é dispensada neste provedor.
- **CORS:** o browser fala com o mesmo domínio (rewrite), então
  `REALTIME_CORS_ORIGINS` é dispensada; se definida, usar o domínio exato.
- O `output: "standalone"` do `apps/web/next.config.ts` existe para o Docker.
  Se o builder do Vercel reclamar no primeiro build, avaliar condicionar o
  output ao ambiente.
- O desenvolvimento local continua com `pnpm dev` (seção 5.2); `vercel dev`
  não foi configurado.

Passos do primeiro deploy: importar o repositório no Vercel (o workspace pnpm
é detectado), revisar as variáveis da seção 6 para os ambientes do projeto,
executar a migração manual (seção 7.3), fazer o deploy e rodar os smoke tests
da seção 16 no domínio do Vercel.

## 6. Variáveis de ambiente

Nunca versionar `.env` nem valores reais. Use o gerenciador de variáveis do
provedor e mantenha conjuntos separados por ambiente.

### 6.1 Web

| Variável                   | Obrigatória        | Observação                                                           |
| -------------------------- | ------------------ | -------------------------------------------------------------------- |
| `DATABASE_URL`             | Sim                | Connection string do PostgreSQL; usar TLS quando o provedor exigir   |
| `AUTH_SECRET`              | Sim                | Segredo do Auth.js; usar pelo menos 32 bytes aleatórios              |
| `AUTH_URL`                 | Recomendada        | URL pública canônica, por exemplo `https://app.exemplo.com`          |
| `AUTH_TRUST_HOST`          | Sim atrás de proxy | Definir `true` para o Auth.js confiar no host encaminhado pelo proxy |
| `NEXT_PUBLIC_REALTIME_URL` | Sim                | URL pública do Socket.IO; é embutida no bundle no build              |
| `REALTIME_INTERNAL_URL`    | Sim                | URL interna do realtime para publicação de eventos; no compose: `http://realtime:3001` |
| `REALTIME_JWT_SECRET`      | Sim                | Mesmo valor usado pelo realtime; pelo menos 32 bytes UTF-8           |
| `REALTIME_JWT_ISSUER`      | Opcional           | Se definido, precisa ser igual no web e no realtime                  |
| `REALTIME_JWT_AUDIENCE`    | Opcional           | Se definido, precisa ser igual no web e no realtime                  |
| `NODE_ENV`                 | Sim                | `production`                                                         |

`AUTH_SECRET` não é usado pelo CLI `create-admin`; ele é necessário quando a
autenticação web é acessada. Não reutilize `AUTH_SECRET` como
`REALTIME_JWT_SECRET`.

O nome `NEXTAUTH_URL` aparece na especificação, mas o código usa Auth.js v5.
Configure `AUTH_URL`/`AUTH_TRUST_HOST` conforme a versão atual; não dependa de
variáveis do Auth.js v4.

No Vercel (seção 5.5), `REALTIME_URL` é injetada pela binding (não cadastrarà
mão), `REALTIME_INTERNAL_URL` e `NEXT_PUBLIC_REALTIME_URL` ficam sem valor, e
`AUTH_TRUST_HOST` é dispensada. `DATABASE_URL` e `AUTH_SECRET` continuam
obrigatórias inclusive no build.

### 6.2 Realtime

| Variável                | Obrigatória      | Observação                                                                |
| ----------------------- | ---------------- | ------------------------------------------------------------------------- |
| `REALTIME_JWT_SECRET`   | Sim              | Mesmo valor exato do web; o serviço recusa iniciar com menos de 32 bytes  |
| `SOCKET_IO_PORT`        | Sim na prática   | Porta alvo do provedor; padrão interno 3001                               |
| `HOST`                  | Recomendada      | `0.0.0.0` para aceitar conexões do proxy                                  |
| `REALTIME_CORS_ORIGINS` | Sim para browser | Origens exatas, separadas por vírgula; exemplo: `https://app.exemplo.com` |
| `REALTIME_JWT_ISSUER`   | Opcional         | Deve coincidir com o web quando configurado                               |
| `REALTIME_JWT_AUDIENCE` | Opcional         | Deve coincidir com o web quando configurado                               |
| `REDIS_URL`             | Opcional         | Se definido, o Redis passa a ser dependência obrigatória de inicialização |
| `NODE_ENV`              | Recomendada      | `production`                                                              |

`REALTIME_CORS_ORIGINS` protege o fallback HTTP long-polling do navegador; não
é autenticação e não protege WebSocket. A autenticação real é o JWT do
handshake. Use sempre HTTPS/WSS em produção e não use `*` como origem.

### 6.3 Migração e bootstrap

| Variável       | Uso                                                                 |
| -------------- | ------------------------------------------------------------------- |
| `DATABASE_URL` | Necessária para `prisma migrate deploy` e para o CLI `create-admin` |

O CLI `create-admin` é interativo, solicita a senha no terminal e precisa de um
TTY real. Execute-o em um shell confiável do provedor ou em uma máquina
autorizada com acesso temporário ao banco. Não tente passá-lo por um job de CI
não interativo nem registre a senha em logs. Ele cria o restaurante e o ADMIN
uma única vez e falha se já existir restaurante.

### 6.4 Mobile

As variáveis `EXPO_PUBLIC_*` são incorporadas ao bundle e não podem conter
segredos. O app atual ainda não consome uma URL de API; quando a integração for
implementada, configurar no EAS, por exemplo:

```text
EXPO_PUBLIC_API_URL=https://app.exemplo.com
EXPO_PUBLIC_REALTIME_URL=https://realtime.exemplo.com
```

Nunca colocar `DATABASE_URL`, `AUTH_SECRET` ou `REALTIME_JWT_SECRET` em
variáveis públicas do Expo.

### 6.5 Variáveis futuras

A especificação lista chaves de pagamentos, iFood, Anthropic e Sentry. O código
atual não consome essas integrações. Não configure esses segredos em produção
antes de a integração existir; quando forem adicionados, eles devem ficar
somente no servidor e em um secret manager.

## 7. Banco de dados e migrações

### 7.1 Regras

- Produção usa `pnpm --filter @mudra/database db:migrate:deploy`.
- Migrações devem usar uma conexão direta com o PostgreSQL, não um pooler em
  modo transaction. Se o provedor oferecer URL pooled para o runtime, manter
  uma URL direta separada para a migração.
- Nunca executar `prisma migrate dev`, `prisma db push` ou `prisma migrate reset`
  em produção.
- Migrações são **forward-only**; não há down migrations automáticas. O
  rollback de código não desfaz uma migração.
- Antes de uma migração, confirmar o backup/snapshot e executar o ensaio em
  staging.
- Aplicar cada migração **uma única vez**, por um único job/serviço. Não
  configurar o comando de migração em web e realtime ao mesmo tempo.

### 7.2 Estratégia de release do schema

Para evitar indisponibilidade, preferir o padrão expand/contract:

1. **Expand:** adicionar colunas/tabelas/índices compatíveis e fazer o deploy
   do código que lê e escreve nos dois formatos.
2. **Migrar dados:** executar backfill em lote, monitorando locks e tempo.
3. **Contract:** remover o formato antigo somente em um release posterior.

No MVP, uma janela curta de manutenção é aceitável para migrações que não possam
ser compatíveis. Nesse caso, avisar os operadores e bloquear o uso durante a
janela.

### 7.3 Primeira instalação

Em um banco vazio, a partir de uma máquina com o repositório (desenvolvimento
ou staging):

```bash
pnpm --filter @mudra/database db:migrate:deploy
pnpm --filter @mudra/database create-admin
```

Somente com Docker (servidor de produção), usar o serviço `migrate` do
`compose.yaml` (perfil `migrate`; o `create-admin` precisa de TTY interativo,
que o `docker compose run` fornece):

```bash
docker compose --profile migrate run --rm migrate
docker compose --profile migrate run --rm migrate pnpm --filter @mudra/database create-admin
```

O `create-admin` também compila o pacote `@mudra/database`. Execute-o com
`DATABASE_URL` apontando para o banco correto. Não execute os seeds
`seed:demo-*` em produção; eles só funcionam com `NODE_ENV=development` e são
destinados ao ambiente local.

A migração `user_password_hash` foi desenhada para falhar se já existirem
usuários sem `passwordHash`. Em uma instalação nova isso não ocorre. Em um banco
pré-existente, planejar o backfill de credenciais antes de aplicá-la, conforme
descrito em `packages/database/README.md`.

### 7.4 Backup e restauração

Baseline recomendado:

- No Hetzner, habilitar o backup automático do volume do banco (≈ +20% do
  preço do servidor; até 7 cópias diárias) e complementar com `pg_dump`
  off-provider criptografado quando a retenção não bastar.
- Snapshot diário do PostgreSQL e, se o provedor oferecer, recuperação point-in-time.
- Backup manual antes de migrações de risco.
- Retenção mínima de 30 dias para snapshots diários e cópia off-provider
  criptografada, quando o orçamento permitir.
- Teste de restore trimestral em banco isolado, nunca sobre produção.
- Metas iniciais: RPO de 24 horas (ou 15 minutos com PITR) e RTO de 2 horas.

Exemplo de backup manual com `pg_dump` (executar em ambiente com as ferramentas
do PostgreSQL e com a URL de produção em uma variável protegida). Use a URL
nativa do PostgreSQL; remova parâmetros específicos do Prisma, como `schema`:

```bash
pg_dump "$POSTGRES_URL" --format=custom --file=mudra-backup.dump
```

Não versionar arquivos de backup. Restaurar somente com aprovação explícita e
após confirmar o impacto de perda de dados entre o backup e o incidente.

## 8. Realtime, Redis e escala

### 8.1 Instância única é o baseline

Para o piloto, usar **uma instância** do realtime. Nesse cenário:

- Redis é opcional e pode ser omitido; isso reduz um ponto de falha.
- O Socket.IO usa o adapter em memória.
- Não há garantia de entrega de eventos: o web mantém fallback de atualização
  a cada cinco segundos enquanto a página está visível e busca o estado
  canônico. Consumidores devem reconciliar por API após reconexão.

### 8.2 Múltiplas instâncias

Para escalar o realtime horizontalmente:

- Configurar `REDIS_URL` em todas as instâncias. O código atual trata falha de
  conexão com Redis como falha de startup; não há degradação silenciosa.
- Habilitar **sticky sessions** no balanceador. O cliente negocia
  `websocket` e `polling`; HTTP long-polling exige afinidade entre requisições
  da mesma sessão quando há múltiplos servidores. Alternativamente, alterar o
  cliente para somente WebSocket e validar a topologia.
- Monitorar conexões, erros de Redis e reconexões. O adapter Redis não é um
  outbox nem garante recuperação de eventos perdidos.

O serviço não persiste eventos nem mantém histórico. Uma falha de publicação
não deve reverter a operação de negócio já confirmada; o estado canônico
permanece no PostgreSQL.

### 8.3 Endpoint interno de publicação

O web publica em `POST /internal/events` com `Authorization: Bearer` usando
atualmente o mesmo `REALTIME_JWT_SECRET`. Esse endpoint:

- Deve ficar na rede privada, acessível apenas pelo web.
- Rejeita payload acima de 16 KB e valida o schema do evento.
- Não é um endpoint de negócio e não deve ser exposto como API pública.
- Se a publicação falhar, o web registra erro e a operação principal continua;
  a interface precisa reconciliar por refresh/polling.

Como melhoria futura, separar o segredo de publicação interna do segredo de
assinatura dos JWTs de usuário, reduzindo o impacto de uma rotação ou
vazamento.

## 9. Web, sessões e proxy

- O web é um processo Node.js com Prisma; não usar runtime Edge para rotas que
  acessam banco.
- As sessões do Auth.js são JWT assinado em cookie. O web pode escalar
  horizontalmente sem armazenar sessão em Redis, mas cada instância mantém seu
  próprio pool Prisma.
- Atrás de proxy reverso, configurar `AUTH_TRUST_HOST=true` e `AUTH_URL` com a
  URL pública canônica. Redirecionamentos de login devem permanecer no domínio
  HTTPS.
- Configurar HTTPS no proxy e encaminhar `X-Forwarded-Proto`/`X-Forwarded-Host`
  corretamente. Não aceitar HTTP em produção; se necessário, redirecionar para
  HTTPS.
- Não fazer cache de HTML autenticado, respostas de API ou páginas de login em
  CDN. Assets estáticos de `/_next/static` podem ter cache longo.
- A URL `NEXT_PUBLIC_REALTIME_URL` é substituída no bundle durante o build. Se
  o domínio do realtime mudar, rebuildar e redeployar o web; apenas reiniciar o
  processo não atualiza o bundle.

## 10. Mobile Android com Expo EAS

### 10.1 Estado atual

O app mobile está em modo demonstrativo: não há configuração de EAS, URL de API
ou sincronização real com o backend. O `app.json` define o pacote
`com.mudra.restaurants`, mas não define `runtimeVersion`; o `package.json` não
inclui `expo-updates`. Portanto, OTA ainda não está habilitado.

Não publicar o app como ferramenta operacional até concluir autenticação,
sincronização, tratamento offline e definição da URL da API.

### 10.2 Configuração proposta

No diretório `apps/mobile`:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build:configure
```

Criar perfis em `eas.json`:

| Perfil        | Saída      | Uso                                     |
| ------------- | ---------- | --------------------------------------- |
| `development` | Dev client | Desenvolvimento com módulos nativos     |
| `preview`     | APK        | Distribuição interna para o piloto      |
| `production`  | AAB        | Google Play ou distribuição corporativa |

Antes de habilitar OTA:

- Adicionar `expo-updates` e configurar o canal no `app.json`.
- Definir uma política de `runtimeVersion` (por versão do app ou fingerprint)
  para impedir que um bundle JS seja aplicado a um binário nativo incompatível.
- Incrementar `android.versionCode` a cada envio; `version` deve refletir a
  versão funcional.

Comandos de referência:

```bash
# APK interno
npx eas-cli@latest build --platform android --profile preview

# Build de produção
npx eas-cli@latest build --platform android --profile production

# Envio para a loja, quando aplicável
npx eas-cli@latest submit --platform android --profile production

# OTA, somente depois de configurar expo-updates e runtimeVersion
npx eas-cli@latest update --channel production --message "descrição da release"
```

### 10.3 Regras de release mobile

- OTA serve para mudanças de JavaScript/assets compatíveis com o binário
  instalado. Mudanças de módulo nativo, permissão, SDK do Expo ou configuração
  do `app.json` exigem um novo build.
- Testar o bundle em `preview`/staging antes de promover para produção.
- Usar rollout gradual quando a loja permitir e manter um build anterior
  disponível para rollback.
- As credenciais de assinatura Android devem ser gerenciadas pelo EAS e ter
  backup seguro. Nunca versionar keystore ou senhas.
- O app não deve conter segredos de servidor. A URL da API e a URL pública do
  realtime são informações públicas; tokens de usuário são obtidos em runtime.

## 11. CI/CD

### 11.1 Estado atual

O workflow `.github/workflows/ci.yml` roda em pull requests e pushes para
`main`, com Node 22, pnpm, `--frozen-lockfile`, lint, typecheck, testes e
`pnpm build`. Ele **não** executa deploy nem migrations.

### 11.2 Pipeline alvo

1. **Pull request:** checkout, instalação congelada, lint, typecheck, testes e
   build. Nenhum deploy.
2. **Merge na `main`:** repetir as verificações e gerar os artefatos de web e
   realtime.
3. **Staging:** aplicar migrações (serviço `migrate`), disparar o deploy no
   Coolify (realtime e web), executar smoke tests e validar o fluxo de login,
   comandas, fechamento e pagamento.
4. **Aprovação de produção:** usar GitHub Environments com revisores
   obrigatórios e segredos separados.
5. **Produção:** confirmar backup, executar a migração uma única vez
   (serviço `migrate`), fazer deploy do realtime, depois do web e executar
   smoke tests.
6. **Mobile:** build EAS sob demanda ou por tag de release; não acoplar o deploy
   do backend a um build mobile.

O deploy deve acontecer **somente depois da CI verde**. Com Coolify, habilitar
o deploy por webhook disparado pela CI (ou fazer deploy manual pelo painel
somente após a CI verde); no Railway, desabilitar o auto-deploy no push ou
configurar a espera pela CI. Caso contrário um commit pode ir para produção
antes de lint/testes/build.

Para o banco, a migração pode ser executada:

- pelo serviço `migrate` do `compose.yaml` (perfil `migrate`) no servidor, ou
- por uma máquina autorada com acesso temporário ao banco (staging).

Não expor o PostgreSQL publicamente apenas para a CI alcançá-lo. Se a CI
precisar conectar, usar uma connection string direta com TLS, um environment
protegido e uma janela controlada. Evitar rodar a mesma migração em mais de um
serviço.

### 11.3 Ordem de deploy

Para mudanças compatíveis:

1. Migração de schema (expand).
2. Realtime, quando houver novo evento ou mudança de contrato.
3. Web.
4. Smoke tests e monitoramento.
5. Mobile, após o backend estar estável.

O realtime deve vir antes do web quando o web passar a publicar um evento novo:
uma versão antiga do realtime rejeitaria o payload desconhecido. Para mudanças
incompatíveis, usar expand/contract e manter uma janela de compatibilidade.

### 11.4 Rollback

- **Web/realtime:** redeploy da versão anterior pelo Coolify (as imagens
  anteriores ficam disponíveis) ou revert do commit com novo pipeline. Manter o
  artefato/imagem anterior disponível.
- **Banco:** preferir correção forward (nova migração) em vez de down. Restaurar
  snapshot somente em caso de corrupção/perda e após comunicar a perda de dados
  posterior ao backup.
- **Segredos:** rotação de `REALTIME_JWT_SECRET` invalida tokens e desconecta
  sockets; fazer a troca coordenada nos dois serviços e comunicar os usuários.
- **Mobile:** republicar o bundle anterior no canal ou manter o build anterior
  para instalação; interromper rollout na loja se disponível.

## 12. Observabilidade e operação

Antes do piloto, configurar:

- **Health checks:** web em `/api/health` e realtime em `/health` (ambos já
  implementados; o do realtime informa apenas o estado do Redis). Os
  healthchecks do `compose.yaml` e o `HEALTHCHECK` das imagens já os usam;
  configurar os mesmos pontos no Coolify. O health check não expõe versão,
  credenciais ou detalhes de banco.
- **Logs:** coletar stdout/stderr no provedor ou em um log drain. Os logs da
  aplicação já evitam imprimir URLs e credenciais, mas devem ser revisados para
  não incluir tokens, senhas ou payloads sensíveis.
- **Sentry:** ainda não integrado. Quando adicionado, configurar DSNs separados
  por ambiente, release/commit e source maps; nunca enviar tokens ou dados
  pessoais.
- **Métricas e alertas:** erros 5xx do web, falhas de health check, conexões e
  reconexões do realtime, falhas de publicação interna, erros de Redis, uso de
  disco/conexões do PostgreSQL e falha de backup.
- **Uptime:** monitorar os dois domínios públicos e o certificado TLS. Para o
  realtime, usar `GET /health` (implementado); caminhos desconhecidos, incluindo
  `GET /`, respondem 404 em vez de ficar pendurados.

Metas iniciais sugeridas para o piloto (não contratuais):

| Indicador              | Meta inicial                            |
| ---------------------- | --------------------------------------- |
| Disponibilidade do web | 99,5% ao mês                            |
| Reconexão do Socket.IO | menos de 10 segundos em condição normal |
| RPO do banco           | 24 horas (15 minutos com PITR)          |
| RTO do banco           | 2 horas                                 |

## 13. Segurança operacional

- Segredos somente no secret manager do provedor ou GitHub Environments
  protegidos. Nunca em `.env` versionado, código, logs, issues ou chats.
- TLS em todos os domínios públicos; PostgreSQL e Redis apenas na rede privada.
- CORS do realtime restrito às origens exatas de produção.
- Endpoint `/internal/events` acessível somente pelo web, com o segredo atual e
  preferencialmente por rede privada.
- Menor privilégio para o usuário de runtime do banco, se o provedor permitir
  separar o usuário de migração do usuário da aplicação.
- Rate limiting no proxy para login e endpoints de autenticação. O código atual
  não implementa rate limiting de aplicação; essa é uma proteção de borda
  necessária para o piloto.
- Revisar dependências e manter o lockfile; builds devem usar
  `--frozen-lockfile`.
- Não usar `NEXT_PUBLIC_*` ou `EXPO_PUBLIC_*` para segredos.
- Fazer backup criptografado e restringir quem pode restaurar ou ler o banco.

## 14. Runbook — primeiro deploy

1. Criar servidor no Hetzner (CX23, região US-Ashburn) com firewall para
   22/80/443.
2. Instalar o Coolify (seção 5.3) e apontar o DNS dos domínios.
3. Criar os serviços `postgres`, `realtime`, `web` e `migrate` a partir dos
   Dockerfiles e do `compose.yaml`.
4. Cadastrar todas as variáveis da seção 6 em cada serviço, com valores únicos
   por ambiente.
5. Configurar os health checks (`/api/health` e `/health`) e confirmar resposta
   200 antes de liberar tráfego.
6. Habilitar o backup automático do Hetzner no volume do banco.
7. Executar `db:migrate:deploy` pelo serviço `migrate` com `DATABASE_URL` de
   produção.
8. Executar `create-admin` pelo serviço `migrate` em shell interativo
   confiável; guardar as credenciais em local seguro.
9. Confirmar `GET /health` do realtime e uma conexão Socket.IO autenticada.
10. Confirmar login no web, carregamento de mesas/comandas e emissão de token
    de tempo real.
11. Testar add item, fechamento de comanda e pagamento, observando a atualização
    em outra sessão do navegador.
12. Executar build EAS interno somente quando o app mobile estiver integrado ao
    backend; caso contrário, manter o app fora da distribuição operacional.

## 15. Runbook — deploy rotineiro

1. PR revisado e CI verde na `main`.
2. Confirmar que staging foi atualizado e os smoke tests passaram.
3. Gerar/validar backup antes da migração.
4. Aprovar o environment de produção no GitHub.
5. Aplicar a migração uma única vez (serviço `migrate` do compose).
6. Deploy do realtime (se afetado).
7. Deploy do web.
8. Executar smoke tests: login, comandas, item, fechamento, pagamento e
   atualização em tempo real.
9. Monitorar logs, erros 5xx, reconexões e banco por pelo menos 30 minutos.
10. Registrar versão implantada, migrações aplicadas e intercorrências.

## 16. Smoke tests mínimos

Executar em staging e produção após cada release:

- `GET /login` retorna a página de login.
- Login com um usuário válido cria sessão e redireciona para a operação.
- A lista de mesas/comandas carrega dados do banco.
- Adicionar um item atualiza o total e a lista.
- Outro navegador autenticado recebe a atualização (ou atualiza pelo fallback de
  cinco segundos quando o Socket.IO está indisponível).
- Fechar uma comanda com permissão adequada altera o estado e libera a mesa
  quando aplicável.
- Registrar pagamento com permissão adequada retorna sucesso e publica o evento.
- `GET /api/realtime-token` retorna um token para usuário autenticado.
- Health checks do web e do realtime respondem 200.
- Nenhum segredo aparece nos logs do deploy.

## 17. Riscos e pendências

| Risco/pendência                                           | Impacto                                                            | Mitigação                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Sem job de deploy na CI                                   | Deploy depende de webhook/manual no Coolify                        | Habilitar webhook pós-CI verde; automatizar depois                  |
| Mobile demonstrativo, sem sync/API                        | App não opera de verdade                                           | Manter distribuição interna até concluir integração                  |
| Sem `eas.json`, `expo-updates` e `runtimeVersion`         | Sem build reproduzível nem OTA seguro                              | Configurar antes do primeiro build de piloto                         |
| Realtime sem outbox/histórico                             | Eventos podem ser perdidos                                         | Reconciliação por refresh/polling; outbox no futuro                  |
| Uma instância do realtime                                 | Sem alta disponibilidade                                           | Escalar com Redis + sticky sessions quando necessário                |
| Redis como dependência dura quando configurado            | Falha de Redis impede startup                                      | Usar somente quando necessário; monitorar e ter plano de recuperação |
| `REALTIME_JWT_SECRET` também autentica publicação interna | Comprometimento tem impacto amplo                                  | Separar segredo interno no futuro                                    |
| Sem Sentry/rate limiting de aplicação                     | Diagnóstico e proteção limitados                                   | Logs do provedor + rate limit no proxy; integrar depois              |
| Migrações forward-only                                    | Rollback de código não desfaz schema                               | Expand/contract, backup e restauração ensaiada                       |
| Um restaurante por banco                                  | Sem plano multi-tenant                                             | Provisionar projeto/banco por restaurante                            |
| `create-admin` interativo                                 | Não automatiza bootstrap                                           | Executar uma vez em shell TTY confiável                              |

## 18. Referências

- `specification.md` — infraestrutura, deploy, CI/CD e distribuição mobile
  (§§ 12–13).
- `README.md` — execução local, variáveis e validação.
- `docs/testing.md` — cenários manuais e comandos de teste.
- `docs/architecture/realtime-contracts.md` — contratos, CORS, Redis e lacunas.
- `apps/realtime/README.md` — requisitos de JWT, Redis, CORS e publicação de
  eventos.
- `.github/workflows/ci.yml` — pipeline atual de integração contínua.
- `compose.yaml` e Dockerfiles (`apps/web`, `apps/realtime`,
  `packages/database`) — infraestrutura de containers versionada.
- `vercel.json` — serviços, bindings e rewrites do deploy no Vercel
  (seção 5.5).
