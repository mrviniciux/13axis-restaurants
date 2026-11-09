# 13axis for Restaurants

Sistema de gestão de restaurante com back-office web e app Android, projetado
para operação offline-first.

## Stack e workspaces

- Monorepo: pnpm workspaces + Turborepo
- `apps/web`: back-office desktop em Next.js App Router
- `apps/mobile`: app Android em Expo + React Native
- `apps/realtime`: serviço Socket.IO
- `packages/database`: schema Prisma, acesso PostgreSQL, migrations e CLIs
- `packages/shared`: tipos, validações Zod e utilitários compartilhados
- Banco local: PostgreSQL 16 em Docker Compose
- Produção: containers Docker independentes de web e realtime ou projeto
  Vercel com services (ver `docs/deploy.md`)

## Requisitos

- Windows 10/11 com Docker Desktop iniciado
- Node.js 22.13+, 24.3+ ou 26+ (versões compatíveis com o Expo deste workspace)
- pnpm 12+
- Android Studio/emulador Android ou Expo Go para executar o app mobile

## Inicialização local completa

Na raiz do workspace, copie [.env.example](./.env.example) para `.env` e
substitua todos os valores de exemplo por segredos locais. Use pelo menos 32
bytes aleatórios para `AUTH_SECRET` e `REALTIME_JWT_SECRET`. O arquivo `.env`
é ignorado pelo Git: não o compartilhe nem o inclua em commits.
Defina `13AXIS_DB_PASSWORD` e a senha em `DATABASE_URL` com o mesmo valor; use
uma senha hexadecimal aleatória ou codifique caracteres especiais para URL.

Em uma instalação nova, carregue o `.env` no terminal, instale as dependências,
inicie o PostgreSQL e aplique as migrations. Execute este bloco no PowerShell
a partir da raiz:

```powershell
if (-not (Test-Path .env)) {
  Copy-Item .env.example .env
}
# Edite .env e substitua os valores de exemplo antes de continuar.

Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    $name = $Matches[1]
    $value = $Matches[2].Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    Set-Item -Path "Env:$name" -Value $value
  }
}

pnpm install
docker compose up -d --wait postgres
pnpm --filter @13axis/database db:migrate:deploy
```

`--wait` aguarda o healthcheck do PostgreSQL antes de seguir. Se o Docker
Desktop não estiver iniciado, abra-o e espere o engine ficar pronto antes de
executar o comando.

Crie o primeiro restaurante e administrador. O CLI solicita os dados no
terminal e oculta a senha digitada:

```powershell
pnpm --filter @13axis/database create-admin
```

Para um cadastro não interativo e idempotente (banco novo sem TTY, como o do
Vercel), use o seed pré-configurado:

```powershell
pnpm --filter @13axis/database seed:admin
```

Ele cria `13axis Alimentos` com o ADMIN `httpmarks@gmail.com` quando o banco
está vazio, reaproveita os existentes e confere a senha do administrador.
Os dados ficam em `packages/database/src/cli/seed-admin.ts`; revise a senha
antes de expor o ambiente em produção.

Para experimentar mesas e comandas, carregue dados locais de demonstração.
Os comandos só funcionam com `NODE_ENV=development`; os seeds de mesas e menu
recusam cadastros existentes e o seed de comandas preenche apenas os números
que ainda não estão abertos:

```powershell
$env:NODE_ENV = "development"
pnpm --filter @13axis/database seed:demo-tables
pnpm --filter @13axis/database seed:demo-menu
pnpm --filter @13axis/database seed:demo-orders
```

`seed:demo-orders` garante que as comandas 20 a 29 estejam abertas, criando
somente as que faltam. Ele é idempotente, não altera comandas existentes e
sempre deve ser executado apenas contra um banco local de desenvolvimento.

### Recriar o banco local do zero (destrutivo)

