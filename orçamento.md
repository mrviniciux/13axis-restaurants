# Orçamento de infraestrutura — Mudra for Restaurants

**Data da estimativa:** 06/11/2026
**Escopo:** piloto operacional com **1 restaurante** (back-office web + tempo real + banco).
**Base:** `specification.md` (§12 — Infraestrutura e Deploy), `docs/deploy.md` (estratégia de deploy).
**Preços:** verificados em 06/11/2026 nos sites dos provedores (fontes na seção 12). Sujeitos a alteração.
**Pesquisa complementar:** opções mais baratas do mercado em [`pesquisa-opcoes-baratas.md`](pesquisa-opcoes-baratas.md).

> **Câmbio usado apenas para referência:** ~R$ 5,50 por US$ 1 e ~R$ 6,00 por € 1.
> Os preços oficiais são cobrados em **USD ou EUR**; o valor em reais é uma aproximação.

---

## 1. Premissas

- **Um restaurante por banco** (modelo atual do CLI `create-admin`): não há plano multi-tenant.
- Tráfego do piloto: dezenas de usuários simultâneos no pico, dados pequenos (MVP).
- Instância única do serviço realtime (nesta condição o **Redis é opcional**, conforme `docs/deploy.md` §8.1).
- CI/CD no GitHub Actions (free tier) já parcialmente configurado (`.github/workflows/ci.yml`).
- App mobile em distribuição interna (APK) durante o piloto; loja só depois da integração real.
- **Fora do escopo deste orçamento:** horas de desenvolvimento e manutenção do próprio sistema.

---

## 2. Arquitetura de referência

| Serviço                | Função                                            | Recurso sugerido             |
| ---------------------- | ------------------------------------------------- | ---------------------------- |
| `web` — Next.js 16     | UI + API Routes + Auth.js                         | 0.5 vCPU / 1 GB RAM          |
| `realtime` — Socket.IO | WebSocket/WSS de tempo real                       | 0.25 vCPU / 512 MB RAM       |
| PostgreSQL 16          | Fonte de verdade                                  | ~1 GB RAM / ~1 GB disco      |
| Redis (opcional)       | Adapter do Socket.IO, só com múltiplas instâncias | —                            |
| Domínio                | `app.exemplo.com` + `realtime.exemplo.com`        | .com anual                   |
| TLS/HTTPS              | Certificado automático                            | Grátis (provedor/Cloudflare) |

---

## 3. Cenário A — Railway (recomendado pela spec)

### 3.1 Detalhamento mensal

| Item                        | Configuração       | Base de cálculo         | Custo/mês           |
| --------------------------- | ------------------ | ----------------------- | ------------------- |
| Web (Next.js + Prisma)      | 0.5 vCPU / 1 GB    | US$ 20/vCPU + US$ 10/GB | **~US$ 20**         |
| Realtime (Socket.IO)        | 0.25 vCPU / 512 MB | idem                    | **~US$ 10**         |
| PostgreSQL 16               | ~1 GB RAM + disco  | instância pequena       | **~US$ 6–8**        |
| Transferência de rede       | ~30 GB/mês         | ~US$ 0,05/GB (est.)     | **~US$ 1–2**        |
| Plano **Hobby**             | mínimo             | inclui US$ 5 de uso     | **US$ 5**           |
| **Total estimado (piloto)** |                    |                         | **≈ US$ 30–40/mês** |

> O Railway cobra por uso real de CPU/memória/rede. Em uso bem baixo o total pode cair para
> **~US$ 20–25/mês**; dimensionamento menor (0.25 vCPU no web) também reduz a conta.

### 3.2 Planos

| Plano     | Assinatura | Inclui        | indicado para                  | Total mensal estimado |
| --------- | ---------- | ------------- | ------------------------------ | --------------------- |
| **Hobby** | US$ 5/mês  | US$ 5 de uso  | piloto/dev pessoal             | **≈ US$ 30–40**       |
| **Pro**   | US$ 20/mês | US$ 20 de uso | produção comercial (multiseat) | **≈ US$ 40–55**       |

> O plano **Hobby é para uso pessoal/avaliação**; para o produto ir a clientes reais,
> a opção adequada é o **Pro** (mesma faixa de custo, com margem de crescimento).

