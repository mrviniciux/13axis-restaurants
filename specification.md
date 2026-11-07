# Mudra for Restaurants — Especificação Técnica

> Sistema de gestão para restaurante único (sem franquias nesta fase), com back-office web (gerente/admin) e app nativo Android para pista de atendimento (garçom/balança), ambos offline-first com sincronização em tempo real.

---

## 1. Visão Geral

### 1.1 Objetivo

Sistema completo de gestão de restaurante com dois front-ends distintos:

- **Web (desktop)** — back-office para gerente/administrador: cardápio, estoque, relatórios, funcionários, reservas, financeiro, caixa. Funciona como PWA com modo offline.
- **App nativo Android** — pista de atendimento para garçom e operador de balança: lançamento de pedidos, gestão de mesas/comandas, recebimentos. Offline-first com sincronização em background. (iOS no futuro; código já estruturado para reaproveitamento.)

### 1.2 Princípios de Design

- **Fluxo não-intermitente**: o usuário nunca fica bloqueado esperando rede. Toda escrita é local-first (otimista) e sincronizada em background.
- **Performance sem compromisso**: toque responsivo e scroll fluido a 60fps em qualquer lista. Zero jank tolerado no app nativo.
- **Reaproveitamento de código**: web e mobile compartilham tipos, schemas de validação, client de API e lógica de domínio via monorepo.
- **Deploy prático**: CI/CD automático via git push. Infraestrutura com excelente custo-benefício.

---

## 2. Arquitetura do Sistema

### 2.1 Diagrama de Alto Nível

```
┌─────────────────────────────────────────────────────────┐
│                     MONOREPO (Turborepo)                  │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   apps/web    │  │ apps/mobile  │  │ apps/realtime │  │
│  │  Next.js 16   │  │ Expo + RN    │  │  Socket.IO    │  │
│  │ shadcn/ui     │  │ (Android)    │  │  Server       │  │
│  └──────┬────────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                   │                   │          │
│         └───────────┬───────┘                   │          │
│                     │                           │          │
│         ┌───────────┴───────────────────────────┘          │
│         │                                                   │
│  ┌──────┴──────────────────────────────────────────────┐  │
│  │              packages/ (código compartilhado)         │  │
│  │  shared/  database/  ui-tokens/                       │  │
│  │  (types, schemas Zod, API client, lógica de domínio)   │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │    PostgreSQL         │
              │    (dados canônicos)  │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Integrações externas  │
              │  Stripe, MP, PagSeg    │
              │  iFood, Claude API     │
              └───────────────────────┘
```

### 2.2 Estrutura do Monorepo

```
mudra-for-restaurants/
├── apps/
│   ├── web/              # Next.js 16 (App Router) + shadcn/ui — back-office desktop
│   ├── mobile/           # Expo + React Native — app nativo Android (garçom/balança)
│   └── realtime/         # Servidor Socket.IO standalone (tempo real entre dispositivos)
├── packages/
│   ├── shared/           # Tipos TypeScript, schemas Zod, client de API, lógica de domínio
│   ├── database/         # Schema Prisma, migrations, client Prisma
│   └── ui-tokens/        # Design tokens compartilhados (cores, espaçamentos, tipografia)
├── turbo.json            # Configuração do Turborepo (build, dev, lint, test)
├── pnpm-workspace.yaml   # Workspace pnpm
└── package.json
```

### 2.3 Justificativa da Arquitetura

- **Monorepo (Turborepo + pnpm)**: um único repositório, packages compartilhados entre web e mobile, build em paralelo com cache, CI/CD unificado.
- **Socket.IO como serviço separado**: mantém conexões WebSocket persistentes (incompatível com serverless). Roda como processo long-running no mesmo host do Next.js ou como serviço dedicado.
- **Prisma no package `database`**: o schema é compartilhado entre web e realtime; o client é gerado uma vez e importado por ambos.

---

## 3. Stack Tecnológica

### 3.1 Web (apps/web)

| Camada          | Tecnologia                                              | Versão             |
| --------------- | ------------------------------------------------------- | ------------------ |
| Framework       | Next.js                                                 | 16 (App Router)    |
| UI              | shadcn/ui + Tailwind CSS                                | componentes padrão |
| Estado servidor | React Server Components + Server Actions                | —                  |
| Estado cliente  | Zustand (store contextual por tela)                     | 5                  |
| Forms/validação | React Hook Form + Zod                                   | —                  |
| Auth            | Auth.js v5 (NextAuth)                                   | —                  |
| Offline web     | Service Worker (next-pwa / Serwist) + IndexedDB (Dexie) | —                  |
| Web Workers     | para sync em background no browser                      | —                  |
| ORM             | Prisma Client                                           | —                  |

### 3.2 Mobile (apps/mobile)

| Camada        | Tecnologia                            | Justificativa                                       |
| ------------- | ------------------------------------- | --------------------------------------------------- |
| Framework     | Expo + React Native                   | New Architecture (Fabric + TurboModules) habilitada |
| Navegação     | Expo Router                           | File-based, mesmo paradigma do App Router           |
| Listas        | @shopify/flash-list                   | Recicla views, 60fps em listas de qualquer tamanho  |
| Banco local   | expo-sqlite (SQLite)                  | Persistência offline no device                      |
| Sync          | Motor de sync custom (package shared) | Queue local + retry exponencial                     |
| Estado        | Zustand                               | Leve, sem boilerplate, funciona em RN               |
| Build/Distrib | Expo EAS Build                        | APK/AAB via CI, OTA updates                         |

