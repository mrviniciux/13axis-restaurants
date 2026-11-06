# Contratos de API — MVP inicial

**Status:** proposta de contrato para revisão de produto e implementação; não é uma API já implementada.  
**Base normativa do produto:** `specification.md`, em especial §§ 3.3, 4, 5.1, 6, 7 e 8, e o recorte de primeiro MVP em `docs/mvp-scope.md`.  
**Escopo deste documento:** autenticação/autorização por perfil, consulta de mesas, abertura e operação inicial de comandas, e sincronização push/pull offline-first. Não especifica CRUD de cardápio, caixa/pagamentos, reservas, estoque, transferências, divisão de conta ou integração com gateways.

## 1. Como ler os requisitos

- **[SPEC]** comportamento expressamente definido na especificação. Deve ser preservado.
- **[PROPOSTA]** contrato concreto sugerido para tornar a especificação implementável; não é uma regra de negócio aprovada.
- **[RECOMENDAÇÃO]** prática técnica baseada nas fontes oficiais/primárias ao final. Não é exigência da especificação.
- **[DECISÃO EM ABERTO]** informação que não pode ser inferida sem decisão de produto. Os contratos marcados assim não devem ser considerados definitivos.

Quando houver conflito ou ausência de regra, este documento registra a lacuna em vez de assumir comportamento de negócio. Os exemplos de JSON são ilustrações do contrato proposto, não código.

## 2. Convenções comuns

### 2.1 Transporte e formato

- **[PROPOSTA]** Recursos REST sob `/api`; corpos e respostas JSON em UTF-8. Métodos de consulta não alteram estado; operações de escrita usam `POST`, `PATCH` ou `DELETE`.
- **[PROPOSTA]** Datas e horários trafegam em ISO 8601 UTC, por exemplo `2026-11-02T18:30:00.000Z`. O servidor define `createdAt`/`updatedAt`; um `updatedAt` informado pelo cliente é metadado de conflito, não relógio confiável.
- **[SPEC]** IDs de entidades são UUID v7 gerados no cliente para suportar escrita offline (§ 6.2). **[RECOMENDAÇÃO]** Validar no servidor a sintaxe/versão UUID admitida, sem usar o UUID como prova de autorização.
- **[PROPOSTA]** Respostas de sucesso incluem apenas DTOs necessários ao recurso e à ação solicitada; não incluem hashes de senha, segredos, tokens internos ou campos de outros usuários.
- **[RECOMENDAÇÃO]** Limitar tamanho de body, quantidade de mutações por lote e tamanho de campos antes de validar; os limites numéricos precisam ser configurados e documentados antes de clientes dependerem deles.

### 2.2 Autenticação

- **[SPEC]** A stack escolhida para web é Auth.js v5; há autenticação com perfis e o usuário/perfil sincronizados no dispositivo devem corresponder à sessão válida (§§ 3.1, 4, 7.5).
- **[PROPOSTA]** Auth.js é responsável por estabelecer/encerrar sessão e pelos endpoints próprios de autenticação (`/api/auth/*`). Não criar um segundo endpoint REST de login com formato de credenciais concorrente sem decisão de arquitetura.
- **[PROPOSTA]** Toda rota protegida obtém a sessão no servidor. A identidade e perfil efetivos vêm da sessão e/ou do registro de usuário carregado pelo servidor; campos `role`, `userId`, `restaurantId` enviados pelo cliente nunca concedem acesso.
- **[RECOMENDAÇÃO]** Aplicar a checagem de autenticação e autorização dentro de cada Route Handler e Server Action, não apenas no middleware, na navegação ou na interface. Server Actions podem ser invocadas por requisição POST direta; portanto também precisam ser tratadas como entradas públicas do servidor.
- **[DECISÃO EM ABERTO]** A especificação registra JWT como escolha, mas não define duração, renovação, revogação, armazenamento do token no Android, comportamento do logout nem política de operação após expiração/offline. Definir antes de especificar persistência da sessão móvel ou prometer revogação imediata. Não aceitar operação offline como se o servidor a tivesse autorizado; ao sincronizar, revalidar a sessão e a permissão atual.

### 2.3 Autorização e escopo

