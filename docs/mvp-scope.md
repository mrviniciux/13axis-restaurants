# Recorte recomendado do primeiro MVP

**Status:** proposta de escopo, sujeita às decisões listadas em “Pontos em aberto”.  
**Base:** `specification.md`, especialmente as seções 1, 4–8, 14 e 16.

## 1. Objetivo

Entregar um primeiro fluxo ponta a ponta para **uma operação de restaurante**: o garçom consulta mesas e cardápio, abre uma comanda e lança itens no Android; a cozinha recebe e atualiza esses itens no KDS; as alterações são persistidas localmente e sincronizadas quando houver conectividade.

O recorte prioriza uma fatia operacional pequena, mas exercita as dependências críticas entre app Android, persistência local, API/PostgreSQL, sincronização e tempo real. Não equivale sozinho a um sistema completo de caixa: o ciclo de encerramento da comanda ainda depende de decisão explícita.

## 2. Atores e plataformas

| Ator | Plataforma no MVP | Responsabilidade |
|---|---|---|
| Administrador/gerente | Web | Acesso administrativo necessário ao MVP. O cadastro/edição de cardápio e mesas não está fechado neste recorte; ver pontos em aberto. |
| Garçom | Android | Consultar mesas e cardápio, abrir comanda e lançar itens, inclusive sem rede. |
| Cozinha | Web (KDS) | Consultar pedidos recebidos e avançar o status dos itens. O perfil também pode funcionar em mobile, mas isso não é necessário para o primeiro corte. |

**Fora dos perfis iniciais:** operador de balança e caixa. A especificação prevê esses papéis, mas seus fluxos não são necessários para validar a fatia recomendada.

## 3. Fluxo principal recomendado

1. Um usuário autorizado entra no sistema. O servidor aplica RBAC nas rotas e ações.
2. O Android recebe o conjunto necessário para trabalhar: perfil/permissões, cardápio e mesas, além das comandas ativas relevantes. Uma mesa pode ter múltiplas comandas abertas simultaneamente.
3. O garçom abre uma nova comanda na mesa desejada — sem impor configuração ou limite numérico de comandas por mesa nesta fase — e lança um ou mais itens. Cada escrita é gravada primeiro no SQLite local, com ID gerado no cliente, e refletida imediatamente na interface.
4. As mutações entram na fila local. Com rede, o Sync Engine as envia à API; sem rede, preserva-as e tenta novamente ao reconectar. A interface deve distinguir item pendente de sincronização de item já confirmado pelo servidor.
5. Após persistir uma mutação, o backend emite o evento de tempo real correspondente. O KDS recebe e apresenta pedido, mesa, itens, observações e tempo decorrido.
6. A cozinha avança os estados dos itens. Essas alterações também precisam ser gravadas localmente antes do envio e sincronizadas em background; o Android recebe as mudanças por evento e/ou pull.
7. Em reconexão, cada cliente envia pendências e busca alterações remotas, atualizando o snapshot local sem perder operações aceitas.

**Limite importante:** enquanto o cliente estiver sem rede, a cozinha em outro dispositivo não pode receber uma mutação ainda não enviada ao servidor. O app deve manter a operação local e comunicar claramente o estado pendente; não deve representar uma entrega à cozinha como confirmada antes da sincronização.

## 4. Entidades e dados essenciais

### Persistência canônica (PostgreSQL)

- `Restaurant`: um restaurante nesta fase; multi-restaurante/franquia permanece futuro.
- `User`: credenciais/perfil e permissões necessários a administrador/gerente, garçom e cozinha.
- `Table`: identificação e estado operacional da mesa.
- `MenuCategory` e `MenuItem`: categorias, dados essenciais do produto, preço e disponibilidade para consulta e lançamento.
- `Order` e `OrderItem`: mesa, garçom, timestamps, quantidades, preço aplicado, variações/observações quando suportadas e estado do item.

### Estado local de cada cliente

- Android: espelho do cardápio, mesas, perfil/permissões e comandas abertas relevantes; SQLite e `mutation_queue`.
- Web/KDS: dados necessários à tela de cozinha e fila local para as alterações de status que o KDS realizar. O armazenamento e a sincronização web são descritos na especificação como IndexedDB/Dexie e Web Worker.
- A fila local é infraestrutura de sincronização, não uma entidade de negócio. Deve manter identificação da mutação, entidade/operação, payload, estado, tentativas e data de criação, conforme seção 7.3.

### Metadados e integridade de sincronização