### 3.3 Backend/API

| Camada     | Tecnologia                                       |
| ---------- | ------------------------------------------------ |
| API        | Next.js Route Handlers (REST) + Server Actions   |
| Database   | PostgreSQL                                       |
| ORM        | Prisma                                           |
| Cache      | Redis (Upstash ou Redis no Railway)              |
| Tempo real | Socket.IO (apps/realtime)                        |
| Auth       | Auth.js v5 com estratégia credentials + JWT      |
| Validação  | Zod (schemas compartilhados via packages/shared) |

### 3.4 Infraestrutura

| Componente    | Tecnologia                                                         |
| ------------- | ------------------------------------------------------------------ |
| Hosting       | Railway (recomendado) ou VPS Hetzner + Coolify (alternativa custo) |
| Database      | PostgreSQL gerenciado (Railway) ou auto-hospedado (VPS)            |
| Cache/Queue   | Redis                                                              |
| CDN/DDoS      | Cloudflare (free tier na frente)                                   |
| CI/CD         | GitHub Actions → Railway auto-deploy                               |
| Monitoramento | Sentry (erros) + logs Railway                                      |

---

## 4. Papéis e Permissões

### 4.1 Perfis de Usuário

| Perfil            | Acesso                                                                           | Plataforma             |
| ----------------- | -------------------------------------------------------------------------------- | ---------------------- |
| **Administrador** | Tudo: configurações, usuários, relatórios, financeiro, cardápio, estoque         | Web                    |
| **Gerente**       | Gestão operacional: cardápio, estoque, reservas, relatórios, caixa, funcionários | Web                    |
| **Garçom**        | Mesas, comandas, lançar pedidos, transferir mesa, receber (parcial)              | Mobile (Android)       |
| **Balança**       | Lançar produtos por peso, gerar comanda, enviar pra cozinha                      | Mobile (Android)       |
| **Cozinha**       | Ver pedidos (Kitchen Display), marcar status (preparando/pronto)                 | Web (tablet) ou Mobile |

### 4.2 Permissões (RBAC)

Controle por escopo: cada rota/ação do backend valida permissão via middleware.

```
ADMIN     → todas as permissões
MANAGER   → gerenciar cardápio, estoque, reservas, caixa, funcionários, relatórios
WAITER    → criar/editar comandas, lançar itens, transferir mesa, receber pagamento
CASHIER   → operar caixa, receber pagamentos, fechar comanda, relatórios do dia
KITCHEN   → visualizar pedidos, atualizar status de itens
```

---

## 5. Módulos do Sistema

### 5.1 Gestão de Mesas e Comandas (garçom — mobile)

- No back-office web, permitir escolher por usuário a visualização **Comanda**,
  **Mesa** ou **Mesa + comanda**; o padrão é **Comanda**. A preferência de
  visualização é individual por usuário.
- Nas visões com comandas, oferecer as abas **Mapa + Cards**, **Mapa +
  detalhamento** e **Cards**. As duas primeiras exibem a grade de números; a
  primeira usa cards com os 3 itens mais recentes, a segunda mostra o mapa à
  esquerda e o detalhamento da comanda selecionada à direita, e **Cards**
  oculta a grade.
- Na aba **Mapa + detalhamento**, o painel direito replica o conteúdo do resumo
  da comanda, com todos os itens, preço unitário, total por item, totais, taxa
  de garçom, desconto, registro de pagamento e fechamento quando o perfil tiver
  permissão. A seção de registro de pagamento começa expandida, destaca o total
  da comanda, permite informar valor e forma de pagamento e pode ser recolhida
  pelo usuário. O fechamento da comanda sempre exige confirmação explícita,
  inclusive no diálogo **Ver comanda**, com ações compactas que não ocupam a
  largura do painel. Itens pendentes podem ser editados ou excluídos e novos
  produtos podem ser adicionados diretamente nesse painel. O formulário de
  adicionar produto começa recolhido, abre por um botão dedicado e pode ser
  cancelado ou fechado sem lançar o item. Após um lançamento bem-sucedido, o
  formulário permanece aberto com produto, quantidade e observação limpos para
  o próximo item. O campo de produto funciona como busca por nome ou categoria e
  permite selecionar uma sugestão; quando não houver correspondência, perfis com
  permissão recebem a opção de cadastrar o produto informado e selecioná-lo. A
  seleção de outra comanda verde no mapa atualiza o painel; números cinza exibem
  no painel direito a confirmação para abrir a comanda, com o botão **Abrir
  comanda** alinhado à direita.
- Na visão **Comanda**, cada número é fixo e único entre comandas abertas do
  restaurante. A configuração é compartilhada pelo restaurante, começa em
  `{20-110}` e pode receber números individuais, faixas `{início-fim}` ou a
  forma tradicional separada por vírgulas. A grade pagina a cada 100 números;
  números fechados são cinza e abertos verdes.
- Comandas abertas existentes recebem números durante a migration, em ordem de
  abertura, a partir de 20.
- Comandas ativas mantêm seus números visíveis mesmo que a lista configurada
  seja alterada; após fechar uma comanda, seu número pode ser reutilizado.
