# Contratos de tempo real — primeiro MVP

**Status:** contrato de trabalho para a fatia inicial de pedidos/cozinha; não substitui decisões de produto ainda em aberto.  
**Base normativa:** `specification.md`, em especial as seções 4–8, 10, 14 e 16, e o recorte `docs/mvp-scope.md`.  
**Escopo:** Android (garçom), web/KDS (cozinha), API REST/sync e `apps/realtime` Socket.IO para um restaurante. Pagamentos, iFood e Claude não fazem parte do fluxo operacional deste primeiro MVP.

## 1. Como ler este documento

As marcações distinguem o que a especificação já determina de propostas para tornar o contrato implementável:

- **[Spec]** decisão explícita em `specification.md` ou no recorte atual do MVP.
- **[Contrato proposto]** detalhe concreto necessário para coordenar API, realtime, web e mobile; deve ser confirmado antes de congelar os tipos compartilhados.
- **[Recomendação]** prática técnica fundamentada nas fontes ao final. Não é uma decisão já tomada pela especificação.

Socket.IO é um canal de notificação e propagação, não a fonte canônica dos dados. PostgreSQL/API e os protocolos de push/pull da sincronização permanecem autoritativos.

## 2. Escopo funcional e direção

**[Spec]** `apps/realtime` é um processo Node.js standalone com Socket.IO; a API Next.js persiste mutações e emite eventos após processá-las. Socket.IO foi escolhido por rooms, reconexão automática e fallback para long-polling; Redis Adapter é previsto para múltiplas instâncias.

**[Contrato proposto]**

1. Eventos de domínio listados abaixo são **server → clients**. Clientes não alteram comandas, itens, mesas ou cardápio emitindo eventos Socket.IO.
2. Escritas online e offline usam os handlers REST/sync autenticados. O KDS também enfileira alterações offline e as sincroniza pela API.
3. O servidor só publica notificações após a mutação canônica ser validada e persistida. O cliente aplica o evento como atualização/referência e reconcilia com o snapshot da API quando necessário.
4. Não emitir evento de sucesso para mutação ainda pendente no dispositivo, rejeitada ou não persistida. Um item criado offline não chegou à cozinha até ser aceito pelo servidor.
5. Os eventos deste documento cobrem a fatia operacional do MVP, não todo o inventário de eventos da especificação. `payment:processed` e o fluxo de fechamento dependem de decisões/entregas futuras.

## 3. Rooms e audiência

| Room | Ingresso autorizado | Uso no MVP |
|---|---|---|
| `restaurant:<restaurantId>` | Qualquer conexão autenticada que pertença ao restaurante e tenha acesso aos dados operacionais do MVP. O ingresso é feito exclusivamente pelo servidor. | Estado compartilhado de comandas, itens, mesas e cardápio. |
| `restaurant:<restaurantId>:kitchen` | Além do room principal, somente perfil `KITCHEN` autorizado. | Assinatura específica do KDS; usar para eventos destinados apenas à cozinha se a audiência for reduzida no futuro. |

- **[Spec]** Os nomes dos dois rooms acima são os definidos pela especificação.
- **[Contrato proposto]** Um socket de cozinha entra nos dois rooms para receber tanto eventos gerais quanto os específicos do KDS. Não há rooms independentes de usuário, garçom ou gerente definidos para o MVP.
- O servidor deriva `restaurantId`, perfil e permissões da identidade validada. Nunca usa um `restaurantId` do cliente para decidir o room, nem aceita nomes de room enviados pelo cliente.
- Ao encerrar sessão/conexão, o Socket.IO remove o socket dos rooms. Para mudança de perfil/restaurante, desconectar/reautenticar e recalcular as assinaturas; não manter uma autorização antiga em uma conexão reutilizada.
- **[Lacuna]** A especificação considera um restaurante nesta fase, mas prepara `restaurantId` para multi-tenant futuro. Não define vínculo de usuário com restaurante nem autorização para múltiplos restaurantes; isso deve ser resolvido no domínio de autenticação, não inferido pelo nome da room.