- **[SPEC]** O backend valida permissão por rota/ação; ADMIN tem todas; WAITER cria/edita comandas, lança itens, transfere mesa e recebe pagamento; CASHIER opera caixa, recebe pagamentos, fecha comanda e consulta relatórios do dia; KITCHEN visualiza pedidos e atualiza status de itens. MANAGER administra cardápio, estoque, reservas, caixa, funcionários e relatórios (§ 4.2).
- **[SPEC]** A tabela de perfis também menciona BALANÇA, mas a matriz não define suas permissões. A seção 4.1 lista GERENTE como perfil de back-office e não lista CAIXA, apesar de CASHIER constar na matriz (§ 4.1–4.2).
- **[PROPOSTA]** Aplicar negação por padrão e checagem de autorização em cada método/ação, inclusive em Server Actions. Validar também a associação do recurso ao único restaurante da instalação; preparar `restaurantId` no domínio não autoriza acesso a outro tenant.
- **[RECOMENDAÇÃO]** Retornar DTOs mínimos e verificar autorização no acesso ao objeto, não apenas na rota. Para identificadores de mesas/comandas que não pertencem ao escopo do usuário, preferir uma resposta indistinguível de recurso inexistente quando isso reduzir exposição de informação.

| Ação do contrato | ADMIN | MANAGER | WAITER | CASHIER | KITCHEN | BALANÇA |
|---|---:|---:|---:|---:|---:|---:|
| Consultar mesas | Sim | **A decidir** | Sim, implícito em “Mesas” (§ 4.1) | **A decidir** | Não definido | **A decidir** |
| Consultar comandas/pedidos | Sim | **A decidir** | Sim | **A decidir** | Sim, leitura de pedidos | **A decidir** |
| Abrir/editar comanda e lançar itens | Sim | **A decidir** | Sim | Não definido | Não | **A decidir** |
| Atualizar estado de item pela cozinha | Sim | Não definido | Não definido | Não definido | Sim | Não definido |
| Fechar comanda / pagamento | Sim, como “todas” | Não definido | Receber pagamento, sem fechamento explícito na matriz | Sim, fechar comanda | Não | Não definido |

“Sim, implícito” deriva apenas do perfil descrito na seção 4.1 e não substitui a decisão de permissão granular. Antes de liberar o MVP, aprovar a matriz completa, principalmente acessos de MANAGER/CASHIER/BALANÇA e se WAITER pode atualizar estados. Não habilitar permissões por conveniência de interface.

## 3. Contratos REST de mesas e comandas

Os caminhos abaixo são **[PROPOSTA]**, alinhados ao fluxo descrito em §§ 5.1 e 7. A autorização indicada é adicional à autenticação obrigatória.

### 3.1 `GET /api/tables`

Consulta as mesas disponíveis ao usuário para o mapa operacional.

- **Autorização proposta:** ADMIN e WAITER; outros perfis somente após decisão da matriz acima.
- **Query proposta:** `updatedSince` opcional (data UTC); paginação pode ser adicionada se houver volume relevante.
- **Resposta `200`:** lista de mesas com `id`, `number`/identificador de exibição definido pelo domínio, `capacity` quando cadastrado, `status`, `version`, `updatedAt` e, se autorizado/necessário, `openOrders` como uma coleção de referências/resumos, cada qual identificada por seu próprio `orderId`. Não representar as comandas abertas da mesa em um único campo singular.
- **[SPEC]** Estados apresentados no mapa: livre, ocupada, reservada e em fechamento (§ 5.1). Reserva é fora do primeiro recorte; a presença de `reserved` no contrato depende de dados e fluxo de reservas operacionais.
- **[DECISÃO EM ABERTO]** Definir se uma mesa “em fechamento” está incluída no primeiro MVP, quem pode atribuir status operacional e como se relaciona com fechamento de caixa.

### 3.2 `GET /api/orders`

Consulta comandas que o perfil pode operar. A resposta destinada ao dispositivo de pista deve limitar-se a comandas abertas/ativas relevantes; comandas fechadas não são sincronizadas para o dispositivo (§ 7.5).

- **Autorização proposta:** ADMIN e WAITER; KITCHEN pode consultar apenas pedidos necessários ao KDS. Acesso de MANAGER/CASHIER depende da matriz.
- **Query proposta:** `status` e filtros de mesa, incluindo `tableId`; aceitar somente valores definidos pelo domínio. Paginação/ordenação devem ser estáveis, com desempate por ID.
- **Resposta `200`:** coleção de comandas como em `GET /api/orders/{orderId}`. Cada comanda é um recurso independente distinguido por `id`; retornar todas as comandas abertas que correspondam aos filtros, sem agrupar ou colapsar comandas da mesma mesa.
- **Privacidade:** não retornar dados de clientes ou pagamentos fora do escopo de pista/KDS.