Usar UUID v7 gerado no cliente; `createdAt`/`updatedAt` em UTC; versionamento das entidades mutáveis; `deviceId` e informação de última sincronização conforme seções 6.2–6.3. Retentativas precisam ser idempotentes para que reenviar uma mutação após timeout não duplique o pedido ou o item. A especificação descreve igualdade de versão como idempotente, mas a chave/contrato de idempotência ainda deve ser definida.

`Payment`, `CashRegister`, `Reservation`, `InventoryItem`, `StockMovement`, `Supplier`, `Shift`, composição de cardápio e entidades de importação não são necessárias ao fluxo principal recomendado e ficam fora do primeiro corte, ressalvados os bloqueios de ciclo operacional abaixo.

## 5. Requisitos e regras do recorte

### Incluídos

- Autenticação e perfis/permissões necessários ao recorte (seções 4.1–4.2 e Fase 1).
- CLI interativo de bootstrap que solicita o nome do restaurante e a senha do primeiro usuário `ADMIN`; cria restaurante e administrador atomicamente e armazena a senha somente como hash Argon2id. Não há credenciais padrão (decisão do usuário; complementa as seções 4 e 14).
- Consulta de mapa/estado de mesas, abertura de comanda e lançamento de produtos pelo Android (seção 5.1 e Fase 2).
- Múltiplas comandas abertas na mesma mesa, sem configuração de cardinalidade e sem limite numérico definido nesta fase (decisão do usuário; seção 5.1 da especificação admite uma ou múltiplas comandas).
- Edição/exclusão de item **antes do envio à cozinha** (seção 5.1); regras para alterações posteriores devem ser definidas antes de serem habilitadas.
- KDS com pedido, mesa, itens, observações e tempo decorrido; atualização de estado por item (seção 5.3).
- SQLite no Android, IndexedDB no web dentro do escopo de escrita do KDS, fila de mutações, push/pull, retry com backoff exponencial e atualização em background (seções 7.1–7.3).
- Sincronização do menu, mesas e comandas ativas conforme o escopo local da seção 7.5.
- Socket.IO para notificar pedido/item/estado e mudanças de mesa; reconexão e ressincronização após perda de conexão (seções 8.1–8.3).
- Validação no backend com schemas compartilhados; o servidor permanece fonte canônica e valida regras críticas antes de aplicar mutações (seções 2.3, 3.3 e 7.4).
- Um restaurante nesta fase; não entregar iOS, franquias ou multi-restaurante (seções 1 e 16).

### Fora do primeiro corte recomendado

- Pagamentos/gateways, caixa, conferência, sangria/suprimento, recibo e fechamento financeiro; isso está na Fase 4 e seção 5.6. **A ausência de encerramento de comanda e liberação da mesa é um bloqueio para considerar o MVP uma operação completa**, não apenas uma fatia de pedidos/cozinha.
- Divisão de conta e transferência de mesa/itens (seção 5.1).
- Reservas/lista de espera e estado “reservada” (seção 5.4).
- Estoque, fornecedores, composição e baixa automática (seção 5.5).
- Gestão completa de cardápio, variantes/adicionais e horários de disponibilidade; reservas, funcionários, relatórios e importação com IA (seções 5.2 e 5.7–5.9).
- iFood, pagamentos externos, Claude, impressão fiscal/NFC-e, relatórios avançados, app iOS e multi-restaurante (seções 9–10 e 16).
- Refinamentos gerais de PWA, OTA, monitoramento e auditoria WCAG; requisitos essenciais de acessibilidade e armazenamento local não devem ser interpretados como adiados (seções 11 e 14).

## 6. Regras de negócio e exceções a preservar

1. **Escrita local-first:** uma falha de rede não pode bloquear a criação local de uma comanda/itens nem a atualização local de estado do KDS. A sincronização é eventual, com fila persistente e retry; erros permanentes devem continuar visíveis para tratamento, não ser descartados (seções 1.2 e 7.1–7.3).
2. **Conflitos:** aplicar a política LWW/versionamento descrita na seção 7.4 para atualizações concorrentes; rejeitar versão antiga retornando o estado atual. Adições de itens são operações aditivas e não devem apagar itens lançados por outro dispositivo. Fechamento exclusivo só pode ser implementado após sua regra estar definida.
3. **Servidor valida:** permissões e regras críticas são verificadas no servidor, inclusive quando a ação foi enfileirada offline e é sincronizada posteriormente (seções 4.2 e 7.4).
4. **Tempo real não substitui sync:** eventos Socket.IO aceleram a propagação; reconectar ou perder um evento exige pull/ressincronização para convergir ao estado persistido (seções 7.2–7.3 e 8).
5. **Dados locais limitados:** não baixar o banco inteiro. O Android mantém apenas o necessário para operar; comandas fechadas não são incluídas no espelho (seção 7.5).
6. **Estados precisam de reconciliação:** a seção 5.1 cita `enviado` → `em preparo` → `pronto` → `servido`; a seção 5.3 descreve, por item, `novo` → `preparando` → `pronto`. Não consolidar esses vocabulários nem atribuir o estado “servido” a um ator sem decisão de produto.