- Comandas podem existir sem mesa; a associação com mesa é opcional e usada na
  visão combinada. A visão Mesa exibe mesas sem ações de comanda
- Mapa visual de mesas com status: **livre**, **ocupada**, **reservada**, **em fechamento**
- Na visão combinada, abrir múltiplas comandas vinculadas à mesma mesa (decisão confirmada para o MVP; a cardinalidade não será configurável nesta fase)
- No back-office web, mostrar o título do módulo no topo e manter **Propriedades**
  à direita; as propriedades controlam a visão e, para a visão Comanda, a lista
  de números compartilhada do restaurante.
- Mostrar mesas e comandas em cards compactos. Cards de comanda exibem os itens
  e totais; itens pendentes podem ser editados ou excluídos diretamente na lista
  principal, sem abrir uma lista de detalhes separada.
- Ao abrir uma comanda, abrir também o formulário rápido de produto com foco na
  busca. A busca prioriza Buffet Livre, Buffet por KG, Coca-cola zero lata
  300ml, Suco Mudra e Suco de laranja; o usuário pode pesquisar outros produtos.
- A inclusão de item pede produto e quantidade; observação é opcional.
  Quantidade aceita vírgula decimal (por exemplo, `0,340`) e é normalizada para
  ponto no armazenamento.
- Somente ADMIN pode cadastrar produto sem sair do fluxo de inclusão ou pelo
  módulo Cardápio. O servidor valida o perfil, nome, categoria e preço.
- **Ver comanda** abre um diálogo com produtos, valores por item e total. Taxa
  de garçom e desconto aparecem como não configurados e não são aplicados ao
  total até que suas regras de negócio sejam definidas.
- As comandas abertas e seus itens são pré-carregados para a tela web. Clicar
  em uma comanda aberta (verde) abre seu diálogo com os dados carregados. Ao
  criar ou alterar uma comanda/itens, propagar um evento autenticado para os
  usuários do mesmo restaurante; clientes atualizam o snapshot exibido sem
  recarregar a página inteira. Ao reconectar ou ficar sem Socket.IO, reconciliar
  o snapshot por atualização periódica enquanto a tela estiver visível.
- Enviar pedido pra cozinha (dispara WebSocket → Kitchen Display)
- Transferir itens entre mesas
- Dividir conta (por pessoa, por item, valor fixo)
- Status do pedido: **enviado** → **em preparo** → **pronto** → **servido**
- **Offline-first**: lançar produtos localmente mesmo sem rede; sync em background

### 5.1.1 Comportamento Responsivo do Grid de Cards

As abas **Mapa + Cards** e **Cards** renderizam cards em grids responsivos
distintos, implementados em CSS (`globals.css`) com media queries explícitas.

**Visão "Cards grandes"** (aba Mapa + Cards — grid `.large-cards-grid`):

- Cada card (`.large-order-card`) é flex column com borda e padding `14px`
- Mostra título, total, itens recentes e ações
- Grid: 3 colunas em telas largas, 2 em telas médias, 1 em telas pequenas

**Visão "Cards"** (aba Cards — grid `.order-card-grid`):

- Cada card (`.order-card`) mostra: título (mesa/comanda), total, até 3 itens
  recentes (nomes truncados com `text-overflow: ellipsis`) e ações rápidas
- Itens têm `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`
  para truncar nomes longos sem estourar o card em larguras estreitas
- Actions (`+ Adicionar item`, `Ver comanda`) usam `flex-wrap: wrap` para
  empilhar caso o card esteja muito estreito

**Regras de colunas — grid de order cards (`.order-card-grid`):**

| Largura            | Colunas | Largura aprox. do card |
| ------------------ | ------- | ---------------------- |
| < 480px (mobile)   | 1       | 100%                   |
| ≥ 480px            | 2       | ~290px@768             |
| ≥ 1024px (desktop) | 3       | ~334px@1024            |
| ≥ 1280px (desktop) | 4       | ~309px@1280            |

Garantia: em **tablet (768px–1023px)** o grid de order cards exibe **2 colunas**
(~290px por card) — largura suficiente para nomes de produto quebrarem linha
de forma inteligente (`white-space: normal; overflow-wrap: anywhere`) ao
invés de truncar em "1 × C…".

**Regras de colunas — grid de cards grandes (`.large-cards-grid`):**

| Largura      | Colunas |
| ------------ | ------- |
| > 1100px     | 3       |
| 720px–1100px | 2       |
| ≤ 720px      | 1       |

Em cards de 2 colunas (tablet), a tag "Recente" é ocultada via CSS
(`display: none` em `@media (max-width: 1100px)`) para dar espaço ao nome do
item. O texto usa `flex: 1 1 0; min-width: 0` para que o ellipsis funcione
corretamente dentro do flex row.

### 5.2 Cardápio (gerente — web)

- Categorias e subcategorias
- Itens com: nome, descrição, preço, imagem, código, disponibilidade (toggle)
- Variações e adicionais (ex: tamanho da pizza, ponto da carne, adicionais)
- Composições (vincular item a ingredientes do estoque para baixa automática)
- Horários de disponibilidade (item disponível só no almoço, por exemplo)
- Modificação reflete via OTA/realtime nos apps dos garçons