### 3.3 `POST /api/orders`

Abre uma comanda em uma mesa.

- **Autorização proposta:** ADMIN e WAITER; não conceder a outros perfis até aprovação.
- **Requisição proposta:**

  ```json
  {
    "id": "UUIDv7-da-comanda",
    "tableId": "UUID-da-mesa",
    "deviceId": "identificador-do-dispositivo",
    "createdAt": "2026-11-02T18:30:00.000Z"
  }
  ```

- **Validação:** formato/versão do ID, existência e escopo da mesa, campos permitidos e validade da sessão/permissão no instante da gravação. `deviceId` é telemetria/metadado e não autentica o dispositivo.
- **Resposta proposta:** `201 Created` com comanda canônica e versão; se a mesma criação idempotente já foi processada, devolver o resultado original ou o recurso existente sem criar outra comanda.
- **[DECISÃO DO PRODUTO PARA O MVP]** São permitidas múltiplas comandas abertas na mesma mesa; não há configuração de cardinalidade nesta fase e não se define limite numérico configurável. Esta decisão resolve, para o MVP, a alternativa configurável descrita em `specification.md` § 5.1.
- **Integridade e idempotência:** comandas diferentes devem ter IDs distintos. O servidor verifica atomicamente a unicidade do ID e a chave/resultado de idempotência com a gravação: repetição da mesma mutação retorna seu resultado anterior; reutilização de ID ou chave idempotente com conteúdo diferente resulta em conflito. Não aplicar restrição de “uma comanda aberta por mesa” nem rejeitar aberturas concorrentes de IDs distintos por cardinalidade.

### 3.4 `GET /api/orders/{orderId}`

Consulta uma comanda e seus itens.

- **Autorização proposta:** ADMIN/WAITER para operação; KITCHEN apenas DTO próprio do KDS e sem dados desnecessários à cozinha.
- **Resposta `200`:** `id`, `tableId`, `status`, `createdAt`, `updatedAt`, `version`, referências permitidas do responsável e itens. Cada item contém `id`, `menuItemId`, quantidade, preço aplicado se confirmado, variação/observação permitidas, estado e metadados de versão.
- **Resposta fora do escopo:** não retornar comandas fechadas ao cliente de sync/pista. Consultas administrativas históricas dependem de política fora deste documento. Comandas distintas na mesma mesa continuam sendo recursos distintos e recuperáveis individualmente por `orderId`.

### 3.5 `POST /api/orders/{orderId}/items`

Acrescenta um item à comanda como operação aditiva, preservando inclusões concorrentes distintas.

- **Autorização proposta:** ADMIN/WAITER; KITCHEN não lança itens.
- **Requisição proposta:** item com `id` UUID v7 gerado pelo cliente, `menuItemId`, quantidade e somente campos de variação/observação que o domínio aprovar. A requisição pode incluir `deviceId` e `updatedAt` para sincronização.
- **Validação:** IDs válidos, recurso no escopo, comanda ainda elegível, quantidade e campos no formato/limites acordados, item do cardápio existente e regras de disponibilidade. Não confiar no preço ou no estado do cardápio enviado pelo cliente.
- **Resposta proposta:** `201 Created` com o item canônico e a versão/estado da comanda. Repetir a mesma operação com o mesmo identificador de mutação/item não duplica o item.
- **[SPEC]** Adições em paralelo são append e dois dispositivos devem conseguir acrescentar itens distintos sem sobrescrever um ao outro (§ 7.4).
- **[DECISÃO EM ABERTO]** A especificação não determina snapshot de preço, regras para item indisponível durante operação offline, limites de quantidade, campos obrigatórios do item nem quando o item é considerado enviado à cozinha.

### 3.6 `PATCH /api/orders/{orderId}/items/{itemId}` e `DELETE /api/orders/{orderId}/items/{itemId}`

Editar ou remover item antes do envio à cozinha.

