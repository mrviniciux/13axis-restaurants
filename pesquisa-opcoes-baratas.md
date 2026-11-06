# Pesquisa de opções mais baratas de hospedagem — Mudra for Restaurants

**Data da pesquisa:** 06/11/2026
**Objetivo:** encontrar alternativas com custo menor que o cenário atual do [`orçamento.md`](orçamento.md)
(Railway ≈ US$ 30–40/mês).
**Preços:** verificados em 06/11/2026 (fontes na seção 8). Variáveis por região/promoção.

---

## 1. Requisitos do projeto (o que a opção precisa suportar)

| Requisito                              | Detalhe                                                                                                                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js 22 + build pnpm/monorepo       | Next.js 16 + Prisma + `argon2` nativos → build no **Linux** (`docs/deploy.md` §5.1)                                                                                                                  |
| Processo long-running (não serverless) | Next.js com Prisma mantém pool de conexões                                                                                                                                                           |
| **WebSocket/WSS estável**              | Socket.IO do `apps/realtime` não pode dormir/cold start                                                                                                                                              |
| PostgreSQL 16 + migrações Prisma       | Conexão direta para `prisma migrate deploy`                                                                                                                                                          |
| Redis opcional                         | Só com múltiplas instâncias do realtime (instância única não usa)                                                                                                                                    |
| HTTPS/WSS + deploy do GitHub           | TLS automático; CI já existe no GitHub Actions                                                                                                                                                       |
| **Particularidade do projeto**         | O fallback de tempo real faz refresh a cada **5 s** com a página visível → durante o uso o banco é consultado **continuamente**. Isso importa para free tiers de banco medidos por horas de compute. |

---

## 2. Tabela-resumo (mais barato → mais caro)

| #   | Opção                                           | Custo/mês                | Tipo       | Operação   | Cobre web+realtime+DB?                    |
| --- | ----------------------------------------------- | ------------------------ | ---------- | ---------- | ----------------------------------------- |
| 1   | **Oracle Cloud Always Free** + Docker           | **US$ 0**                | VPS grátis | Alta       | ✅ tudo numa VM                           |
| 2   | **Fly.io** (2× 512 MB) + Neon free              | **~US$ 9–11**            | PaaS       | Baixa      | ✅ (DB externo free)                      |
| 3   | **VPS Contabo** (4 vCPU/8 GB) + Coolify         | **~€ 5,50–7** ≈ US$ 6–8  | VPS        | Média/Alta | ✅ tudo numa VM                           |
| 4   | **VPS Hetzner CX23** + Coolify _(do orçamento)_ | **€ 6,50–8**             | VPS        | Média/Alta | ✅ tudo numa VM                           |
| 5   | **Render** (2 serviços Starter + DB)            | **~US$ 14–21**           | PaaS       | Baixa      | ✅ (free tier limitado no início)         |
| 6   | **Koyeb** free tier                             | **US$ 0** (só 1 serviço) | PaaS       | Baixa      | ⚠️ parcial                                |
| 7   | **Railway** _(referência atual)_                | **US$ 30–40**            | PaaS       | Baixa      | ✅                                        |
| —   | **Vercel**                                      | —                        | Serverless | Baixa      | ❌ não combina com Socket.IO long-running |

---

## 3. Detalhe das opções

### 3.1 US$ 0 — Oracle Cloud Always Free (mais specs sem custo)

- **2 OCPU ARM (Ampere) + 12 GB RAM + 200 GB disco + 10 TB de egress/mês**, sempre grátis
  (limites de 1.500 OCPU-hours e 9.000 GB-hours/mês desde jun/2026).
- Roda tudo com Docker/Coolify: Next.js, Socket.IO, Postgres e proxy de TLS (Caddy/Traefik).
- **Prós:** capacidade muito além do piloto, sem custo recorrente.
- **Contras/risco:** sem SLA; relatos frequentes de instâncias ociosas liberadas ou "reclamadas";
  exige operação própria; precisa de cartão. **Não usar sem plano B de migração.**
- Alternativa grátis equivalente: AWS/GCP/Azure free tier de 12 meses (depois preço cheio) —
  mais complexidade e o e2-micro/t2.micro (1 GB) é apertado para Next + Postgres juntos.

### 3.2 US$ 0 — Free tiers de PostgreSQL (banco separado)

| Provedor            | Limite grátis                                       | Comportamento importante                                                                             |
| ------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Neon**            | 100 CU-hours/mês (≈ 400 h ativo a 0,25 CU) + 500 MB | Suspende compute em 5 min ocioso; **se estourar as horas, suspende até o próximo ciclo (não cobra)** |
| **Supabase**        | 500 MB + 5 GB egress, 2 projetos                    | **Pausa após 7 dias sem atividade**; sem excedente surpresa                                          |
| **Aiven**           | 1 GB RAM + 5 GB disco                               | Sem pausa; conexões limitadas                                                                        |
| **Prisma Postgres** | ~500 MB                                             | Natural para quem já usa Prisma                                                                      |