**5.2.1 Produtos de Buffet**

- Cadastro de pratos que compõem o buffet (ex.: Peixe assado, Frango grelhado,
  Arroz branco, Legumes na manteiga)
- Campos: nome (obrigatório, 1–120 chars), descrição (opcional, máx 500) — sem
  preço por porção (buffet é cobrado por peso ou taxa fixa)
- Acessível a ADMIN no módulo Cardápio (`/menu`), em seção dedicada
- A cozinha usa essa lista para receber solicitações de reposição no KDS
- API: `POST /api/buffet-items` (criar); `listBuffetItems` (listar, ADMIN/WAITER)
- Validação: nome único por restaurante (case-insensitive), Zod schema no backend
- Model: `BuffetItem` no Prisma (id, restaurantId, name, description, available)

### 5.3 Pedidos e Cozinha (Kitchen Display)

- **Kitchen Display System (KDS)**: tela mostrando pedidos em fila
- Cada pedido mostra: mesa, itens, observações, tempo decorrido, prioridade
- Status por item: **novo** → **preparando** → **pronto** (toque pra avançar)
- Alerta visual quando tempo excede limite configurável
- Som/notificação quando novo pedido chega
- Funciona em tablet (web) ou app

**Reposição de Buffet no KDS:**

- O KDS exibe dois tipos de card: **Pedido** (comanda de mesa) e **Reposição**
  (reposição de buffet)
- Cards de reposição **não têm mesa** — o título é "Reposição #N" (ex.:
  "Reposição #1"), que também serve como cabeçalho acessível do card
- Cada card de reposição lista os pratos de buffet a serem repostos
- Identificador de solicitação (ex.: "Solicitação REPO-001") substitui o
  identificador de comanda
- Status segue o mesmo fluxo: **Novo** → **Preparando** → **Pronto**

### 5.3.1 Abertura de comanda com cliente e número de pessoas

Na abertura de comanda (tanto pelo botão "Abrir comanda sem mesa" nas abas Cards/Mesa+Comanda,
quanto pelo `OpenComandaPane` no mapa de comandas), o fluxo expõe dois campos opcionais:

- **Cliente** — texto livre (máx 200 chars); o servidor persiste em `Order.customerName`
- **Pessoas** — inteiro 1–999; persiste em `Order.peopleCount`

Os valores são passados via `POST /api/orders` e armazenados na abertura. Após a comanda
existir, ambos podem ser editados a qualquer momento via `PATCH /api/orders/:id`, disponível
no painel de detalhamento lateral (Mapa + detalhamento) e no modal "Ver comanda". A edição
usa o componente compartilhado `OrderCustomerSection`, renderizado em ambas as superfícies
da mesma forma que `DetailAddProductForm` e `OrderBillingSection`.

A visão **Large cards** exibe `customerName` e `peopleCount` reais do order quando
preenchidos, com fallback para metadados de demo quando ambos são `null`.

### 5.3.2 Cadastro de clientes

- Model `Customer` no banco: `id`, `restaurantId`, `name`, `phone?`, `email?`, `notes?`
- Listagem com busca por nome: `GET /api/customers?search=...`
- Criação: `POST /api/customers` — duplicata pelo nome retorna o existente (idempotente)
- `Order.customerId` é FK opcional para `Customer`; `Order.customerName` é texto livre
  independente, permitindo capturar o nome antes de criar o cadastro formal
- Acesso de leitura: ADMIN e WAITER; criação: qualquer usuário com `ORDERS_CREATE`

### 5.4 Reservas

- Calendário de reservas por dia/hora
- Controle de mesas reservadas (bloqueia no mapa de mesas)
- Dados do cliente: nome, telefone, número de pessoas, observações
- Status: **pendente**, **confirmada**, **cancelada**, **compareceu**, **no-show**
- Lista de espera

### 5.5 Estoque e Inventário

- Cadastro de ingredientes/produtos com unidade (kg, un, L, g)
- Controle de quantidade mínima (alerta de reposição)
- Entrada de mercadoria (com fornecedor e nota fiscal)
- Baixa automática: ao vender um item composto, desconta ingredientes do estoque
- Baixa manual (perda, ajuste)
- Relatório de movimentação
- Fornecedores

### 5.6 Caixa e Pagamentos

- Abertura/fechamento de caixa por turno
- Múltiplos meios de pagamento: **dinheiro**, **cartão crédito/débito**, **PIX**
- Integração com gateways: **Stripe**, **Mercado Pago**, **PagSeguro**
- Fechamento de comanda com cálculo de troco
- Cupom simplificado (não fiscal nesta fase)
- Conferência de caixa (sangria, suprimento)
- Relatório de vendas do dia

### 5.7 Funcionários

- Cadastro com dados pessoais e contato
- Atribuição de perfil (RBAC)
- Controle de escala/horários
- Registro de ponto (entrada/saída)
- Comissionamento (configurável: por venda, por turno)

### 5.8 Relatórios

- Vendas por período (dia, semana, mês, custom)
- Faturamento por forma de pagamento
- Itens mais vendidos
- Ticket médio
- Ocupação de mesas
- Tempo médio de preparo
- Horários de pico
- Exportação CSV/PDF

### 5.9 Importação de Dados com IA (módulo de migration)

Ver seção 9 detalhada.

---