- **Autorização proposta:** ADMIN/WAITER.
- **[SPEC]** A seção 5.1 permite editar/excluir itens antes do envio à cozinha.
- **Validação proposta:** confirmar que comanda e item pertencem ao escopo e que o item ainda está no estado em que edição/exclusão é permitida. `PATCH` aceita somente campos mutáveis explicitamente definidos; rejeitar campos desconhecidos.
- **Respostas propostas:** `200` com item atualizado; `204` para exclusão confirmada; `404` para recurso não localizado/no escopo; `409` para conflito de versão ou estado que impede a operação.
- **[DECISÃO EM ABERTO]** Não permitir nem especificar alteração/exclusão após envio à cozinha até definir correção/cancelamento e efeito no KDS. Definir também exclusão física vs. soft delete/tombstone para sync.

### 3.7 Envio à cozinha e fechamento

- **Envio à cozinha:** a seção 5.1 prevê enviar o pedido à cozinha, a seção 8 prevê eventos Socket.IO depois da persistência e o KDS está no roadmap da Fase 2. O contrato de evento e o momento em que um item muda de “rascunho” para “enviado” dependem da decisão listada na seção 7. Até então, o backend não deve afirmar entrega ao KDS apenas porque uma mutação foi gravada localmente.
- **Fechamento:** não definir neste MVP uma operação `POST /api/orders/{orderId}/close`. A especificação relaciona fechamento exclusivo a pagamento/caixa, posicionados na Fase 4, e não define fechamento manual sem pagamento. `CASHIER` tem permissão de fechar comanda na matriz, mas esse fluxo requer regra de negócio aprovada antes de ser habilitado.
- **Transferência e divisão:** mencionadas na seção 5.1, mas fora do contrato inicial; não inferir regras de itens, mesa, auditoria ou concorrência.

## 4. Contratos de sincronização

### 4.1 Endpoint canônico

- **[SPEC]** O fluxo § 7.2 menciona `POST /api/sync`; § 7.3 especifica `POST /api/sync/push` e `GET /api/sync/pull?since=<lastSyncedAt>`.
- **[PROPOSTA]** Tratar `/api/sync/push` e `/api/sync/pull` como endpoints canônicos separados, por permitirem envio e recuperação independente e retry controlado. Não implementar `/api/sync` adicional sem necessidade de compatibilidade e decisão explícita.

### 4.2 `POST /api/sync/push`

Envia um lote ordenado de mutações locais pendentes. Requer sessão válida e autorização atual para **cada** mutação.

- **Autorização proposta:** mesmas permissões dos endpoints de domínio que representam a operação. O lote não é um canal alternativo para contornar RBAC.
- **Envelope proposto:**

  ```json
  {
    "deviceId": "identificador-do-dispositivo",
    "mutations": [
      {
        "mutationId": "UUID-estavel-da-mutacao",
        "entity": "order",
        "operation": "INSERT",
        "entityId": "UUIDv7-da-comanda",
        "baseVersion": 0,
        "version": 1,
        "updatedAt": "2026-11-02T18:30:00.000Z",
        "payload": {
          "tableId": "UUID-da-mesa"
        }
      }
    ]
  }
  ```

- **Operações:** `INSERT`, `UPDATE`, `DELETE`, conforme fila local na especificação. Entidades suportadas neste recorte são mesas somente para leitura; comandas e itens conforme permissões aprovadas. Não aceitar nome arbitrário de entidade/operação.
- **Validação:** validar envelope e cada mutação com schemas compartilhados Zod no servidor; validar referências, forma do payload, UUIDs, timestamp, versão, autorização e invariantes do domínio. O schema Zod compartilhado reduz divergência entre clientes, mas não substitui a validação do servidor. Rejeitar propriedades não reconhecidas em campos de controle, ou definir explicitamente uma política de extensões versionada.
- **[RECOMENDAÇÃO]** `mutationId` é imutável entre retries e único no escopo documentado (por exemplo, restaurante); gravar a chave e o resultado processado de modo atômico com a mutação de domínio. Repetição da mesma chave e mesmo conteúdo retorna o resultado previamente registrado; mesma chave com conteúdo diferente é conflito. O escopo e a retenção do registro de idempotência ainda precisam ser acordados.
- **[SPEC]** Versão menor que a canônica é rejeitada com estado atual; versão igual é idempotente; versão maior é candidata a aplicação. A política descrita não resolve versão igual com payload diferente.
- **[PROPOSTA]** Para update com versão obsoleta, devolver `conflict` com snapshot canônico mínimo. Para item aditivo distinto, deduplicar pelo ID imutável da mutação/entidade e não rejeitar apenas porque outra inclusão alterou a versão agregada da comanda. Fechamento/ações exclusivas não entram no MVP sem decisão de negócio.
- **Atomicidade proposta:** cada mutação tem transação própria, cobrindo gravação do domínio e chave/resultado idempotente; falha de uma mutação não deve duplicar nem deixar metade da operação persistida. Um lote pode ter resultados mistos, cada um explícito. Não assumir transação única para todo o lote.
- **Resposta proposta `200`:** resultado por `mutationId`, na mesma ordem recebida, com `status` `applied`, `duplicate`, `conflict` ou `rejected`; `serverEntity`/versão canônica quando necessário; `problem` no formato da seção 5 para rejeições por mutação. HTTP 200 indica que o envelope foi processado, não que todas as mutações foram aceitas.

  ```json
  {
    "results": [
      {
        "mutationId": "UUID-estavel-da-mutacao",
        "status": "applied",
        "entityId": "UUIDv7-da-comanda",
        "version": 1
      }
    ],
    "serverTime": "2026-11-02T18:30:01.000Z"
  }
  ```