> **Cuidado com o fallback de 5 s:** com a tela aberta o compute fica ativo praticamente todo o
> tempo; 100 CU-hours ≈ **13 h/dia**. É apertado para operação contínua — no máximo use free tier
> para **staging/dev ou piloto muito pequeno monitorado**. O impacto de estourar é indisponibilidade
> (suspensão), não cobrança.

### 3.3 ~US$ 9–11/mês — Fly.io (melhor PaaS barato)

| Item                             | Cálculo            | Custo/mês      |
| -------------------------------- | ------------------ | -------------- |
| Web (shared-cpu-1x, 512 MB)      | contínuo           | US$ 3,69       |
| Realtime (shared-cpu-1x, 512 MB) | contínuo           | US$ 3,69       |
| Volume (3 GB)                    | US$ 0,15/GB        | US$ 0,45       |
| IPv4 compartilhado               | ~US$ 0,50/app      | ~US$ 1,00      |
| Egress (~30 GB)                  | US$ 0,02/GB        | ~US$ 0,60      |
| Banco                            | Neon/Supabase free | US$ 0          |
| **Total**                        |                    | **≈ US$ 9–10** |

- **Prós:** PaaS com git deploy, WebSocket nativo, egress barato; comparativos apontam até ~78 %
  mais barato que Railway; US$ 1 de crédito para começar.
- **Contras:** Postgres **gerenciado do Fly parte de US$ 38/mês** → usar banco externo free ou
  volume self-hosted; configuração via `fly.toml` (menos visual que Railway); 256 MB (US$ 1,94)
  é pouco para SSR do Next — 512 MB é o mínimo recomendado.

### 3.4 ~US$ 6–8/mês — VPS (mais recursos por euro)

| Provedor                          | Specs                              | Preço/mês                           |
| --------------------------------- | ---------------------------------- | ----------------------------------- |
| **Contabo** Cloud VPS 4           | 4 vCPU / 8 GB / 100 GB SSD         | **€ 5,30–5,50** (promoção 24 meses) |
| **Hetzner** CX23 _(do orçamento)_ | 2 vCPU / 4 GB / 40 GB              | € 5,99 (+IPv4 ~€ 0,50)              |
| **Netcup** VPS                    | ~2 vCPU / 4 GB                     | ~US$ 6,40                           |
| **AWS Lightsail**                 | 1 vCPU / 1 GB / 20 GB              | US$ 5 (12 meses grátis no t2.micro) |
| **Vultr** Cloud Compute           | specs mínimas a partir de US$ 2,50 | ~US$ 6 para plano usável            |
| **DigitalOcean**                  | 1 vCPU / 1 GB                      | US$ 4–6                             |

- Coolify (grátis) + Cloudflare (grátis) → git-push deploy + SSL automático.
- Tudo numa VM: web + realtime + Postgres (+ Redis), conforme estratégia do `docs/deploy.md` §12.2.
- **Contras:** operação própria (updates de segurança, backup/teste de restore, TLS, monitoramento).

### 3.5 ~US$ 14–21/mês — Render (PaaS com painel simples)

- **Free tier:** web service 512 MB (**dorme após inatividade**) + Postgres 256 MB
  (**limite de ~30–90 dias**) → bom só para prova de conceito. O sleep **derruba o WebSocket** do realtime.
- **Pago realista:** Starter US$ 7 por serviço (web + realtime = US$ 14) + Postgres US$ 7–20
  → **≈ US$ 21–34/mês**.
- **Prós:** interface simples, WebSocket suportado no serviço pago, previsibilidade de preço.
- **Contras:** free tier não sustenta produção; o preço pago converge com o Railway.

### 3.6 US$ 0 parcial — Koyeb

- Free tier: **1 serviço always-on grátis** (512 MB) → cobre **web ou realtime**, não os dois.
- Starter US$ 0 + compute por uso; Pro US$ 29/mês.
- Com os dois serviços do projeto já sai do grátis; serve como alternativa só se algum
  serviço migrar para outra plataforma.

### 3.7 Referência — Railway: US$ 30–40/mês

Mantido como cenário base do `orçamento.md` (Hobby) por ser o mais simples de operar.

### 3.8 Descartadas nesta pesquisa

| Opção                              | Motivo da descarte                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Vercel**                         | Serverless/edge; no Hobby não sustenta Socket.IO de longa duração e impõe limites de execução — incompatível com o `apps/realtime` |
| **Heroku**                         | Sem free tier e preços na casa de US$ 5–7+ só pelo dyno web                                                                        |
| **AWS/GCP/Azure padrão**           | Free de 12 meses + complexidade enterprise; depois o preço salta acima do Railway                                                  |
| **Fly/Render Postgres gerenciado** | US$ 38/mês (Fly) e saltos de tier (Render) — usar banco externo free compensa                                                      |