## 6. Modelo de Dados (high-level)

### 6.1 Entidades Principais

```
Restaurant (1 registro — preparado para multi-tenant futuro)
  └── User (admin, manager, waiter, cashier, kitchen)
  └── Table (mesa: número, capacidade, status, localização)
  └── MenuCategory
       └── MenuItem (nome, preço, descrição, imagem, código, disponível)
            └── MenuItemVariant (tamanho, sabor, adicional)
            └── MenuItemComposition → InventoryItem (link p/ baixa de estoque)
  └── Order (comanda: mesa opcional, status, total, garçom, timestamps)
       └── OrderItem (produto, quantidade, preço, variações, observação, status)
       └── Payment (forma, valor, timestamp)
  └── Reservation (cliente, mesa, data/hora, pessoas, status)
  └── InventoryItem (nome, unidade, quantidade, mínimo, fornecedor)
       └── StockMovement (entrada/saída, quantidade, motivo, timestamp)
  └── Supplier (nome, contato, CNPJ)
  └── Shift (funcionário, entrada, saída)
  └── CashRegister (turno, abertura, fechamento, saldo inicial/final)
  └── BuffetItem (nome, descrição, disponível — pratos do buffet p/ reposição)
```

### 6.2 Estratégia de IDs

- **IDs**: UUID v7 (ordem temporal + uniqueness) — ideal para sync offline-first (cliente gera o ID antes de sincronizar, sem colisão)
- **Timestamps**: `createdAt`, `updatedAt` em todas as tabelas (UTC)
- **Soft delete**: `deletedAt` nullable para preservar histórico

### 6.3 Versionamento para Sync

Cada entidade mutável tem:

- `version` (integer incremental) — incrementa a cada update
- `lastSyncedAt` — timestamp do último sync do registro
- `deviceId` — qual device originou a última mutação (debug de conflitos)

---

## 7. Arquitetura Offline-first e Sincronização

### 7.1 Princípio Fundamental

> **O usuário nunca espera a rede.** Toda escrita é local, instantânea e otimista. A sincronização acontece em background, transparente.

### 7.2 Fluxo de Escrita (exemplo: garçom lança produto em uma comanda)

```
1. Garçom toca "Adicionar produto" em uma comanda independente ou associada a uma mesa na visão combinada
2. App escreve no SQLite local IMEDIATAMENTE (OrderItem com UUID v7 gerado local)
3. UI atualiza instantaneamente (produto aparece na comanda)
4. Mutação é adicionada à fila de sync local (mutation_queue)
5. Garçom navega pra mesa 70, lança mais produtos — ZERO bloqueio
6. Em background, sync engine envia as mutações enfileiradas via POST /api/sync
7. Servidor processa, persiste no Postgres, confirma com 200 OK
8. Servidor emite evento WebSocket: order:item:added → Kitchen Display atualiza
9. Se offline: mutações ficam na fila, retry com backoff exponencial ao reconectar
10. Ao reconectar: sync bidirecional (envia pendentes + recebe mudanças de outros)
```

### 7.3 Componentes do Sync

#### App Mobile (React Native)

- **expo-sqlite**: banco local (espelho das tabelas relevantes: menu, mesas, comandas ativas)
- **Mutation Queue**: tabela `mutation_queue` no SQLite com: `id`, `entity`, `operation` (INSERT/UPDATE/DELETE), `payload` (JSON), `status` (pending/synced/failed), `attempts`, `createdAt`
- **Sync Engine** (package `shared`): classe `SyncEngine` que:
  - Monitora a fila local
  - Envia mutações em batch via `POST /api/sync/push`
  - Recebe atualizações via `GET /api/sync/pull?since=<lastSyncedAt>` ou via WebSocket
  - Aplica atualizações no SQLite local
  - Resolve conflitos (estratégia: ver 7.4)
  - Retry com backoff exponencial (1s, 2s, 4s, 8s... max 60s)

#### Web (Next.js PWA)

- **Service Worker** (Serwist/Workbox): cache do app shell (HTML, JS, CSS, imagens) pra funcionar offline
- **IndexedDB** (via Dexie): dados locais (mesmo espelho que o mobile)
- **Web Worker**: sync engine rodando em thread separada (não bloqueia UI)
- Mesma lógica de mutation queue e sync engine (compartilhado via `packages/shared`)

### 7.4 Resolução de Conflitos

Estratégia: **Last-Write-Wins (LWW) com version** — simples e adequada para este domínio.

- Cada mutação carrega `version` e `updatedAt`
- Servidor compara: se a versão recebida > versão no banco, aplica
- Se a versão recebida < versão no banco, **rejeita** e retorna o estado atual (cliente atualiza seu snapshot)
- Se a versão for igual, aplica (idempotente)
- Para campos críticos (ex: adicionar item vs. fechar comanda), o servidor valida regras de negócio antes de aplicar

Casos especiais:

- **Adicionar itens numa comanda**: operações são aditivas (append), não conflitam entre si (dois garçons podem adicionar itens simultaneamente — todos são aceitos)
- **Fechar comanda**: operação exclusiva — primeiro que fecha "ganha"; outros dispositivos recebem atualização via WebSocket que a comanda foi fechada

### 7.5 Escopo dos Dados Locais

O device não baixa o banco inteiro — apenas o necessário para operar:

