# 13axis Web

Fundação do back-office desktop e do destino inicial de Kitchen Display. O aplicativo usa Next.js App Router, React, TypeScript, Tailwind CSS e componentes acessíveis com ícones Lucide.

## Comandos

Execute no diretório `apps/web` ou via filtro pnpm na raiz:

```powershell
pnpm --filter @13axis/web dev
pnpm --filter @13axis/web lint
pnpm --filter @13axis/web typecheck
pnpm --filter @13axis/web test
pnpm --filter @13axis/web build
```

## Escopo atual

- `/` apresenta uma visão geral navegável, com indicadores e pedidos de exemplo explicitamente identificados como demonstração.
- `/kitchen` mostra apenas uma prévia estática e explícita do KDS; `/menu`, `/tables`, `/inventory`, `/reservations`, `/cash`, `/staff` e `/reports` são destinos de navegação marcados como não implementados.
- O exemplo da cozinha mostra duas comandas distintas para a Mesa 08. O MVP admite múltiplas comandas abertas na mesma mesa, sem configuração de cardinalidade nesta fase.
- Não há login, autorização, API, persistência, sincronização ou modo offline implementados nesta fundação.
- `@13axis/shared` é um peer opcional do workspace. Esta fundação não o importa porque ainda não precisa de tipos ou lógica de domínio compartilhados.