Os comandos abaixo apagam **todos** os dados locais: restaurantes, usuários,
mesas, cardápio e comandas. Use somente em ambiente de desenvolvimento ou em um
banco descartável. Pare os apps (`Ctrl+C`) antes de executar e faça backup se
precisar preservar os dados.

#### Opção 1 — apagar também o volume Docker (reset completo)

Remove o container e o volume `13axis-postgres`, criando um PostgreSQL vazio na
sequência:

```powershell
docker compose down -v
docker compose up -d --wait postgres
pnpm --filter @13axis/database db:migrate:deploy
pnpm --filter @13axis/database db:generate
pnpm --filter @13axis/database create-admin
```

Depois das migrations, `create-admin` recria o restaurante e o primeiro ADMIN.
Para voltar a ter os dados de demonstração:

```powershell
$env:NODE_ENV = "development"
pnpm --filter @13axis/database seed:demo-tables
pnpm --filter @13axis/database seed:demo-menu
pnpm --filter @13axis/database seed:demo-orders
```

#### Opção 2 — manter o container e recriar apenas o schema

Mais rápida, mas igualmente destrutiva. O container PostgreSQL continua o mesmo
e apenas o schema `public` é apagado e recriado:

```powershell
docker compose up -d --wait postgres
docker compose exec -T postgres psql -U 13axis -d 13axis -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pnpm --filter @13axis/database db:migrate:deploy
pnpm --filter @13axis/database create-admin
```

Também é possível delegar o reset ao Prisma. O comando abaixo apaga o schema,
reaplica todas as migrations e regenera o cliente Prisma:

```powershell
docker compose up -d --wait postgres
pnpm --filter @13axis/database exec prisma migrate reset --force --skip-seed
pnpm --filter @13axis/database create-admin
```

O `migrate reset` não cria o ADMIN nem os dados de demonstração; execute
`create-admin` e os seeds em seguida, se necessário. Em caso de dúvida sobre o
estado do banco, prefira a Opção 1, que remove o volume inteiro.

Com o PostgreSQL iniciado e as variáveis carregadas no terminal, inicie todos
os apps com o Turborepo:

```powershell
pnpm dev
```

O comando inicia o Next.js, o serviço Socket.IO e o servidor Expo. Abra
**http://localhost:3000** para o back-office. O Expo mostra um QR code para
abrir o app em um dispositivo; para usar um emulador Android iniciado no Android
Studio, use `pnpm --filter @13axis/mobile android` em outro terminal, após
carregar nele as mesmas variáveis do `.env`.

Se o Expo ficar parado em `Starting Metro Bundler` por causa de verificações de
rede, inicie somente o app mobile em modo offline:

```powershell
pnpm --filter @13axis/mobile dev -- --offline
```

Esse modo não inicia web nem realtime; execute os comandos desses apps em
terminais separados se também precisar deles.

Para trabalhar em apenas um app, mantenha o PostgreSQL ligado e use o filtro
correspondente:

```powershell
pnpm --filter @13axis/web dev
pnpm --filter @13axis/realtime dev
pnpm --filter @13axis/mobile dev
```

Em terminais separados, carregue também as variáveis do `.env` antes de iniciar
os apps ou os CLIs Prisma/database; repita o bloco de importação de variáveis
acima em cada nova janela do PowerShell. O Next.js também carrega o `.env` da
raiz pela configuração do workspace. O Turborepo encaminha ao serviço realtime
apenas as variáveis de configuração necessárias. O Socket.IO usa
`SOCKET_IO_PORT` (3001 por padrão) e exige `REALTIME_JWT_SECRET`; Redis é
opcional e não é iniciado pelo Compose local.
O web e o realtime compartilham `REALTIME_JWT_SECRET`. Para expor o Socket.IO
em outro endereço, defina `NEXT_PUBLIC_REALTIME_URL` com a URL acessível pelo
navegador e `REALTIME_INTERNAL_URL` com a origem interna acessível pelo Next.js.
Em desenvolvimento local, o navegador usa `http://localhost:3001` e a API
publica eventos em `http://127.0.0.1:3001` por padrão. Configure também
`REALTIME_CORS_ORIGINS=http://localhost:3000` para permitir o fallback de
long-polling.