| Entidade                  | Sincronizada para o device        | Estratégia                           |
| ------------------------- | --------------------------------- | ------------------------------------ |
| MenuCategory, MenuItem    | Sim (completo, cache)             | Pull periódico + WebSocket on change |
| Table                     | Sim (status em tempo real)        | WebSocket push                       |
| Order (comandas abertas)  | Sim (ativas do dia)               | Pull ao abrir app + WebSocket push   |
| Order (comandas fechadas) | Não                               | Apenas no servidor                   |
| InventoryItem             | Não (mobile) / Sim (web)          | Diferenciado por plataforma          |
| User                      | Sim (próprio perfil + permissões) | No login                             |

---

## 8. Tempo Real (WebSocket)

### 8.1 Servidor Socket.IO (apps/realtime)

Processo Node.js standalone rodando Socket.IO:

- **Rooms**: cada restaurante é um room (`restaurant:<id>`); kitchen display fica em sub-room (`restaurant:<id>:kitchen`)
- **Auto-reconexão**: Socket.IO reconecta automaticamente (crítico pra WiFi instável de restaurante)
- **Fallback**: long-polling se WebSocket falhar
- **Redis Adapter**: para escalar múltiplas instâncias (pub/sub via Redis)

### 8.2 Eventos

| Evento              | Direção                   | Payload                       | Descrição                                                 |
| ------------------- | ------------------------- | ----------------------------- | --------------------------------------------------------- |
| `order:created`     | → todos                   | `{ orderId, tableId }`        | Nova comanda aberta                                       |
| `order:changed`     | → usuários do restaurante | `{ orderId }`                 | Solicita atualização do snapshot pré-carregado da comanda |
| `order:item:added`  | → kitchen + dispositivos  | `{ orderId, item }`           | Item adicionado à comanda                                 |
| `order:item:status` | → kitchen + garçom        | `{ orderId, itemId, status }` | Status do item mudou (preparando/pronto)                  |
| `order:updated`     | → todos                   | `{ orderId, changes }`        | Comanda modificada                                        |
| `order:closed`      | → todos                   | `{ orderId, tableId }`        | Comanda fechada/paga                                      |
| `table:status`      | → todos                   | `{ tableId, status }`         | Status da mesa mudou                                      |
| `payment:processed` | → gerente                 | `{ orderId, amount, method }` | Pagamento registrado                                      |
| `menu:updated`      | → todos (garçons)         | `{ itemId, changes }`         | Item do cardápio alterado/disponibilidade                 |

### 8.3 Integração com Next.js

O servidor Socket.IO roda como serviço separado. Após persistir uma mudança de
comanda ou item, o Next.js API publica um evento interno autenticado para o
serviço realtime (`POST /internal/events`). O serviço valida o contrato e
distribui o evento apenas aos usuários autorizados do restaurante. O evento
`order:changed` notifica os clientes para buscar novamente o snapshot
pré-carregado pela rota web; o cliente não confia em dados de domínio enviados
pelo evento. A API registra falha de publicação sem desfazer uma operação já
persistida, e os clientes fazem reconciliação periódica enquanto estiverem sem
conexão realtime.

---

## 9. Módulo de Importação de Dados com IA

### 9.1 Fluxo

```
1. Usuário (gerente/admin) acessa: Importação de Dados no back-office web
2. Seleciona tipo de entidade: Produtos, Categorias, Mesas, Fornecedores, etc.
3. Faz upload do arquivo (CSV, XLSX, JSON, PDF)
4. Sistema envia o conteúdo do arquivo para a API do Anthropic Claude
5. Prompt estruturado instrui o Claude a:
   a. Analisar o conteúdo
   b. Identificar registros válidos
   c. Montar um RESUMO estruturado (JSON) de tudo que será inserido
   d. Validar campos críticos (nome do produto é obrigatório, preço numérico, etc.)
   e. Identificar e marcar inconsistências com motivo
6. Sistema exibe o resumo na tela (preview):
   - ✅ Registros válidos (prontos para inserção)
   - ❌ Registros inconsistentes (com motivo do erro em cada campo)
7. Usuário revisa o resumo
8. Se houver erros críticos (campo obrigatório faltando):
   - Exibe mensagem de erro clara com o motivo
   - Usuário corrige o arquivo e reenvia, OU
   - Usuário pode optar por importar apenas os registros válidos
9. Usuário confirma → dados são inseridos no PostgreSQL
10. Log de importação persistido (quem, quando, quantos registros, erros)
```

### 9.2 Formatos Aceitos

- **CSV** — separador auto-detectado (vírgula, ponto-e-vírgula, tab)
- **XLSX** — planilhas Excel (multi-aba suportada)
- **JSON** — arrays de objetos
- **PDF** — extração de texto/tabelas (útil para cardápios físicos digitalizados)

### 9.3 Validação com IA (Anthropic Claude)

- **Modelo**: Claude (via Anthropic API)
- **Prompt engineering**: prompt estruturado com schema do resultado esperado (JSON) definindo:
  - Quais campos são obrigatórios vs. opcionais
  - Regras de validação (tipo, formato, valor mínimo/máximo)
  - O que constitui "inconsistente" (ex: nome de produto vazio, preço negativo, categoria inexistente)