### 3.3 Anual consolidado (Railway)

| Cenário                | Mensal    | Anual               |
| ---------------------- | --------- | ------------------- |
| Hobby (piloto)         | US$ 30–40 | **US$ 360–480/ano** |
| Pro (produção)         | US$ 40–55 | **US$ 480–660/ano** |
| Domínio (.com)         | —         | ~US$ 10–15/ano      |
| **Total anual aprox.** |           | **US$ 370–675/ano** |

Em reais: **~R$ 2.000–3.700/ano** (conforme câmbio).

---

## 4. Cenário B — VPS Hetzner + Coolify (alternativa de custo)

Roda Next.js + Socket.IO + PostgreSQL + Redis numa **única máquina**, com Coolify
(git-push deploy, SSL automático) e Cloudflare (CDN/DoS) na frente.

| Item                                      | Custo/mês          |
| ----------------------------------------- | ------------------ |
| Hetzner **CX23** (2 vCPU / 4 GB / 40 GB)  | **€ 5,99**         |
| IPv4 primário (cobrado à parte em 2026)   | € 0,50             |
| Backup automático da VPS (+20%, opcional) | € 1,20             |
| Coolify (self-hosted PaaS)                | Grátis             |
| Cloudflare (CDN + TLS)                    | Free tier          |
| **Total**                                 | **≈ € 6,50–8/mês** |

Em reais: **~R$ 40–50/mês** (~R$ 480–600/ano).

**Trade-off:** é 4–6× mais barato, mas exige **operação própria** — atualizações de
segurança, backup/teste de restore do PostgreSQL, TLS e monitoramento por conta da equipe.
O `docs/deploy.md` registra essa alternativa justamente para quem pode bancar a operação.

---

## 5. Itens opcionais e adicionais

| Item                    | Quando necessário                                    | Custo                                                                  |
| ----------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| **Redis**               | Somente com **múltiplas instâncias** do realtime     | Railway: **US$ 3–5/mês**; Hetzner: incluso na VPS                      |
| **Ambiente de staging** | Validação de release (recomendado antes de produção) | Railway: **+US$ 30–40/mês**; Hetzner: pode compartilhar a VPS (grátis) |
| **Sentry** (erros)      | Diagnóstico em produção (ainda não integrado)        | **Free** (1 usuário, 5k erros/mês) → Team **US$ 26–29/mês**            |
| **GitHub Actions** (CI) | lint + typecheck + testes + build                    | **Grátis** (free tier 2.000 min/mês em repos privados)                 |
| **Domínio**             | Sempre                                               | **~US$ 10–15/ano**                                                     |
| **Backup off-provider** | RPO < 24h / retenção > a do provedor                 | Backblaze B2/Cloudflare R2: **~US$ 0–2/mês** (poucos GB)               |
| **Logs/uptime**         | Metas do piloto (deploy.md §12)                      | Logs do provedor (grátis) + uptime de 2 domínios (UptimeRobot free)    |

---

## 6. Mobile (Expo EAS + loja)

O app está **demonstrativo** hoje (sem sync/API real, `docs/deploy.md` §10.1) —
não distribuir como operacional antes da integração.

| Item                                              | Custo                            |
| ------------------------------------------------- | -------------------------------- |
| **EAS Free** — builds internos (APK de piloto)    | **US$ 0** (limite de builds/mês) |
| **EAS Starter** — mais builds + OTA básico        | **US$ 19/mês**                   |
| **EAS Production** — OTA com MAU (~50 mil)        | **US$ 199/mês**                  |
| **Google Play Console**                           | **US$ 25** (taxa única)          |
| Distribuição interna (link de APK) durante piloto | **US$ 0**                        |

**Recomendação:** piloto em **EAS Free** (builds internos). OTA/Production só quando o
app estiver integrado ao backend (autenticação + sync + `expo-updates` configurado).

---

## 7. Custos únicos (pagos uma vez)

| Item                                                    | Custo                        |
| ------------------------------------------------------- | ---------------------------- |
| Google Play Developer (se publicar na loja)             | US$ 25                       |
| Configuração do provedor, DNS e variáveis               | Sem custo (horas da equipe)  |
| Migração inicial (`db:migrate:deploy`) + `create-admin` | Sem custo (roda no provedor) |

---