### Stack completa em containers (produção local)

Além do fluxo de desenvolvimento com `pnpm dev`, o `compose.yaml` também sobe
os serviços de produção em containers independentes — `postgres`, `realtime`
e `web` — construídos a partir dos Dockerfiles de `apps/realtime`,
`apps/web` e `packages/database`:

```powershell
# Com o .env carregado e as migrations já aplicadas (fluxo acima):
docker compose up -d --build

# Conferir os health checks (web: /api/health, realtime: /health):
docker compose ps
```

Notas:

- Pare o `pnpm dev` antes: os containers publicam as mesmas portas 3000 e 3001.
- O container `web` **não** executa migrations automaticamente; aplique-as
  antes (fluxo acima) ou use o perfil `migrate`:

  ```powershell
  docker compose --profile migrate run --rm migrate
  docker compose --profile migrate run --rm migrate pnpm --filter @13axis/database create-admin
  ```

- `NEXT_PUBLIC_REALTIME_URL` é embutida no bundle no build; ao mudá-la,
  reconstrua com `docker compose build web`.
- Os comandos do fluxo de desenvolvimento (`docker compose up -d --wait
postgres`) continuam subindo **apenas** o PostgreSQL.

## Estado atual dos módulos

- **Web:** a tela de Gestão de Mesas/Comandas mantém o título no topo e o botão
  **Propriedades** à direita. A preferência entre as visões **Comanda**,
  **Mesa** e **Mesa + comanda** é individual por usuário e começa em **Comanda**.
  Comandas são independentes de mesas, exceto na visão combinada; a visão Mesa
  não oferece ações de comanda. Cards compactos exibem mesas ou comandas e, nas
  comandas, os itens na lista principal com ações para editar/excluir itens
  pendentes. **Ver comanda** abre um diálogo com produtos e total; taxa de
  garçom e desconto aparecem como não configurados e não alteram o total.
  Números de comanda são configurados por restaurante, começam em `{20-110}`,
  e números abertos permanecem únicos e visíveis. O administrador cadastra
  produtos e preços em `/menu`; a inclusão rápida abre com foco na pesquisa,
  prioriza produtos relevantes e aceita quantidade decimal com vírgula
  (`0,340`). Observação no item é opcional. A lista aberta e os dados da comanda
  são carregados pelo servidor; ao clicar em uma comanda verde, o diálogo abre
  com esse snapshot. Criação e alterações de itens são propagadas pelo Socket.IO
  aos usuários autenticados do mesmo restaurante, que atualizam a lista e o
  diálogo; quando o Socket.IO está desconectado, o web verifica atualizações a
  cada cinco segundos enquanto a página está visível.
- **Realtime:** servidor Socket.IO autenticado disponível em desenvolvimento;
  os fluxos web/mobile ainda não publicam/consomem os eventos operacionais.
- **Mobile:** inicializa pelo Expo, mas o mapa e as comandas atuais são
  demonstrativos e ainda não sincronizam com a API/banco.
- **Database e shared:** bibliotecas usadas pelos apps e ferramentas CLI; não
  são processos de servidor independentes.
- **Ainda não implementados:** sincronização offline integrada, KDS conectado e
  persistência do histórico de pagamentos.

Veja [docs/testing.md](./docs/testing.md) para os cenários manuais e comandos de
validação. Consulte [docs/deploy.md](./docs/deploy.md) para a estratégia de
deploy, variáveis de produção, migrações e distribuição mobile. Consulte
[specification.md](./specification.md) para os requisitos e decisões completas
do produto.

## Validação

Na raiz do workspace:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