---

## 4. Combinações recomendadas por perfil

| Perfil                               | Combinação                                                | Custo/mês      | Economia vs Railway |
| ------------------------------------ | --------------------------------------------------------- | -------------- | ------------------- |
| **Custo zero** (aceitando risco)     | Oracle Always Free + Docker (Postgres na VM) + Cloudflare | **US$ 0**      | 100 %               |
| **Mais barato sustentável**          | VPS Contabo + Coolify + Cloudflare                        | **~US$ 6–8**   | ~75–85 %            |
| **PaaS barato, sem operar servidor** | Fly.io (2× 512 MB) + Neon/Supabase free                   | **~US$ 9–11**  | ~70–75 %            |
| **PaaS com painel simples**          | Render Starter ×2 + banco free                            | **~US$ 14–21** | ~45–65 %            |
| **Referência (hoje)**                | Railway Hobby                                             | US$ 30–40      | —                   |

**Economia anual aproximada:**

| Perfil             | vs Railway           |
| ------------------ | -------------------- |
| Oracle Always Free | **~US$ 360–480/ano** |
| VPS Contabo        | **~US$ 280–400/ano** |
| Fly.io             | **~US$ 230–350/ano** |

---

## 5. Riscos e ressalvas

1. **Free tiers afetam disponibilidade, não só o bolso:** Neon suspende compute ao estourar horas;
   Supabase pausa após 7 dias; Render dorme com inatividade. O fallback de 5 s piora o consumo —
   não deixar banco de produção em free tier sem plano B e monitoramento.
2. **Oracle Always Free:** sem SLA e histórico de liberação de instâncias ociosas; manter backup e
   caminho de migração testado.
3. **VPS/self-host:** segurança, updates, backup/restore ensaiado e TLS ficam com a equipe
   (requisitos já listados em `docs/deploy.md` §4 e §7.4).
4. **Build nativo:** Prisma e `argon2` precisam compilar em Linux — todos os provedores acima
   buildam em Linux; num VPS, buildar no servidor ou usar imagem Docker.
5. **WebSocket:** evitar plataformas que durmam processos (Render free, serverless em geral).
6. **Promoções:** preços Contabo/Netcup costumam ser de fidelização (24 meses); confirmar no site
   antes de contratar.

---

## 6. Recomendação

- **Quer reduzir já, mantendo PaaS simples:** migrar do Railway para **Fly.io (~US$ 10/mês)**
  com banco no Neon free é o melhor salto de custo/benefício — mesma natureza de deploy
  (git push), WebSocket estável e ~70 % de economia.
- **Quer o menor custo de verdade e pode operar:** **VPS Contabo/Hetzner + Coolify (~US$ 6–8)**
  — estratégia já prevista como "alternativa custo" na spec (§12.2).
- **Quer experimentar sem pagar:** Oracle Always Free para o ambiente inteiro, ou free tier de
  banco (Neon/Supabase) para staging — sempre com plano de saída.
- **Evitar:** Vercel (incompatível com o realtime) e Render free em produção (sleep/expiração).

---

## 7. Opções mapeadas (visão geral)

`Oracle Always Free` · `Fly.io` · `Render` · `Koyeb` · `Railway` · `Contabo` · `Hetzner` ·
`Netcup` · `Vultr` · `AWS Lightsail` · `DigitalOcean` · `Neon` · `Supabase` · `Aiven` ·
`Prisma Postgres` · `Coolify` · `Cloudflare`

---

## 8. Fontes

- Railway: <https://railway.com/pricing>
- Fly.io: <https://fly.io/pricing> · <https://docs.fly.io/about/pricing>
- Render: <https://render.com/pricing> · <https://render.com/docs/free>
- Koyeb: <https://www.koyeb.com/pricing>
- Hetzner: <https://www.hetzner.com/cloud/cost-optimized/>
- Contabo: <https://contabo.com/en-us/vps/> · <https://contabo.com/blog/best-budget-vps-developers/>
- Neon: <https://neon.com/pricing>
- Supabase: <https://supabase.com/pricing>
- Aiven (Postgres free): <https://aiven.io/free-postgresql-database>
- Oracle Always Free: <https://www.oracle.com/cloud/free/> ·
  <https://docs.oracle.com/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm>
- AWS Lightsail: <https://aws.amazon.com/lightsail/pricing/>
- Vultr: <https://www.vultr.com/pricing/>

**Ressalva:** pesquisa de mercado com preços em USD/EUR verificados em 06/11/2026; sujeitos a
alteração, promoção e região. Confirme no provedor antes de contratar. Ver também o orçamento em
[`orçamento.md`](orçamento.md).