- **Resposta estruturada**: Claude retorna JSON com `{ valid: [...], invalid: [...], summary: "..." }`
- **Validação dupla**: após o Claude validar, o backend também valida com Zod (não confiar cegamente na IA)
- **Rate limiting**: controle de chamadas à API Anthropic por usuário/tempo
- **Tamanho máximo**: arquivos até 10MB; arquivos maiores são quebrados em chunks

### 9.4 Tratamento de Erros

| Cenário                              | Comportamento                                  |
| ------------------------------------ | ---------------------------------------------- |
| Nome do produto faltando (crítico)   | ❌ Bloqueia inserção do registro, exibe motivo |
| Preço ausente                        | ❌ Bloqueia, exibe motivo                      |
| Categoria não existe                 | ⚠️ Oferece criar a categoria ou pular          |
| Preço em formato errado ("R$ 25,00") | ✅ IA normaliza para 25.00                     |
| Duplicatas                           | ⚠️ Oferece atualizar ou ignorar                |
| Arquivo ilegível/corrompido          | ❌ Erro genérico, pede reenvio                 |

---

## 10. Integrações Externas

### 10.1 Gateways de Pagamento

| Gateway          | Uso                           | Método                 |
| ---------------- | ----------------------------- | ---------------------- |
| **Stripe**       | Cartões internacionais        | Stripe.js + Stripe API |
| **Mercado Pago** | PIX, cartões, boleto (Brasil) | Mercado Pago SDK       |
| **PagSeguro**    | Cartões, PIX (Brasil)         | PagSeguro API          |

Implementação:

- Camada de abstração (`packages/shared`): interface `PaymentProvider` com método `charge(amount, method, metadata)`
- Cada gateway implementa a interface
- Configuração ativa/desativa por restaurante (toggle no back-office)
- Webhooks para confirmação de pagamento assíncrono

### 10.2 iFood (Delivery)

- Integração via iFood API (Developer Portal)
- Receber pedidos do iFood → criar comanda automaticamente (tipo: delivery)
- Sincronizar status do pedido de volta (preparando → a caminho → entregue)
- Catálogo: exportar itens do cardápio para o iFood
- Webhook para receber pedidos em tempo real

### 10.3 Anthropic Claude (IA)

- Usado no módulo de importação (seção 9)
- API key armazenada em variável de ambiente do servidor
- Nunca exposta no frontend

---

## 11. Acessibilidade

- **Nível alvo**: WCAG 2.1 **AA** (razoável sem virar gargalo; AAA é excessivamente restritivo para componentes ricos como data tables e drag-and-drop)
- shadcn/ui já segue Radix UI primitives (foco gerenciado, ARIA, keyboard nav)
- Contraste mínimo 4.5:1 em texto
- Navegação por teclado funcional no web
- Touch targets mínimos 44x44px (mobile e tablet)
- Labels associados a todos os inputs
- `aria-live` para atualizações dinâmicas (status de mesa, novos pedidos)

---

## 12. Infraestrutura e Deploy

### 12.1 Opção Recomendada: Railway

| Serviço              | Custo estimado          | Observação                               |
| -------------------- | ----------------------- | ---------------------------------------- |
| Next.js web (app)    | ~$5-15/mo (Hobby)       | Processo long-running, suporta WebSocket |
| Socket.IO (realtime) | incluso (mesmo projeto) | Roda como service no Railway             |
| PostgreSQL           | ~$5/mo                  | Instância pequena (512MB)                |
| Redis                | ~$5/mo                  | Cache + Socket.IO adapter                |
| **Total estimado**   | **~$15-25/mo**          | Restaurante único, tráfego baixo         |

Vantagens:

- CI/CD nativo: push no GitHub → deploy automático
- Preview environments por PR
- App + DB + Redis no mesmo projeto (rede privada interna)
- WebSocket funciona (processo long-running, sem timeout serverless)
- Unlimited seats no Pro ($20/mo) — sem "Vercel tax" por desenvolvedor

### 12.2 Alternativa Custo: VPS Hetzner + Coolify

| Componente                     | Custo         |
| ------------------------------ | ------------- |
| Hetzner CX23 (2 vCPU, 4GB RAM) | €5,49/mo      |
| Coolify (self-hosted PaaS)     | Grátis        |
| Cloudflare (CDN + DDoS)        | Free tier     |
| **Total**                      | **~€5,49/mo** |

Roda Next.js + Postgres + Redis + Socket.IO numa única máquina. Coolify dá git-push deploy + preview URLs + SSL automático. Cloudflare na frente para CDN. Mais barato, mas exige manutenção de servidor (security updates, backups).

### 12.3 Configuração de Deploy

```
GitHub (main branch)
  → GitHub Actions (lint + test + build)
  → Railway auto-deploy on merge to main
  → Migrations Prisma automáticas (prisma migrate deploy)
  → Health check
  → Live
```

### 12.4 Variáveis de Ambiente

```
# Database
DATABASE_URL=postgresql://...

# Auth
AUTH_SECRET=...
NEXTAUTH_URL=https://...

# Redis
REDIS_URL=redis://...

# Socket.IO
SOCKET_IO_PORT=3001

# Pagamentos
STRIPE_SECRET_KEY=...
MERCADO_PAGO_ACCESS_TOKEN=...
PAGSEGURO_TOKEN=...

# iFood
IFOOD_CLIENT_ID=...
IFOOD_CLIENT_SECRET=...

# IA
ANTHROPIC_API_KEY=...

# Sentry
SENTRY_DSN=...
```

