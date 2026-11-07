# Estimativa — Mudra for Restaurants

Dois blocos: um com a estimativa para equipe de IA (enviar), outro com a
estimativa original de horas humanas (referência interna).

---

## BLOCO 1 — Para WhatsApp (equipe de IA)

```
ESTIMATIVA — Mudra for Restaurants (equipe de IA)
Data: 08/11/2026

━━━━━━━━━━━━━━━━━━━━━━━━
✅ O QUE JÁ ESTÁ PRONTO
━━━━━━━━━━━━━━━━━━━━━━━━

Web back-office completo:
• Gestão de mesas e comandas (4 visualizações)
• Lançamento, edição e exclusão de itens
• Pagamentos (dinheiro, cartão, PIX manual)
• Cardápio + produtos de buffet + KDS
• Cadastro de clientes vinculado à comanda
• Tempo real (WebSocket) entre dispositivos
• Autenticação com perfis de acesso
• Banco de dados, migrations, 94 testes

━━━━━━━━━━━━━━━━━━━━━━━━
⏳ O QUE FALTA
━━━━━━━━━━━━━━━━━━━━━━━━

Trabalhando com IA como desenvolvedor principal,
o que muda é a unidade de medida: não é hora de
programador humano — é sessão de trabalho + revisão.

� Estimativa em semanas de calendário:

Módulo                          Semanas
──────────────────────────────────────
App Android (garçom/balança)      3–4
API sync offline + conflitos        1
KDS real (WebSocket + som)          1
🤖 Módulo IA (importação Claude)   1–2
Estoque e inventário                1
Reservas                            1
Caixa + gateways (MP/Stripe/Pix)  1–2
Relatórios + exportação             1
Funcionários + escala               1
Deploy (Hetzner + Coolify + CI)     1
PWA offline (web)                   1
Testes de aceitação + ajustes       1
──────────────────────────────────────
TOTAL: 14 a 17 semanas de calendário
(trabalhando ~4–5h/dia com IA)

━━━━━━━━━━━━━━━━━━━━━━━━
💰 CUSTO COM IA
━━━━━━━━━━━━━━━━━━━━━━━━

Ferramenta de IA (ex.: Claude Max):
US$ 100/mês ≈ R$ 550/mês

4 meses de desenvolvimento:
~R$ 2.200 em licença de IA

Infraestrutura mensal em produção:
~R$ 50–75/mês (Hetzner + domínio + SSL)

━━━━━━━━━━━━━━━━━━━━━━━━
⚡ COMPARATIVO
━━━━━━━━━━━━━━━━━━━━━━━━

Equipe humana tradicional:
418h × R$ ____/h = R$ ____________

Equipe de IA:
~4 meses × R$ ____/mês = R$ ____________
+ R$ 2.200 de ferramentas

Ganho de velocidade estimado: 3–5×
(IA escreve código, humano revisa e decide)

Obs: o módulo de IA (importação com Claude)
usa também a API da Anthropic em produção:
US$ 5–15/mês ≈ R$ 28–83/mês no uso real.
```

---

## BLOCO 2 — Referência interna (horas humanas equivalentes)

```
ESTIMATIVA EQUIVALENTE EM HORAS HUMANAS
(referência para precificação ou contrato misto)

📱 App Android .......................... 110h
� API sync offline ...................... 30h
🍽️ KDS real .............................. 25h
🤖 Módulo IA (importação Claude) ......... 35h
📦 Estoque e inventário .................. 30h
📅 Reservas .............................. 20h
� Caixa + gateways ...................... 35h
📊 Relatórios ............................ 25h
👥 Funcionários + escala ................. 18h
🔐 RBAC completo ......................... 12h
🌐 PWA offline ........................... 20h
🚀 Deploy Hetzner + Coolify .............. 25h
🧪 Testes de aceitação ................... 18h
✨ Ajustes finais ......................... 15h
────────────────────────────────────────
TOTAL: ~418h
Faixa: 380h a 460h
```

---

## Notas internas

### Como a IA muda a equação de tempo

A IA não elimina horas — ela comprime o **tempo de execução** mas não reduz
o **tempo de decisão**. Em termos práticos:

| O que a IA faz rápido | O que ainda exige humano |
|---|---|
| Escrever código de CRUD, rotas, componentes | Definir regras de negócio ("o que acontece quando...") |
| Criar testes unitários | Testar no device real (tablet do restaurante) |
| Refatorar e corrigir bugs comuns | Validar UX com o usuário final |
| Gerar CSS, estilos, layout | Decisões de produto (prioridade de funcionalidades) |
| Documentar | Revisar e aprovar cada entrega |
| Migrations e schemas | Definir o modelo de dados do negócio |

O risco principal não é velocidade — é **contexto perdido**. Uma sessão de IA
por dia exige que você releia o que foi feito antes de continuar. Isso é
gerenciável com uma boa especificação (que já temos) e commits frequentes.

### Fator de aceleração real observado neste projeto

No que foi feito até aqui (~150h equivalentes humanas), o tempo de calendário
foi de ~3 semanas trabalhando com IA em sessões de 3–5h. Isso dá um fator de
aceleração de ~2,5–3× em relação a um desenvolvedor humano solo.

Projetando para as 418h restantes com o mesmo fator: **~140–170h de calendário**
(ou ~4 meses trabalhando 1–2h/dia, ou ~2 meses trabalhando em ritmo mais intenso).

### Sobre o módulo de IA especificamente (35h equivalentes / ~1–2 semanas)

É o módulo com maior incerteza porque depende de:
1. Qualidade do prompt engineering para extrair estrutura de PDFs escaneados
2. Comportamento do Claude em arquivos com dados sujos
3. UI de preview (validação interativa antes de confirmar inserção)

A faixa de 1–2 semanas reflete isso: se o escopo for só CSV/XLSX/JSON (sem PDF),
1 semana é suficiente. Com PDF, 2 semanas pela iteração de prompt.