- Erro no envelope (JSON inválido, lote acima do limite ou estrutura impossível de interpretar) falha a requisição inteira. Erro de domínio/autorização por mutação retorna resultado daquela mutação; não presumir que o lote todo foi aplicado.
- O evento Socket.IO relacionado à mutação só pode ser emitido após persistência canônica bem-sucedida; evento perdido deve ser recuperável por pull (§ 8.3).

### 4.3 `GET /api/sync/pull`

Busca alterações canônicas posteriores ao marcador do cliente.

- **[SPEC]** A especificação nomeia `since=<lastSyncedAt>` e limita dados locais às entidades necessárias: cardápio/categorias, mesas, comandas abertas/ativas, além do próprio perfil e permissões; comandas fechadas não são baixadas (§§ 7.3 e 7.5).
- **[PROPOSTA]** Query inicial `since=<timestamp-UTC>`; resposta inclui `changes`, `nextSince` (maior marcador coberto pelo snapshot) e `hasMore` quando paginado. Uma mesma alteração deve ser ordenada de forma determinística; a sincronização deve incluir tombstones de registros removidos para que clientes offline possam convergir.
- **[RECOMENDAÇÃO]** Preferir um cursor opaco e ordenável pelo servidor (com paginação consistente) a depender somente de timestamps de cliente/servidor: timestamps iguais, paginação concorrente e remoções podem causar lacunas. Se o MVP mantiver `since`, usar timestamp emitido pelo servidor e ordenação estável com desempate por ID, e documentar como o cliente persiste `nextSince`.
- **Resposta `200`:** apenas dados autorizados e necessários à plataforma/ação, com `id`, tipo, estado, `version`, `updatedAt` e dados mínimos para aplicar a mudança local. O servidor ignora filtros de identidade/perfil do cliente e deriva o escopo da sessão.
- **[DECISÃO EM ABERTO]** A especificação não fixa tamanho de página, retenção de tombstones, validade de cursor, comportamento após cursor expirado nem se a consulta sincroniza integralmente o menu no primeiro uso. Definir política de snapshot/reinicialização de sync.
- Respostas de pull devem incluir a versão atual de cada entidade mutável e não podem revelar comandas fechadas/dados de outro escopo ao cliente de pista.

## 5. Erros e validação

### 5.1 Formato comum de erro

- **[RECOMENDAÇÃO]** Usar `Content-Type: application/problem+json`, conforme RFC 9457, com `type`, `title`, `status`, `detail` seguro e `instance`. Extensão `code` pode fornecer identificador estável para clientes; `errors` pode conter erros de campo sem ecoar payload sensível.
- **[PROPOSTA]** Exemplo:

  ```json
  {
    "type": "https://mudra.example/problems/validation",
    "title": "Dados inválidos",
    "status": 422,
    "detail": "Um ou mais campos não atendem ao contrato.",
    "instance": "/api/orders",
    "code": "VALIDATION_FAILED",
    "errors": [
      { "path": "tableId", "code": "invalid_uuid", "message": "Identificador inválido." }
    ],
    "requestId": "identificador-de-correlacao"
  }
  ```

`detail` e `message` são destinados a consumidores e não devem conter stack trace, SQL, credenciais, tokens, conteúdo de sessão ou informação que confirme existência de usuário/recurso fora do escopo.

