# Orçamento para WhatsApp — Mudra for Restaurants

Modelo pronto para copiar e colar no WhatsApp (bloco abaixo).
Cálculo usando **€ 1 ≈ R$ 6,00** e **US$ 1 = R$ 5,50** (ajuste a cotação do dia).
Horas: valor por hora em branco para você preencher.

---

```
ORÇAMENTO — Mudra for Restaurants (início do projeto)
Data: 06/11/2026 · Cotação: €1 ≈ R$6,00 · US$1 = R$5,50

━━━━━━━━━━━━━━━━━━━━━━━━
📦 1) SERVIÇOS DE DEPLOY (prioridade Hetzner)
━━━━━━━━━━━━━━━━━━━━━━━━

1. Hetzner Cloud CX23 — servidor da aplicação
🔗 https://www.hetzner.com/cloud/
🎯 Rodar TUDO numa máquina só: app web, servidor de
tempo real (Socket.IO) e banco de dados PostgreSQL
💰 € 5,99/mês ≈ R$ 36/mês
(Detalhe: 2 vCPU · 4 GB RAM · 40 GB · IPv4 incluído.
Cobrança por hora, cancela quando quiser.)

2. Hetzner Backup — cópia de segurança diária
🔗 https://docs.hetzner.com/cloud/servers/backups-snapshots/
🎯 Proteger dados de mesas, comandas e cardápio
💰 +20% do servidor ≈ € 1,20/mês ≈ R$ 7/mês

3. Coolify — painel de publicação (grátis)
🔗 https://coolify.io
🎯 Publicar atualizações com 1 clique (git push) e
gerenciar domínio/SSL no próprio servidor
💰 US$ 0

4. Cloudflare — DNS + certificado SSL
🔗 https://cloudflare.com
🎯 Apontar o domínio e HTTPS automático
💰 US$ 0

5. Domínio .com.br
🔗 https://registro.br
🎯 Endereço do sistema para o restaurante
💰 ~R$ 40/ano (≈ R$ 3,30/mês)

6. GitHub — código + testes automáticos
🔗 https://github.com/pricing
🎯 Código-fonte e integração contínua
💰 US$ 0 (free)

7. Expo EAS — gerador do app Android
🔗 https://expo.dev/pricing
🎯 Compilar o APK do aplicativo do garçom
💰 US$ 0 (free tier)

8. Sentry — monitoramento de erros
🔗 https://sentry.io/pricing
🎯 Avisar se algo quebrar em produção
💰 US$ 0 (free tier — 5 mil erros/mês)

Subtotal de deploy: ~R$ 46/mês (€7,19)

Alternativa PaaS (se preferir não operar servidor):
Fly.io — US$ 10/mês ≈ R$ 55/mês
🔗 https://fly.io/pricing

━━━━━━━━━━━━━━━━━━━━━━━━
🤖 2) LICENÇA DE IA (desenvolvimento)
━━━━━━━━━━━━━━━━━━━━━━━━

9. Claude Pro — licença de IA para programar
🔗 https://claude.ai/pricing
🎯 Desenvolver o sistema com IA: escrever, revisar
e testar código
💰 US$ 20/mês ≈ R$ 110/mês
Alternativa pesada: Claude Max US$ 100/mês (uso intenso)

10. Anthropic API — opcional (entrega futura, Fase 5)
🔗 https://console.anthropic.com
🎯 Importação de cardápio por IA (foto → produto)
💰 US$ 5 a 10/mês estimado, só quando a fase for entregue

━━━━━━━━━━━━━━━━━━━━━━━━
⏰ 3) ESTIMATIVA DE HORAS RESTANTES
━━━━━━━━━━━━━━━━━━━━━━━━

Base: escopo do primeiro MVP (app do garçom + cozinha + publicação).
Já entregue: fundação, web de mesas/comandas (3 visualizações),
detalhamento com pagamento, cardápio, tempo real e 94 testes.

O que falta:

1. App Android (mapa, comandas, lançamento offline) ......... 110h
2. API de sincronização (push/pull, conflitos, idempotência)  30h
3. Tela de Cozinha (KDS) real com modo offline .............. 30h
4. Permissões (RBAC) completas nas rotas .................... 12h
5. Fechamento de comanda + regra de pagamento manual ........ 12h
6. CLI de instalação do restaurante (bootstrap) .............. 7h
7. Deploy no Hetzner (Docker + Coolify + health checks) ..... 25h
8. Backup, segurança e monitoramento ......................... 15h
9. Testes de aceitação (offline, 2 dispositivos, conflitos) .. 17h
10. Ajustes finais, acessibilidade e performance ............. 12h

TOTAL RESTANTE: ~270h (faixa: 240 a 300h)

Valor: R$ ____/h × 270h = R$ ____________

Observação: fases futuras (estoque, reservas, relatórios,
caixa/PIX, iFood, IA e iOS) ficam orçadas à parte.

━━━━━━━━━━━━━━━━━━━━━━━━
💰 4) RESUMO DO CUSTO FIXO
━━━━━━━━━━━━━━━━━━━━━━━━

Mês 1 (piloto): ~R$ 149/mês (≈ US$ 27)
  (Hetzner €5,99 + domínio R$3 + Claude Pro US$20)

Produção estável: ~R$ 156/mês
  (com backup diário +R$7)

Comparação: Fly.io no lugar do Hetzner = ~R$ 170/mês

Único (uma vez): Google Play Console US$ 25 (publicação do app)

Desenvolvimento: 270h × R$ ____/h = R$ ____________
```

---

## Notas internas (não enviar no WhatsApp)

- **Hetzner priorizado** conforme pedido; **Fly.io** ficou como alternativa
  no meio da mensagem (para quem não quer operar servidor). Detalhes em
  [`pesquisa-opcoes-baratas.md`](pesquisa-opcoes-baratas.md).
- **Localização do servidor:** escolher **Hetzner US (Ashburn)** para menor
  latência do Brasil (~100 ms); a Europa fica com ~200 ms.
- **Preço CX23:** € 5,99/mês já inclui IPv4 (preço pós-aumentos de 2026);
  variantes "cost-optimized" saem por ~€ 5,49. Backup = +20% (≈ €1,20).
- **Banco de dados:** com Hetzner, o PostgreSQL roda no próprio servidor
  (Docker) — não precisa de Neon. O backup diário cobre os dados.
- **Operação:** updates de segurança, restore ensaiado e monitoramento
  ficam com a equipe (item 8 das horas). Coolify automatiza deploy/SSL.
- **Custo:** sem contrato de fidelidade — cobrança por hora, cancela quando
  quiser; escala vertical trocando o plano em minutos.
- **Claude Pro** é a licença de desenvolvimento (quem programa). O item 10
  (API) é o custo do próprio sistema para a Fase 5 de importação com IA.
- **Horas** são estimativa de esforço com base no `docs/mvp-scope.md` e no
  que já está implementado (web completa de mesas/comandas, cardápio,
  realtime e testes; mobile e deploy ainda não iniciados).
- Detalhamento financeiro completo em [`orçamento.md`](orçamento.md).