## 7. Dependências entre componentes

| Dependência | Necessidade no MVP |
|---|---|
| `packages/shared` | Tipos, schemas Zod, regras de domínio e contrato comum de mutações/eventos para web, Android e API. |
| `packages/database` / Prisma / PostgreSQL | Schema, migrations e persistência canônica de usuários, mesas, cardápio, comandas e itens. |
| API REST (`/api/sync/push`, `/api/sync/pull`) | Receber mutações em lote, validar autorização/versão, persistir de forma idempotente e devolver alterações/estado canônico. |
| Android | Expo/React Native, SQLite e Sync Engine; o app deve abrir e operar com dados previamente sincronizados mesmo durante indisponibilidade da rede. |
| Web/KDS | Tela de cozinha, armazenamento local da fila de atualização de itens e sincronização após reconexão. |
| `apps/realtime` | Socket.IO separado, eventos de pedido/item/mesa e reconexão; Redis Adapter só é necessário se houver múltiplas instâncias. |
| Autenticação e RBAC | Sessões/credenciais e autorização por ação para gerente, garçom e cozinha. A autorização de mutações acumuladas offline precisa ser revalidada ao sincronizar. |
| Provisionamento inicial | CLI interativo solicita o nome do restaurante e a senha do primeiro `ADMIN`, criando ambos atomicamente; a senha é lida interativamente e armazenada como hash Argon2id. Não existem credenciais padrão. A disponibilização inicial de mesas e catálogo ainda depende de decisão. |

## 8. Critérios verificáveis de aceitação

1. **Operação Android offline:** após uma primeira carga válida, ativar modo avião; abrir mesa/comanda e adicionar itens; confirmar que a UI responde e que, após encerrar/reabrir o app, as mutações ainda estão na fila local.
2. **Envio após reconexão:** reativar rede; verificar que cada mutação pendente é persistida no servidor uma única vez, que a fila avança para sincronizada e que o retry não duplica comanda nem item.
3. **Convergência em dois dispositivos:** dois dispositivos adicionam itens à mesma comanda; após sincronização, ambos e o servidor mostram todos os itens, sem sobrescrita por conflito.
4. **Cozinha em tempo real:** com conectividade, um item enviado pelo Android aparece no KDS com mesa e dados corretos; avanço de status no KDS é persistido e refletido no Android.
5. **Recuperação de evento perdido:** desconectar um cliente ou interromper WebSocket, realizar mutações no outro e reconectar; pull/sync deve convergir ao estado do servidor mesmo sem replay do evento.
6. **KDS sem rede:** com a tela já preparada para operação offline, atualizar estado de item sem conectividade; manter a atualização local/fila e sincronizá-la após reconexão. O produto não deve afirmar que outros dispositivos receberam a atualização enquanto ela estiver pendente.
7. **Autorização:** testar cada ação do recorte com papel autorizado e não autorizado; negar no servidor as ações fora do RBAC mesmo que a requisição seja enviada diretamente ou tenha sido enfileirada offline.
8. **Conflito de versão:** aplicar uma atualização antiga contra uma versão mais recente; a API rejeita a versão obsoleta e devolve o estado canônico, que passa a prevalecer no cliente.
9. **Escopo de dados:** verificar que o dispositivo recebe cardápio, mesas e comandas ativas necessárias, sem baixar comandas fechadas nem o banco completo.
10. **Desempenho/alvo:** validar resposta local-first sem espera de rede e medir a meta de 60 fps para listas mobile em dispositivo de referência acordado; a especificação não determina dispositivo, volume de dados nem protocolo de benchmark.
11. **Bootstrap seguro:** executar o CLI e verificar que solicita interativamente nome do restaurante e senha do primeiro `ADMIN`, cria os dois registros em uma única transação (falha não deixa criação parcial), persiste apenas o hash Argon2id da senha e não oferece nem cria credenciais padrão.

## 9. Pontos em aberto e decisões necessárias