### 5.2 Mapeamento de status proposto

| HTTP | Quando usar |
|---:|---|
| `400 Bad Request` | JSON malformado, query/parâmetro impossível de interpretar ou envelope de sync estruturalmente inválido. |
| `401 Unauthorized` | Sessão ausente, inválida ou expirada. Para login inválido, mensagem genérica sem revelar existência/estado da conta. |
| `403 Forbidden` | Sessão válida, mas ação não permitida; pode-se usar `404` para não revelar recurso fora do escopo. |
| `404 Not Found` | Recurso inexistente ou deliberadamente indistinguível de recurso inacessível. |
| `409 Conflict` | Versão obsoleta, ID já usado com conteúdo diferente, mutação idempotente repetida com conteúdo diferente ou estado incompatível. Não usar para rejeitar abertura de comanda apenas porque já há outra aberta na mesma mesa. |
| `413 Content Too Large` | Corpo ou lote acima do limite publicado. |
| `415 Unsupported Media Type` | Tipo de conteúdo não aceito. |
| `422 Unprocessable Content` | JSON sintaticamente correto, mas campos ou regra de domínio inválidos. Para lote de sync, usar resultado por mutação, se o envelope for válido. |
| `429 Too Many Requests` | Limite de chamadas excedido; incluir `Retry-After` quando aplicável. |
| `500 Internal Server Error` | Falha inesperada; resposta genérica e correlacionável por `requestId`. |

O código HTTP deve manter semântica coerente com o significado HTTP; clientes não devem tomar decisão de retry apenas pela mensagem textual.

### 5.3 Regras de validação

1. Validar no servidor todo corpo/query/identificador com schemas compartilhados Zod, em Route Handlers e Server Actions; nunca tratar a validação feita no app como confiável.
2. Validar autorização, escopo do restaurante, existência de referências e invariantes dentro da operação de persistência, sob concorrência. Verificar atomicamente a unicidade dos IDs de comanda e mutação e a idempotência; aberturas concorrentes com IDs distintos na mesma mesa são permitidas. Não instituir limite de comandas por mesa.
3. Rejeitar entradas incompatíveis com o schema antes de persistir; conservar dados enviados na fila local quando o servidor rejeitar, para que o cliente possa apresentar erro recuperável em vez de descartar silenciosamente.
4. Não confiar em preço, perfil, status de mesa/comanda, `restaurantId`, resultado de pagamento ou dados de usuário enviados pelo cliente. Valores canônicos devem ser determinados pelo servidor, mas política de preço/snapshot exige decisão de negócio.
5. Não registrar tokens, credenciais, conteúdo integral de payloads de comanda ou dados pessoais sensíveis em logs. Usar `requestId`/`mutationId` para correlação com retenção apropriada.

## 6. Garantias de idempotência, concorrência e retry

- **[SPEC]** A fila local persiste mutações, reenvia com backoff exponencial (1, 2, 4, 8 segundos, até 60 segundos) e usa UUID v7, versão e timestamps; adições concorrentes distintas são aceitas; fechamento, quando definido, é exclusivo (§§ 6.2, 7.3–7.4).
- **[PROPOSTA]** O cliente conserva o mesmo `mutationId` para todos os retries da mesma ação, inclusive após timeout sem resposta. Não gerar ID novo ao repetir uma requisição cuja confirmação se perdeu.
- **[RECOMENDAÇÃO]** A deduplicação no servidor deve ser persistente e atômica com efeitos de domínio, com unicidade por escopo documentado. Uma resposta de timeout não autoriza o cliente a assumir rejeição nem a criar uma nova mutação equivalente.
- **[PROPOSTA]** O servidor retorna o snapshot atual ao rejeitar versão antiga; o cliente substitui o estado canônico local correspondente e conserva claramente a indicação de conflito da alteração não aplicada.
- **[DECISÃO EM ABERTO]** Definir regra para mesma versão e payload diferente, escopo/retention da chave idempotente, versão inicial de novas entidades, ordenação de dependências (por exemplo, abrir comanda antes de criar item) e política de erros permanentes/reenvio manual. Não há regra suficientemente determinada para resolver esses pontos sem decisão.

## 7. Pontos de negócio a decidir antes de congelar os contratos