Rooms são mecanismo de fan-out, não controle de acesso por si só. A autorização deve ser aplicada antes de qualquer `join` e na emissão do evento. Socket.IO mantém rooms do lado servidor [Rooms](https://socket.io/docs/v4/rooms/).

## 4. Autenticação e autorização

### 4.1 Conexão

**[Spec]** Auth.js v5/JWT é a escolha de autenticação geral; RBAC deve ser verificado no backend. Perfis relevantes nesta fatia: `WAITER` e `KITCHEN`, mais `ADMIN`/`MANAGER` quando habilitados para as telas operacionais. `KITCHEN` visualiza pedidos e atualiza estado de itens.

**[Contrato proposto]**

- O cliente envia a credencial de sessão/token no campo Socket.IO `auth` do handshake, nunca em query string, URL, payload de evento de domínio ou log.
- O serviço realtime valida assinatura, emissor/audiência, expiração, usuário ativo e claims necessários usando a configuração compartilhada com o backend; não confia em claims não verificadas. O formato exato de token, chave/verificador e política de renovação são **lacunas a confirmar** com Auth.js/API.
- Middleware de conexão rejeita sessão inválida/expirada e não cria rooms; após validar identidade e RBAC, o handler servidor calcula os rooms permitidos e então faz o `join`.
- Para ações de escrita, a API revalida sessão, perfil, permissão e pertença à comanda/restaurante no momento de processar a operação. Estar em um room não autoriza chamada REST.
- Se a credencial expirar durante a conexão, a política recomendada é exigir renovação autenticada e reconexão; não confiar em sessão recuperada sem nova validação. Definir duração, renovação, revogação e uso offline antes de produção.
- Rejeições de conexão devem ser genéricas (`connect_error` não autenticado/não autorizado), sem revelar existência de usuário, detalhes de credencial ou dados internos.

Socket.IO executa middleware por conexão e oferece `socket.handshake.auth` para credenciais; erros de middleware chegam ao cliente como `connect_error` [Middlewares](https://socket.io/docs/v4/middlewares/). Como a autenticação de middleware pode acontecer somente no handshake, handlers de mutação HTTP continuam responsáveis pela autorização em cada operação.

### 4.2 Perfil e ações

| Ação | Perfil mínimo descrito pela spec | Limite deste contrato |
|---|---|---|
| Receber atualizações de mesas/comandas e abrir/lancar itens por API | `WAITER` | A permissão exata de leitura e os limites entre dados de todos os garçons ainda devem ser definidos. |
| Receber pedidos no KDS | `KITCHEN` | A assinatura KDS é por restaurante; sem filtro por estação/categoria no MVP. |
| Atualizar status de item via API | `KITCHEN` | A API valida a transição permitida e estado atual; máquina de estados ainda precisa de decisão de produto. |
| Alterar cardápio/mesas | `ADMIN`/`MANAGER` conforme RBAC | CRUD completo de cardápio/mesas não está fechado no recorte. |

O perfil não explicitamente autorizado não recebe room nem pode executar a ação correspondente. A tabela é um limite inicial, não uma matriz RBAC completa: a especificação tem discrepâncias para `CASHIER` e não define permissões de `BALANÇA`.

## 5. Envelope e regras de payload

### 5.1 Envelope comum

**[Spec]** Os payloads mínimos publicados na seção 8.2 são os listados na tabela de eventos da seção 6.

**[Recomendação / proposta de contrato]** Em vez de aumentar payloads de domínio sem versionamento, encapsular cada notificação em um envelope uniforme:

```json
{
  "eventId": "uuid-v7",
  "schemaVersion": 1,
  "restaurantId": "uuid",
  "occurredAt": "2026-01-01T12:00:00.000Z",
  "aggregate": {
    "type": "order",
    "id": "uuid",
    "version": 4
  },
  "mutationId": "uuid",
  "data": {}
}
```

- `eventId`: identidade estável para deduplicação de entrega/processamento; uma retransmissão do mesmo fato preserva o ID.
- `schemaVersion`: versão do formato do evento, diferente da versão da entidade.
- `restaurantId`: contexto validável de tenant; o cliente deve descartar evento para outro restaurante.
- `occurredAt`: horário UTC de emissão do fato persistido, não horário local do device.
- `aggregate`: entidade cuja versão foi alterada. O uso de `version` se apoia no versionamento de entidades da seção 6.3 da spec.
- `mutationId`: ID estável da mutação de origem, quando houver (por exemplo, mutação sincronizada do cliente); ausente para alterações originadas por operações que ainda não usam essa fila.
- `data`: conteúdo específico do evento.

O envelope e estes metadados **não aparecem no contrato original da seção 8.2** e precisam ser aprovados por `packages/shared`, API, web e Android. Campos de dados devem ser mínimos, serializáveis em JSON, validados por schema compartilhado e sem segredos/dados de pagamento.

### 5.2 Payloads por evento

As propriedades marcadas como **mínimo da spec** preservam o shape documentado; as demais são proposta para completar a sincronização. Os exemplos abaixo mostram apenas `data`, dentro do envelope comum.

| Evento server → client | Destino lógico | Payload mínimo explícito na spec | Forma proposta para `data` no MVP |
|---|---|---|---|
| `order:created` | Room do restaurante | `{ orderId, tableId }` — todos. | `{ orderId, tableId }` |
| `order:item:added` | Room do restaurante (garçons/dispositivos autorizados e KDS) | `{ orderId, item }` — cozinha + dispositivos. | `{ orderId, tableId, item }`. `item` deve ser o DTO canônico persistido, incluindo `id`, referência ao produto, quantidade, preço aplicado, observações e estado somente se esses campos existirem no modelo vigente. |
| `order:item:status` | Room do restaurante; pode também ser direcionado à room de cozinha conforme audiência aprovada | `{ orderId, itemId, status }` — cozinha + garçom. | `{ orderId, itemId, status }`. `status` é enum validado da máquina de estados definida pelo domínio; não criar estado novo neste contrato. |
| `order:updated` | Room do restaurante | `{ orderId, changes }` — todos. | `{ orderId, changes }`, onde `changes` contém somente campos permitidos/serializáveis. Recomenda-se incluir a nova versão no envelope e usar mudanças tipadas, não patch arbitrário vindo do cliente. |
| `table:status` | Room do restaurante | `{ tableId, status }` — todos. | `{ tableId, status }`; `status` limitado ao enum de mesa aceito pelo domínio. |
| `menu:updated` | Room do restaurante, para clientes que consomem cardápio | `{ itemId, changes }` — garçons. | `{ itemId, changes }`; publicar somente campos necessários à consulta/operação offline. |
| `order:closed` | — | `{ orderId, tableId }` — todos. | **Não habilitar no primeiro MVP** até decisão sobre fechamento, pagamento e liberação de mesa. Se aprovado depois, preservar o nome e payload da spec e versionar extensões. |
| `payment:processed` | — | `{ orderId, amount, method }` — gerente. | **Fora do primeiro MVP.** Só publicar após estado do pagamento persistido/confirmado por fluxo de pagamento definido; nunca enviar credenciais, tokens ou dados de cartão. |

#### Regras de compatibilidade

- **[Contrato proposto]** `status` de pedido/item/mesa não pode ser inferido livremente pelo consumidor. A especificação diverge: 5.1 cita `enviado → em preparo → pronto → servido`, enquanto 5.3 descreve por item `novo → preparando → pronto`. O produto deve consolidar máquina de estados, transições, ator autorizado e vocabulário antes de ativar `order:item:status`.
- `order:item:added` representa item aceito e persistido pelo servidor, não apenas uma linha otimista na tela local.
- Eventos carregam identificadores e DTOs para permitir atualização eficiente, mas não garantem que o cliente possua todos os dados associados. Se faltar uma entidade ou houver versão fora de sequência, consultar pull/snapshot da API.
- Cliente deve ignorar campos desconhecidos compatíveis, mas rejeitar payload inválido ou `schemaVersion` incompatível sem corromper o espelho local; reportar erro e fazer pull.
- `changes` não deve ser objeto irrestrito: schemas compartilhados devem allow-list de campos por evento e rejeitar excesso/tipos inesperados.

## 6. Idempotência, duplicatas e ordem

### 6.1 Escritas (API/sync)

**[Spec]** O app gera UUID v7 para entidades, mantém fila local persistente e retenta com backoff exponencial (1, 2, 4, 8 s, máximo 60 s). A mesma mutação não pode criar entidade duplicada. A seção 7.4 propõe LWW com `version`, mas a igualdade de versão é idempotente apenas se conteúdo for equivalente; payload divergente com mesma versão não foi definido.

**[Contrato proposto / recomendação]**

1. Cada item de mutação da fila tem `mutationId` imutável, gerado uma vez no cliente e reutilizado em todas as tentativas. A identidade da entidade (`orderId`, `itemId`) permanece estável.
2. `POST /api/sync/push` deve processar atomicamente (por mutação) a validação, alteração canônica e registro de resultado/idempotência. Repetir `mutationId` com mesmo conteúdo devolve o resultado original/canônico sem novo efeito; reusá-lo com conteúdo diferente é erro de conflito, não uma nova mutação.
3. O servidor deve proteger também invariantes do domínio e operações concorrentes (ex.: duas aberturas para mesa), pois deduplicar ID de cliente não impede duas intenções com IDs diferentes.
4. Para atualização de estado, comparar versão no servidor. Versão antiga é rejeitada com estado canônico conforme 7.4. Mesma versão e payload diferente deve gerar conflito explícito; não aplicar LWW por timestamp local.
5. Adição de itens distintos é aditiva e não pode sobrescrever itens de outro dispositivo. As garantias de uma comanda aberta por mesa e política para múltiplas comandas ainda dependem de decisão do produto.

### 6.2 Eventos (Socket.IO)

Socket.IO garante ordem de mensagens em uma conexão, mas por padrão entrega **no máximo uma vez**: eventos podem não chegar quando há desconexão e o servidor não os guarda para clientes ausentes [Delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/). Logo:

- Consumidores deduplicam por `eventId` quando repetição puder ocorrer e acompanham versão do agregado. Evento com versão já aplicada pode ser ignorado; lacuna de versão exige pull, não aplicação cega do patch.
- Emissão duplicada nunca deve produzir efeito de negócio: eventos notificam; não criam pagamentos, itens ou mutações no backend.
- **[Recomendação]** Para não perder a janela entre commit do PostgreSQL e `emit`, gravar evento/outbox na mesma transação da mutação e publicar após commit, com retry do publisher. A spec apenas diz que API emite via cliente Socket.IO; não especifica outbox/durabilidade.
- Outbox e deduplicação no consumidor são garantias da aplicação, não propriedades que Redis Adapter ou Socket.IO adicionam automaticamente.

## 7. Relação com API e sincronização offline-first

### 7.1 Fluxo de mutação online/offline

1. Cliente grava otimisticamente no SQLite/IndexedDB, atribui IDs estáveis e enfileira a mutação.
2. Sync Engine envia mutações à API autenticada; nome documentado na seção 7.3 é `POST /api/sync/push`. A seção 7.2 também cita `POST /api/sync`; confirmar endpoint canônico antes da implementação.
3. API valida schema, sessão, RBAC, restaurante, regras de domínio, versão e idempotência; persiste no PostgreSQL e confirma o resultado por mutação.
4. Depois do commit, API/publisher emite evento ao Socket.IO. O cliente online aplica a notificação; demais clientes atualizam o espelho.
5. API oferece pull para reconciliação, descrito como `GET /api/sync/pull?since=<lastSyncedAt>`. O formato, paginação/cursor e retenção não estão definidos.
6. Timeout da resposta HTTP mantém a mutação na fila para retry com o mesmo `mutationId`. Se servidor confirmou mas o evento não chegou, pull reconcilia. Não tentar “re-enviar pelo Socket.IO”.

**[Recomendação]** API REST individual e lote sync devem usar a mesma camada de domínio/idempotência para que duas rotas não emitam efeitos divergentes. A identidade e perfil são revalidados no servidor ao aceitar também mutações que ficaram offline; autorização local não é concessão permanente.

### 7.2 Papel do evento

- É um sinal de que existe uma alteração canônica e um meio de reduzir latência entre dispositivos.
- Não substitui pull após reconexão, consulta inicial do KDS, atualização de snapshot, processamento da fila ou confirmação da API.
- Não é log durável nem ACK de sincronização da mutação do cliente. A confirmação de sync é a resposta da API, não a recepção do evento.
- Dados locais não incluem comandas fechadas segundo a seção 7.5; política para estado de mesa/menu desatualizado deve seguir regras de produto ainda pendentes.
- Se payload não tiver o bastante para materializar estado corretamente, buscar versão atual da entidade via API/pull.

## 8. Reconexão, fallback e Redis Adapter

### 8.1 Reconexão do cliente

**[Spec]** reconexão automática é essencial para Wi‑Fi instável; fallback de transporte long-polling se WebSocket falhar.

**[Recomendação]**

- Manter polling habilitado como fallback; restringir transportes só após validar os ambientes web e React Native. “Socket conectado” e “API acessível” devem ser estados distintos na interface.
- Após cada reconexão, o cliente autentica/revalida, reentra nos rooms autorizados e executa pull usando cursor/`lastSyncedAt`. Não presumir que eventos perdidos foram repetidos.
- Aplicar backoff exponencial com jitter para retry da fila conforme política de sync; reconexão do socket é política do cliente Socket.IO e não substitui backoff/estado de erro da fila de negócio.
- Expor ao operador estado desconectado, sincronização pendente e erro permanente; não declarar entrega à cozinha quando o item aguarda sync.

### 8.2 Recuperação de estado e polling de reconciliação

Socket.IO possui Connection State Recovery opcional, mas documenta que a recuperação pode falhar e ainda é necessário sincronizar estado. Além disso, `skipMiddlewares: true` pode permitir que uma sessão bloqueada durante desconexão seja restaurada sem passar pelas validações; não é adequado como substituto de autenticação por conexão [Connection state recovery](https://socket.io/docs/v4/connection-state-recovery/).

- **[Recomendação]** Não depender de recovery para correção no MVP; sempre realizar pull após reconexão, inclusive quando `socket.recovered` indicar sucesso.
- Se recovery vier a ser ligado, manter validações de autenticação/autorização (`skipMiddlewares: false`) e testar expiração/revogação. Definir período limitado e compatibilidade com o adapter.
- A documentação oficial informa que o Redis Adapter clássico **não** suporta Connection State Recovery; Redis Pub/Sub não persiste os pacotes necessários. Recovery é suportado por Redis Streams Adapter, que é outra escolha operacional [Connection state recovery](https://socket.io/docs/v4/connection-state-recovery/) e [Redis Adapter](https://socket.io/docs/v4/redis-adapter/).

### 8.3 Escala horizontal

- **[Spec]** Usar Redis Adapter para distribuir broadcasts entre instâncias quando o serviço escalar para múltiplos processos/instâncias.
- **[Recomendação]** Primeiro MVP pode operar com uma instância realtime; habilitar Redis Adapter quando houver múltiplas instâncias ou necessidade de fan-out entre elas. Rooms do adapter em memória não são compartilhadas entre processos.
- Com long-polling habilitado em uma implantação multi-instância, o balanceador também precisa manter afinidade de sessão (sticky sessions) para direcionar as requisições daquela conexão ao mesmo processo. Redis Adapter encaminha broadcasts, mas não substitui afinidade do transporte. Alternativamente, desabilitar polling somente após aceitar explicitamente o impacto de depender de WebSocket [Using multiple nodes](https://socket.io/docs/v4/using-multiple-nodes/).
- Redis Adapter distribui pacotes via Redis Pub/Sub; não é broker durável, não armazena histórico de eventos e não transforma entrega Socket.IO em garantida. Se Redis estiver indisponível em topologia multi-instância, eventos entre instâncias podem falhar; pull/API continua sendo recuperação.
- Não anunciar Redis como sistema de estado nem usar sucesso do publish Redis como confirmação de persistência de negócio.
- **[Lacuna]** A spec prevê Redis para escala, mas não define topologia, TLS, credenciais, política de reconexão, health check, alta disponibilidade nem o comportamento de release com Redis indisponível.

### 8.4 CORS e superfícies de rede

**[Recomendação]** Configurar origens web permitidas explicitamente e HTTPS/WSS em ambientes implantados. CORS limita chamadas de browser via HTTP long-polling, mas não é autenticação e não protege conexão nativa ou transporte WebSocket; aplicar autenticação/autorização no servidor independentemente de CORS [CORS](https://socket.io/docs/v4/handling-cors/).

## 9. Falhas e respostas observáveis

| Falha | Comportamento requerido/proposto |
|---|---|
| Sem rede ou socket desconectado | Continuar escrita local e fila; nenhuma notificação de “entregue à cozinha”. Na reconexão, push idempotente e pull. |
| API indisponível / timeout antes de confirmação | Manter mutação pendente e tentar novamente com backoff. Resultado ambíguo é resolvido por `mutationId` estável, não por criar nova mutação. |
| Erro de validação, permissão revogada ou conflito de versão | Não retry infinito. API retorna erro por mutação com categoria/código estável e, quando aplicável, estado canônico; cliente preserva o registro para correção/reconciliação. Taxonomia de erros e tratamento de fila `failed` são lacunas. |
| Socket.IO indisponível, mas API ativa | Gravação/sync continua; evento pode atrasar/perder-se. Registrar falha sem reverter commit, alertar operação e depender do pull. |
| Redis indisponível em múltiplas instâncias | Não afirmar broadcast global. Monitorar e alertar; manter API como fonte de verdade. Política de readiness/degradação deve ser definida. |
| Credencial inválida/expirada | Recusar conexão ou reconexão; solicitar reautenticação. Não criar room. |
| Payload inválido ou schema desconhecido | Rejeitar sem aplicar estado; telemetria sem payload sensível; cliente busca snapshot e registra incompatibilidade. |
| Falha do fornecedor externo | Fora do primeiro MVP. Um gateway/iFood/Anthropic indisponível não pode ser apresentado como sucesso nem afetar disponibilidade do fluxo Socket.IO de pedidos. |

Não incluir tokens, chaves, dados completos do cliente, credenciais de gateway ou conteúdo de arquivo nos logs. Registrar identificadores técnicos necessários (evento/mutação/agregado), categoria de falha e correlação, com política de retenção aprovada.

## 10. Integrações externas e eventos fora do MVP

**[Spec]** Seção 10 lista Stripe, Mercado Pago e PagSeguro com webhooks de confirmação; iFood recebe pedidos por webhook e sincroniza estados; Anthropic Claude é servidor-side para importação. O roadmap coloca pagamentos na Fase 4 e iFood/Claude na Fase 5. O recorte MVP exclui todos.

- Não criar agora eventos realtime de sucesso para gateway, iFood ou Claude nem incluir seus segredos nos clientes.
- Quando um webhook externo for incorporado, recomendação de desenho: verificar assinatura/origem conforme documentação do fornecedor, validar payload, deduplicar identificador do webhook, aplicar transição permitida e persistir estado antes de notificar por Socket.IO. O webhook não deve ser tratado como verdade sem validação.
- Para futuras tentativas de cobrança, usar chave de idempotência estável junto ao fornecedor quando suportado; Stripe recomenda chave idempotente para retries sem duplicar criação/atualização [Stripe — Idempotent requests](https://docs.stripe.com/api/idempotent_requests). O tratamento por gateway e o resultado de timeout/erro devem ser contratados por integração.
- Claude fica atrás da API; chave em variável de ambiente do servidor, validação Zod do retorno e nunca resposta simulada como sucesso, conforme seções 9–10 da spec.
- Contratos de eventos para pagamento, delivery e importação exigem coordenação separada com web, mobile, API e consumidores de webhook. `payment:processed` listado na especificação não significa que integrações de pagamento entrem no MVP.

## 11. Configuração necessária

Os nomes abaixo são **proposta de configuração**, não nomes já determinados pela especificação. Fornecer valores via ambiente/secret manager em deploy; não registrar valores de segredo.

| Configuração | Uso |
|---|---|
| `REALTIME_PORT` / bind address | Porta/endereço do processo Socket.IO standalone e health check. |
| `REALTIME_PUBLIC_URL` | Endpoint público usado pelos clientes; HTTPS/WSS em ambiente implantado. |
| `REALTIME_ALLOWED_ORIGINS` | Allowlist de origens web para CORS/long-polling. Não substitui autenticação. |
| Configuração de validação da sessão/token (`AUTH_*`) | Validador de credenciais alinhado ao Auth.js/API; valores sensíveis somente no ambiente de servidor. Nome/formato exatos dependem da decisão de autenticação. |
| `DATABASE_URL` (ou configuração compartilhada do package database) | Acesso do serviço realtime ao PostgreSQL, se necessário para validação/consulta; acesso mínimo. |
| `REDIS_URL` | Necessário quando houver Redis Adapter/múltiplas instâncias; credencial protegida. |
| Limites e timeouts de transporte | Valores de payload/tamanho, ping/timeout, rate limiting de handshake e conexão; devem ser definidos e testados antes do piloto. |

Variáveis reais, algoritmo/issuer/audience do token, limites de conexões concorrentes (aberto na seção 16), timeouts, política de logs e métricas ainda precisam de decisão operacional. Não expor chaves de gateway/Anthropic neste serviço se não houver integração ativa.

## 12. Testes de contrato e aceite

Testes locais/CI e staging devem cobrir:

1. Schema de cada evento e envelope; payload inválido, campo inesperado, data não UTC, ID inválido e versão/schema incompatível não alteram espelho.
2. Usuário válido entra somente nos rooms autorizados; sem token, expirado, revogado, perfil não permitido ou contexto de outro restaurante não recebe eventos.
3. Cliente não consegue escolher/entrar em room de outro restaurante, mesmo enviando IDs maliciosos; CORS não é considerado teste de autorização.
4. Verificar audiences: pedido/item chega ao KDS e clientes previstos; usuários não autorizados não recebem dados fora do escopo.
5. Persistência antes de emissão; simular falha após commit/antes do publish e confirmar convergência via pull/outbox.
6. Mesma mutação repetida após timeout não duplica comanda/item; `mutationId` reutilizado com payload diferente é tratado como conflito.
7. Mensagem duplicada ou atrasada não reverte versão mais nova; lacuna de versão dispara pull e converge ao estado canônico.
8. Desconectar cliente, persistir alterações em outro device e reconectar; confirmar pull mesmo com `socket.recovered === true` e quando recovery falhar.
9. Forçar indisponibilidade de WebSocket e validar long-polling; diferenciar conexão realtime da disponibilidade da API.
10. Em staging multi-instância, verificar entrega room-to-room via Redis Adapter; interromper Redis e confirmar alerta, sem declarar dados perdidos ou emitidos como persistidos.
11. Testar mutações KDS enquanto offline, reinício da aplicação, backoff/retry, fila permanente de erro e sinalização de pendência.
12. Verificar que logs/telemetria não incluem tokens, segredos ou payloads externos confidenciais.

Nenhum teste foi executado para este documento: não há implementação/ambiente executável avaliado nesta tarefa.

## 13. Lacunas que bloqueiam o congelamento do contrato

1. **Máquina de estados:** divergência de estado por pedido/item e significado de `servido`; definir transições e ator autorizado antes de habilitar `order:item:status`.
2. **Identidade de mutação e batch:** especificação não fecha chave de idempotência, resposta por item, transações, códigos de erro e tratamento de payload conflitante.
3. **Endpoint canônico de sync:** `POST /api/sync` versus `/api/sync/push`; formato do pull, cursor, paginação e retenção.
4. **Auth do serviço standalone:** integração do token Auth.js, expiração/renovação/revogação e uso offline durante indisponibilidade.
5. **Autorização de leitura:** quais perfis/devices recebem cada evento em detalhe; dados operacionais/escopo do garçom e KDS.
6. **Cardinalidade e conflitos de mesa/comanda:** uma ou múltiplas comandas e como tratar abertura concorrente.
7. **Fechamento e pagamentos:** fora do recorte recomendado; sem estado definido, não publicar `order:closed`/`payment:processed`.
8. **Cardápio e provisionamento:** eventos `menu:updated` são documentados pela spec, mas CRUD/carga inicial não está fechado para o MVP.
9. **Estratégia de entrega:** outbox, histórico/cursor de eventos, limites de retenção e observabilidade não são especificados. Pull continua obrigatório mesmo se outbox/recovery forem adotados.
10. **Topologia e operação:** número máximo de dispositivos/conexões, política Redis, health checks, TLS, origem permitida, escalabilidade e timeout de implantação.
11. **Integrações externas:** pagamentos, webhooks iFood e Claude são posteriores; requerem contratos independentes antes de qualquer evento ser consumido.

Até essas decisões serem tomadas, os campos adicionais deste documento são propostas e os eventos marcados como fora de escopo não devem ser interpretados como implementados.

## Referências técnicas primárias

- Socket.IO — [Middlewares e autenticação no handshake](https://socket.io/docs/v4/middlewares/)
- Socket.IO — [Rooms](https://socket.io/docs/v4/rooms/)
- Socket.IO — [Delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/)
- Socket.IO — [Connection State Recovery e compatibilidade de adapters](https://socket.io/docs/v4/connection-state-recovery/)
- Socket.IO — [Redis Adapter](https://socket.io/docs/v4/redis-adapter/)
- Socket.IO — [Using multiple nodes: load balancing e sticky sessions](https://socket.io/docs/v4/using-multiple-nodes/)
- Socket.IO — [CORS](https://socket.io/docs/v4/handling-cors/)
- Stripe — [Idempotent requests](https://docs.stripe.com/api/idempotent_requests)