## 8. Resumo comparativo

| Cenário                       | Mensal    | Anual       | Anual (≈ R$)    | Esforço de operação  |
| ----------------------------- | --------- | ----------- | --------------- | -------------------- |
| **A) Railway Hobby (piloto)** | US$ 30–40 | US$ 360–480 | ~R$ 2.000–2.650 | Baixo (gerenciado)   |
| **A) Railway Pro (produção)** | US$ 40–55 | US$ 480–660 | ~R$ 2.650–3.650 | Baixo (gerenciado)   |
| **B) Hetzner + Coolify**      | € 6,50–8  | € 78–96     | ~R$ 480–600     | Alto (equipe mantém) |

**Recomendação prática (piloto):**

- **Simples e rápido:** Railway Hobby ≈ **US$ 35/mês** (web + realtime + Postgres + rede).
- **Menor custo:** Hetzner CX23 ≈ **€ 7/mês**, desde que haja alguém responsável pela operação.
- Começar **sem Redis** (instância única do realtime) e **sem staging separado**;
  adicionar conforme necessário (itens da seção 5).

---

## 9. Escala por restaurante

No modelo atual (banco por restaurante), a infraestrutura **escala linearmente**:

| Nº de restaurantes | Railway (Hobby) | Hetzner + Coolify |
| ------------------ | --------------- | ----------------- |
| 1                  | ~US$ 35/mês     | ~€ 7/mês          |
| 5                  | ~US$ 175/mês    | ~€ 35/mês*        |
| 10                 | ~US$ 350/mês    | ~€ 70/mês*        |

\* No Hetzner, múltiplos projetos podem (talvez) caber numa VPS maior, mas a operação
fica proporcionalmente mais complexa (bancos e serviços por restaurante).

> **Risco de custo:** para escalar a vários restaurantes sem multiplicar a conta,
> a alternativa arquitetural é um modelo **multi-tenant** (um banco com `restaurantId`),
> fora do escopo atual e previsto apenas como evolução na especificação.

---

## 10. O que não entra neste orçamento

Itens previstos na spec/deploy **ainda não integrados ao código**, portanto sem custo no MVP:

- **Pagamentos online** (Stripe / Mercado Pago / PagSeguro): sem mensalidade; cobrança
  apenas de **tarifa por transação** quando integrados. O app hoje só **lança** pagamentos.
- **iFood** (integração): sem custo de plataforma.
- **Anthropic API** (importação de cardápio por IA): cobro por uso, quando implementada.
- **Chaves de Stripe/Secrets**: só em secret manager quando a integração existir
  (`docs/deploy.md` §6.5).

---

## 11. Checklist de custos do primeiro mês

- [ ] Conta no Railway (Hobby US$ 5 ou Pro US$ 20)
- [ ] Serviços `web`, `realtime` e `PostgreSQL` criados
- [ ] Domínio registrado (~US$ 12/ano)
- [ ] DNS apontado + TLS automático (grátis)
- [ ] Health checks implementados (`/api/health`, `/health`) — sem custo, mas é pré-requisito
- [ ] Backup automático ativo + teste de restore (`docs/deploy.md` §7.4)
- [ ] EAS Free configurado para builds internos do mobile
- [ ] (Opcional) Sentry Free para monitoramento de erros
- [ ] (Opcional) Redis — apenas se houver mais de uma instância do realtime

---

## 12. Fontes dos preços

- Railway — planos e uso: <https://railway.com/pricing> · <https://docs.railway.com/pricing/plans>
- Hetzner Cloud — preços (2026): <https://www.hetzner.com/cloud/cost-optimized/>
- Expo / EAS — planos: <https://expo.dev/pricing> · <https://docs.expo.dev/billing/plans/>
- Sentry — planos: <https://sentry.io/pricing/>
- GitHub Actions — cota free tier: <https://docs.github.com/billing/managing-billing-for-your-products/managing-billing-for-github-actions>
- Domínio `.com`: preços de registradores (~US$ 10–15/ano, variável)

**Ressalva final:** os valores são **estimativas de infraestrutura** para dimensionar o
piloto. Custos de uso variam com tráfego real, consumo de rede e disco; confirme no painel
do provedor antes de contratar. Horas de desenvolvimento, manutenção e suporte não estão
incluídas.