---

## 13. CI/CD

### 13.1 Pipeline (GitHub Actions)

```
on: push to main / PR to main

jobs:
  1. install       → pnpm install (cache)
  2. lint          → ESLint + Prettier (todos os packages)
  3. typecheck     → tsc --noEmit (todos os packages)
  4. test          → Vitest (unit + integration)
  5. build:web     → next build
  6. build:mobile  → expo export (verificação de build)
  7. deploy        → Railway (apenas on merge to main)
```

### 13.2 Mobile (Expo EAS)

- **EAS Build** via GitHub Action: gera APK/AAB on tag release
- **OTA Updates** via `eas update` push de JS bundle sem ir pra loja
- Distribuição interna via Expo (link de download) durante desenvolvimento
- Google Play Store para produção (futuro)

---

## 14. Roadmap de Entregas

### Fase 1 — Fundação (MVP operacional)

- Monorepo setup (Turborepo + pnpm)
- Schema Prisma + migrations + PostgreSQL
- Auth (Auth.js v5) com perfis
- Web: layout shadcn/ui + navegação + auth flow
- Mobile: setup Expo + Expo Router + auth
- packages/shared: tipos + schemas Zod

### Fase 2 — Operação de Pista (garçom)

- Mobile: mapa de mesas
- Mobile: abrir comanda + lançar produtos
- Mobile: SQLite local + mutation queue + sync engine
- Realtime: Socket.IO + eventos básicos
- Web: Kitchen Display

### Fase 3 — Back-office

- Web: gestão de cardápio (CRUD completo)
- Web: gestão de mesas (configuração)
- Web: estoque e inventário
- Web: reservas
- Web: relatórios básicos

### Fase 4 — Pagamentos e Financeiro

- Web: caixa (abertura/fechamento/turno)
- Mobile: receber pagamento (dinheiro/cartão/PIX)
- Integração: Mercado Pago (PIX)
- Integração: Stripe
- Integração: PagSeguro

### Fase 5 — Integrações e IA

- iFood API (pedidos de delivery)
- Módulo de importação com IA (Claude)
- Relatórios avançados + exportação

### Fase 6 — Refinamento

- PWA do web (Service Worker + offline)
- Acessibilidade WCAG AA audit
- Performance tuning (listas, navegação)
- Sentry + monitoramento
- OTA updates (Expo)

---

## 15. Decisões Técnicas Registradas

| Decisão                | Escolha                            | Justificativa                                                               |
| ---------------------- | ---------------------------------- | --------------------------------------------------------------------------- |
| Framework web          | Next.js 16 (App Router)            | Padrão moderno, RSC, Server Actions, deploy flexível                        |
| UI web                 | shadcn/ui + Tailwind               | Componentes acessíveis (Radix), customizáveis, sem lock-in                  |
| Mobile                 | React Native + Expo (New Arch)     | Reaproveitamento TS com web, FlashList 60fps, OTA updates                   |
| Listas mobile          | @shopify/flash-list                | Recicla views, performance nativa em listas grandes                         |
| Database               | PostgreSQL                         | Único requisito do cliente, robusto, suporta JSON, realtime-ready           |
| ORM                    | Prisma                             | Type-safe, migrations, compartilhável entre web e realtime                  |
| Auth                   | Auth.js v5 (NextAuth)              | Padrão Next.js, JWT, multi-provider                                         |
| Comandas por mesa      | Múltiplas comandas abertas         | Decisão confirmada para o MVP; sem configuração de cardinalidade nesta fase |
| Realtime               | Socket.IO                          | Auto-reconexão, rooms, fallback, maduro                                     |
| Monorepo               | Turborepo + pnpm                   | Build paralelo, cache, packages compartilhados                              |
| IDs                    | UUID v7                            | Temporal + unique, ideal para offline-first                                 |
| Deploy                 | Railway                            | Custo-benefício, WebSocket nativo, CI/CD via git push                       |
| IA                     | Anthropic Claude                   | Escolha do cliente para validação de importação                             |
| Offline local (mobile) | expo-sqlite                        | SQLite nativo no device                                                     |
| Offline local (web)    | IndexedDB (Dexie) + Service Worker | PWA offline-first                                                           |
| Conflict resolution    | Last-Write-Wins + version          | Simples, adequado para domínio de restaurante                               |
| Acessibilidade         | WCAG 2.1 AA                        | Equilíbrio entre inclusão e viabilidade                                     |

---

## 16. Pontos em Aberto (a definir)

- [ ] Impresão fiscal / NFC-e (fica para fase futura — cliente pediu pra não preocupar agora)
- [ ] App iOS (estrutura preparada, execução futura)
- [ ] Multi-restaurante / franquia (schema preparado com `restaurantId`, execução futura)
- [ ] Modo offline do web (Service Worker) — definir estratégia de cache (stale-while-revalidate vs cache-first)
- [ ] Estratégia de backup do PostgreSQL (Railway snapshots automáticos vs externo)
- [ ] Limite de dispositivos conectados simultaneamente (Socket.IO connection management)
- [ ] Dashboard de métricas em tempo real (mesas ocupadas, tempo médio, faturamento do dia)