1. **Matriz de RBAC:** permissões de BALANÇA; plataforma e limites de CASHIER; acesso de MANAGER às mesas/comandas; visibilidade do KDS e direitos de alteração de estados por perfil.
2. **Cardinalidade de comandas — resolvida para o MVP:** múltiplas comandas abertas por mesa são permitidas, sem configuração nem limite numérico configurável nesta fase. A integridade continua exigindo IDs distintos e checagem atômica de unicidade/idempotência; a regra não bloqueia aberturas concorrentes de recursos distintos.
3. **Ciclo de vida:** estados canônicos de mesa, comanda, pedido e item. A seção 5.1 cita enviado/em preparo/pronto/servido; § 5.3 define estados de item novo/preparando/pronto. Definir hierarquia, transições, responsável e significado de “enviar”.
4. **Fechamento:** se está no MVP; relação com pagamento/caixa, liberação da mesa, autorização e concorrência.
5. **Dados de item:** preço e snapshot no lançamento, variantes/adicionais, observações, unidade/limites de quantidade, disponibilidade e comportamento offline para item que mudou no servidor.
6. **Alterações após envio:** correção/cancelamento de item já enviado à cozinha e emissão de atualização para o KDS.
7. **Protocolo de sync:** resolver `POST /api/sync` vs. `/push` e `/pull`; escolher timestamp `since` ou cursor; limites de lote/página, tombstones e recuperação de cursor expirado.
8. **Idempotência e conflitos:** unicidade/retenção de `mutationId`; mesma chave/conteúdo diferente; mesma versão/conteúdo diferente; versão inicial e tratamento de conflito sem perda de operação aceita.
9. **Sessão offline:** duração/renovação/revogação, troca/logout de usuário no aparelho e tratamento de mutações pendentes depois de permissão revogada.
10. **Provisionamento:** como mesas e cardápio necessários ao primeiro uso são cadastrados/carregados, já que o CRUD completo está no roadmap posterior.

## 8. Critérios de validação deste contrato

Este documento considera a validação documental concluída quando:

- cada endpoint tem ator/permissão ou lacuna explícita;
- as entradas são validadas no servidor e os erros têm forma uniforme;
- retries identificam mutações de modo estável e não duplicam efeitos;
- conflitos, escopo de dados e sincronização de comandas abertas são descritos;
- lacunas de negócio estão explícitas e não são convertidas em regras implícitas.

Esses critérios validam a proposta escrita; não afirmam que endpoints, autenticação, testes de integração ou ambiente executável já existam ou tenham sido testados.

## 9. Fontes oficiais/primárias e aplicação

As fontes abaixo fundamentam **recomendações técnicas**, não alteram os requisitos de produto marcados **[SPEC]**.

1. **IETF RFC 9457 — Problem Details for HTTP APIs**  
   https://www.rfc-editor.org/rfc/rfc9457.html  
   Define formato padronizado e legível por máquina para detalhes de erros HTTP; base da recomendação `application/problem+json`.
2. **IETF RFC 9110 — HTTP Semantics**  
   https://www.rfc-editor.org/rfc/rfc9110.html  
   Referência normativa para semântica de métodos e códigos HTTP usados no mapeamento proposto.
3. **IETF RFC 9562 — UUIDs**  
   https://www.rfc-editor.org/rfc/rfc9562.html  
   Define UUID, incluindo a forma v7; a escolha de UUID v7 para IDs cliente-gerados já é requisito de `specification.md`, não uma exigência deste RFC para o produto.
4. **Auth.js — Protecting Resources**  
   https://authjs.dev/getting-started/session-management/protecting  
   Documenta proteção de páginas e API routes mediante sessão no servidor; sustenta a recomendação de checar sessão em handlers protegidos.
5. **Next.js — Mutating Data / Server Actions**  
   https://nextjs.org/docs/app/getting-started/mutating-data  
   A documentação alerta que Server Functions podem ser chamadas por requisições POST diretas e recomenda verificar autenticação/autorização em cada função.
6. **Next.js — Data Security**  
   https://nextjs.org/docs/app/guides/data-security  
   Recomenda camada de acesso a dados no servidor, checagens de autorização e DTOs mínimos; sustenta minimização de dados e separação da lógica de acesso.
7. **Zod — Basics**  
   https://zod.dev/basics  
   Documenta parsing/validação e erros estruturados; sustenta o uso de schemas compartilhados para validação de entrada, sem substituir validação e autorização servidoras.

**Acesso às fontes:** 2026-11-02.