| Prioridade | Lacuna/conflito na especificação | Decisão ou opção recomendada |
|---|---|---|
| **Bloqueador para operação completa** | O recorte de pedidos não define como encerrar comanda e liberar/reutilizar mesa sem pagamento. Pagamentos/caixa estão na Fase 4; comanda fechada é exclusiva na seção 7.4. | Decidir entre (A) classificar a primeira entrega como piloto técnico de pedidos/cozinha, sem ciclo comercial completo, ou (B) antecipar à Fase 2 um fechamento manual e registro de pagamento sem gateway. A opção B torna o fluxo mais operacional, mas antecipa regras financeiras e requer especificar pagamento offline/conflitos. Não implementar fechamento implícito. |
| **Bloqueador de fluxo** | Estados e responsáveis por pedido/item divergem entre seções 5.1 e 5.3; “servido” não aparece no fluxo KDS da seção 5.3. | Definir máquina de estados canônica, quais estados são por pedido versus item e quem marca “servido”. |
| **Bloqueador de entrada de dados** | Cardápio e mesas são necessários no uso, mas CRUD completo está na Fase 3; o bootstrap do restaurante e do primeiro `ADMIN` está resolvido, mas a carga inicial de mesas e catálogo ainda não foi especificada. | Definir se haverá CRUD mínimo antes do piloto ou carga inicial controlada. Se escolher carga, definir responsável, formato e como corrigir dados sem acesso direto ao banco. |
| **Offline web** | A seção 1.1 promete PWA/offline e 7.3 descreve Service Worker, IndexedDB e Web Worker; a seção 14 deixa o PWA do web para a Fase 6. | Recomenda-se incluir agora a persistência/fila offline do KDS e o mínimo de cache necessário para retomada, adiando refinamento PWA. Confirmar se essa antecipação é aceita; adiar toda escrita offline web conflita com o princípio local-first das seções 1.2 e 7.1. |
| Alta | Login e expiração de sessão durante indisponibilidade não estão definidos. | Definir se um usuário previamente autenticado pode continuar offline, por quanto tempo e como credenciais/permissões são atualizadas. |
| Alta | Menu/mesa podem ficar desatualizados durante operação offline; política de disponibilidade de produto e mesa reservada não está definida no recorte. | Definir validade do snapshot, sinalização de dado potencialmente desatualizado e comportamento para item desativado/mesa ocupada recebido pelo servidor. |
| Alta | A idempotência, o ordenamento de mutações e o tratamento de falha permanente não estão suficientemente contratados. | Definir identificador estável da mutação, resposta por item do batch, erros retentáveis/não retentáveis e recuperação manual sem perda/duplicação. |
| Média | O limite de dispositivos simultâneos Socket.IO está aberto na seção 16; a estratégia de backup também. | Registrar limites operacionais e política de backup antes de produção; não bloqueiam um MVP local/piloto, mas são condições de implantação. |
| Média | WCAG 2.1 AA é alvo explícito (seção 11), mas os critérios de desempenho de 60 fps (seção 1.2) não especificam ambiente de teste. | Acordar dispositivos/navegadores de referência e conjunto mínimo de verificações de acessibilidade e desempenho. |

## 10. Relação com o roadmap

- **Mantém como base a Fase 1:** monorepo, schema/migrations/PostgreSQL, autenticação/perfis, estrutura web/mobile e `packages/shared`.
- **Entrega a fatia essencial da Fase 2:** mapa de mesas, abertura de comanda, lançamento de produtos, persistência/sync Android, eventos Socket.IO e KDS.
- **Traz apenas preparação mínima de dados da Fase 3:** necessária para iniciar a operação; a forma de provisionar ainda depende de decisão.
- **Não assume as Fases 3–6 completas.** Se for aprovado fechamento manual, antecipa somente esse recorte da Fase 4, explicitamente sem gateways e sem caixa completo.

## 11. Referências da especificação

- **§1.1–1.2:** objetivo, plataformas e princípio local-first.
- **§2–3:** arquitetura, componentes e stack.
- **§4.1–4.2:** atores e RBAC.
- **§5.1–5.3:** mesas/comandas, cardápio, pedidos e cozinha.
- **§5.6:** pagamentos e caixa, relevante ao bloqueio de encerramento.
- **§6.1–6.3:** entidades, IDs e versionamento.
- **§7.1–7.5:** escrita offline, fila, sync, conflitos e dados locais.
- **§8.1–8.3:** Socket.IO e eventos.
- **§11:** acessibilidade.
- **§14:** fases e ordem do roadmap.
- **§16:** decisões futuras e pontos abertos.
