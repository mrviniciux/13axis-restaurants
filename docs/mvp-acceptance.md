# Critérios de aceite e cenários QA — Fundação e fluxo inicial do MVP

## 1. Objetivo e escopo

Este documento transforma a `specification.md` e as decisões de produto registradas nesta conversa em critérios verificáveis para a fundação do MVP e o primeiro fluxo de operação:

1. bootstrap inicial por CLI interativa, autenticação por credenciais e autorização básica por perfil (RBAC);
2. consulta de mesas e abertura/edição de comandas;
3. gravação local-first e sincronização offline/online, incluindo falhas e concorrência.

Inclui web e Android apenas nos pontos descritos na especificação. Considera cardápio/dados de teste previamente cadastrados. Não cobre CRUD de cardápio, caixa/pagamentos, reservas, estoque, cozinha/KDS completo, integrações externas, relatórios ou gestão de funcionários além do necessário para preparar usuários de teste.

**Referências:** especificação técnica, seções 3.3, 4, 5.1, 6, 7, 8, 11 e 14. A especificação é de alto nível; lacunas de regra de negócio estão registradas na seção 6 e não devem ser resolvidas por suposição.

## 2. Prioridade e regra de validação

- **P0 — bloqueador:** risco de acesso indevido/perda ou duplicação de comanda, ou impossibilidade de operar o fluxo inicial.
- **P1 — importante:** comportamento necessário para operação previsível, recuperação de falha, concorrência ou acessibilidade.
- **P2 — complementar:** fora do gate inicial, mas recomendado antes de ampliar o piloto.

Um critério só pode ser marcado como aprovado após execução e verificação de evidência (resultado, logs/estado persistido ou comportamento observável). A existência deste documento não significa que o produto foi testado ou aprovado.

## 3. Critérios de aceite

### 3.1 Bootstrap inicial interativo

| ID | Prioridade | Critério de aceite |
|---|---|---|
| BOOT-01 | P0 | A execução inicial oferece um CLI interativo que solicita o nome do restaurante e a senha do primeiro usuário ADMIN. A senha é lida interativamente, não é fornecida como credencial padrão e não é aceita a partir de um default embutido. |
| BOOT-02 | P0 | O bootstrap cria o registro do restaurante e seu primeiro usuário com perfil ADMIN como uma única operação atômica: ou ambos são persistidos, ou nenhum deles é persistido. |
| BOOT-03 | P0 | A senha é armazenada somente como hash Argon2id, usando a implementação/configuração mantida pelo produto; senha em texto puro não é persistida. O fluxo de autenticação consegue verificar a senha informada contra o hash. |
| BOOT-04 | P0 | A senha não aparece em eco visível do terminal, argumentos de processo, logs, mensagens de erro, saída do comando ou dados não destinados ao armazenamento seguro. O CLI não imprime nem gera credenciais padrão. |
| BOOT-05 | P1 | Se o operador cancelar ou uma validação/etapa de persistência falhar, o CLI termina com indicação clara de falha/cancelamento e não deixa restaurante sem ADMIN nem ADMIN sem restaurante. |
| BOOT-06 | P1 | Se o banco já estiver inicializado, executar novamente o bootstrap não cria registros duplicados nem altera silenciosamente a configuração existente; o CLI informa que a inicialização já foi feita e encerra sem mudanças. |

O formato do identificador de login do ADMIN (por exemplo, e-mail ou nome de usuário) não foi decidido nesta solicitação; se for obrigatório pelo modelo de autenticação, o CLI deve solicitá-lo conforme a regra confirmada, sem assumir um valor padrão.

### 3.2 Autenticação e RBAC

| ID | Prioridade | Critério de aceite |
|---|---|---|
| AUTH-01 | P0 | Um usuário ativo com credenciais válidas consegue autenticar-se no front-end permitido para seu perfil. O backend identifica o usuário e o perfil a partir da sessão/token JWT; a autorização não depende apenas de controles visuais no cliente. |
| AUTH-02 | P0 | Credenciais inválidas ou usuário inexistente/inativo não criam sessão autenticada. A resposta não revela se o usuário existe nem expõe senha, token ou detalhes internos. |
| AUTH-03 | P0 | Uma chamada sem sessão válida a uma rota/ação protegida é negada. O cliente apresenta estado de não autenticado sem exibir dados protegidos. |
| AUTH-04 | P0 | A cada rota/ação protegida, o backend aplica a permissão do perfil. Ocultar uma opção na interface não substitui a verificação do servidor. Perfil/ação sem permissão explicitamente concedida é negado por padrão. |
| AUTH-05 | P0 | A matriz de permissões implementa os direitos explicitamente descritos em `specification.md` (seção 4.2): ADMIN — todas; MANAGER — cardápio, estoque, reservas, caixa, funcionários e relatórios; WAITER — criar/editar comandas, lançar itens, transferir mesa e receber pagamento; CASHIER — operar caixa, receber pagamentos, fechar comanda e relatórios do dia; KITCHEN — visualizar pedidos e atualizar status de itens. |
| AUTH-06 | P1 | O usuário autenticado recebe apenas os dados e recursos pertinentes ao seu acesso. Trocar identificador de mesa/comanda em uma requisição não permite contornar autorização. |
| AUTH-07 | P1 | Logout encerra o estado autenticado no cliente e impede que a sessão encerrada continue autorizando novas operações, conforme o mecanismo de sessão/token adotado. A duração, revogação e política de renovação do JWT precisam ser definidas antes do aceite final (ver seção 6). |
| AUTH-08 | P1 | No app Android, o perfil permitido acessa o fluxo de pista; no web, os perfis de back-office acessam apenas as funções autorizadas. Tentativas de usar um perfil em plataforma/fluxo não autorizado são negadas no servidor. |

### 3.3 Mesas e comandas

| ID | Prioridade | Critério de aceite |
|---|---|---|
| ORD-01 | P0 | O usuário autorizado visualiza as mesas e seus estados: livre, ocupada, reservada ou em fechamento. O estado mostrado corresponde ao estado persistido mais recente disponível localmente ou recebido do servidor. |
| ORD-02 | P0 | Um usuário com permissão pode abrir uma comanda em mesa elegível. A comanda e seus itens usam IDs UUID v7 gerados pelo cliente, permitindo operação sem aguardar resposta do servidor. A mesa e a comanda passam a refletir o novo estado local imediatamente. |
| ORD-03 | P0 | Usuário autorizado consegue lançar item de um cardápio já sincronizado/cacheado, com quantidade e dados necessários ao item. A escrita local atualiza a tela imediatamente e adiciona uma mutação à fila persistente. Navegar para outra mesa não depende da resposta de rede. |
| ORD-04 | P1 | Itens podem ser editados/excluídos antes do envio à cozinha, conforme a seção 5.1 da especificação. O comportamento para item já enviado não deve ser presumido; requer regra de negócio definida. |
| ORD-05 | P0 | Uma tentativa não autorizada de abrir/alterar comanda ou lançar item é negada no servidor e não altera o estado canônico. |
| ORD-06 | P0 | Reenviar a mesma mutação (mesmo ID de mutação/entidade) após timeout ou retry não cria uma segunda comanda nem duplica item. O cliente reconcilia a confirmação com o registro local existente. |
| ORD-07 | P1 | Uma comanda fechada não aceita novos itens. Se outro dispositivo fechar a comanda primeiro, o cliente concorrente recebe/obtém o estado fechado e apresenta o conflito sem deixar a comanda aberta como estado canônico. A política detalhada de fechamento precisa ser definida antes do teste final, pois o MVP aqui não inclui caixa/pagamento. |
| ORD-08 | P1 | O vínculo entre mesa e comanda e o estado de ocupação são consistentes após sincronização, inclusive quando a gravação inicial ocorreu offline. |
| ORD-09 | P0 | Quando uma mesa tiver várias comandas abertas, o usuário autorizado consegue visualizar cada comanda de forma distinta e selecionar uma específica. A identificação, os itens e as ações exibidos correspondem à comanda selecionada, sem misturar dados entre comandas. |

### 3.4 Sincronização offline e conflitos

| ID | Prioridade | Critério de aceite |
|---|---|---|
| SYNC-01 | P0 | Com rede disponível, mutações pendentes são enviadas em background ao endpoint de sync acordado, persistidas no PostgreSQL e confirmadas ao cliente. A UI não bloqueia a operação enquanto aguarda sync. |
| SYNC-02 | P0 | Sem rede, mutações permanecem persistidas na fila local com entidade, operação, payload, estado, número de tentativas e data de criação; fechar/reabrir o app não as descarta. |
| SYNC-03 | P0 | Ao recuperar conectividade, o motor tenta novamente com backoff exponencial (1, 2, 4, 8 segundos, limitado a 60 segundos, conforme especificação), envia pendências e busca alterações remotas. Não há perda nem duplicação por retry. |
| SYNC-04 | P0 | O protocolo aplica IDs gerados no cliente, timestamps UTC e versionamento incremental das entidades mutáveis. Uma atualização recebida com versão menor é rejeitada e o estado atual do servidor é devolvido/aplicado no cliente. |
| SYNC-05 | P0 | Uma atualização com a mesma versão e o mesmo conteúdo é idempotente: processá-la repetidamente não cria efeitos adicionais. O comportamento para mesma versão com conteúdo divergente deve ser decidido (seção 6); não aprovar com uma interpretação implícita. |
| SYNC-06 | P0 | Adições concorrentes de itens à mesma comanda, feitas por dois dispositivos autorizados, são tratadas como operações aditivas: ambos os itens distintos são preservados uma vez no estado canônico e aparecem após sincronização nos clientes. |
| SYNC-07 | P0 | Duas criações concorrentes de comanda para a mesma mesa, originadas em clientes/dispositivos diferentes e com IDs de comanda distintos, são preservadas como duas comandas abertas distintas após sincronização. Ambas podem ser visualizadas e selecionadas separadamente; não há limite numérico definido nesta fase. |
| SYNC-08 | P0 | Duas alterações concorrentes do mesmo registro seguem versionamento/LWW: versão maior é aplicada; versão menor é rejeitada com estado atual. O cliente reconcilia o snapshot e sinaliza que a alteração local não prevaleceu, sem apagar silenciosamente a versão do servidor. |
| SYNC-09 | P0 | Se o servidor aceitar o fechamento da comanda em um dispositivo, outro dispositivo não consegue gravar itens como se ela continuasse aberta. O primeiro fechamento válido prevalece e os demais clientes convergem para comanda fechada. |
| SYNC-10 | P1 | Erros temporários (timeout, indisponibilidade da API/DB) mantêm mutações recuperáveis e permitem retry; erros permanentes de validação/autorização não entram em retry infinito e são identificáveis para correção/ação do usuário. |
| SYNC-11 | P1 | Aplicar um pull ou evento remoto é idempotente e não apaga mutações locais ainda não confirmadas. Eventos recebidos fora de ordem não fazem uma versão mais antiga substituir uma mais nova. |
| SYNC-12 | P1 | A UI distingue estado local pendente de estado sincronizado e comunica falha/conflito sem bloquear ações não relacionadas. Alterações remotas de mesa/comanda convergem para os dispositivos online. |

## 4. Matriz de cenários QA

**Observação sobre execução:** não foi fornecido nem executado um produto/build, ambiente ou conjunto de testes. Portanto, todos os resultados observados abaixo são **“Não executado — sem produto/ambiente disponível”**. Os resultados esperados são critérios propostos, não resultados observados.

| ID / prioridade | Pré-condições | Passos | Resultado esperado | Resultado observado | Status |
|---|---|---|---|---|---|
| QA-BOOT-01 / P0 | CLI disponível; banco de teste descartável migrado e vazio; execução em terminal interativo (TTY). | Iniciar bootstrap; informar nome do restaurante e senha do primeiro ADMIN nos prompts; concluir o fluxo; inspecionar registros no banco e autenticar com a senha informada. | Um restaurante e seu primeiro ADMIN ficam persistidos; perfil é ADMIN; senha autentica via verificação Argon2id e somente seu hash está armazenado. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-BOOT-02 / P0 | Mesmas pré-condições de QA-BOOT-01; terminal e logs observáveis; senha de teste exclusiva. | Executar bootstrap e inserir senha; verificar eco do terminal, argumentos do processo, saída, logs e mensagens; procurar a senha em texto puro no banco. | Senha não é exibida nem registrada em argumentos/logs/saída e não consta em texto puro no banco; nenhuma credencial padrão é exibida ou criada. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-BOOT-03 / P0 | Banco de teste descartável vazio; possibilidade de provocar falha após tentativa de gravar restaurante e antes de concluir criação do ADMIN (e vice-versa, quando aplicável). | Iniciar bootstrap; injetar falha de persistência em cada etapa dentro da transação; consultar estado do banco após cada falha. | A operação é atômica: após falha não fica restaurante sem primeiro ADMIN nem ADMIN sem restaurante; CLI indica falha sem revelar senha. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-BOOT-04 / P1 | Banco já inicializado por bootstrap concluído; mesmo CLI e ambiente de teste. | Executar bootstrap novamente e inspecionar registros antes/depois. | CLI informa que já foi inicializado e termina sem criar registros duplicados nem alterar os existentes. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-BOOT-05 / P1 | Banco de teste descartável vazio; CLI em terminal interativo. | Cancelar no prompt ou fornecer entrada inválida e interromper antes da confirmação/conclusão; consultar banco. | CLI informa cancelamento/validação; nenhum estado parcial é persistido e nenhuma senha padrão substitui a entrada ausente. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-AUTH-01 / P0 | Usuário ativo de teste com perfil autorizado; API e armazenamento de sessão disponíveis localmente. | Entrar com credenciais válidas; abrir rota autorizada; consultar identidade/perfil retornados pelo backend. | Login concluído; sessão JWT válida; rota autorizada acessível; perfil aplicado pelo servidor. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-AUTH-02 / P0 | Usuário de teste; endpoint de login local. | Tentar senha incorreta e usuário inexistente; observar resposta e estado de sessão; inspecionar logs/cliente para dados sensíveis. | Sem sessão; mensagem genérica; sem distinção de existência do usuário e sem credencial/token em logs ou resposta indevida. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-AUTH-03 / P0 | Sessão ausente, expirada ou inválida; rota protegida. | Acessar a rota diretamente e chamar a ação/API sem sessão. | Acesso negado no servidor; nenhum dado/efeito protegido; cliente apresenta login/erro de autenticação. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-AUTH-04 / P0 | Usuários de teste para ADMIN, MANAGER, WAITER, CASHIER e KITCHEN; endpoints representativos de leitura e escrita. | Para cada perfil, chamar operações permitidas e proibidas pela matriz da seção 3.2, inclusive diretamente pela API. | Permissões concedidas funcionam; demais são negadas no servidor, sem mutação. Balança deve ser testada após definição de sua matriz. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução; matriz parcial |
| QA-AUTH-05 / P1 | Sessão autenticada em web/mobile; política de JWT definida. | Fazer logout; repetir chamada protegida com estado/token anterior; reabrir app/navegador. | Estado autenticado removido; chamadas posteriores não autorizadas conforme política definida. | Não executado — política de sessão pendente. | Bloqueado por lacuna |
| QA-ORD-01 / P0 | Mesas e itens de cardápio previamente carregados; garçom autenticado; base local limpa. | Abrir mesa livre, criar comanda e lançar um item online; observar UI, banco local, fila e servidor. | UI atualiza imediatamente; IDs locais são únicos; operação é enfileirada e depois confirmada no servidor; estados de mesa/comanda consistentes. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-ORD-02 / P0 | Mesmo cenário do QA-ORD-01; conexão desativável no ambiente local. | Desconectar; abrir comanda e lançar item; navegar para outra mesa; encerrar e reabrir app ainda offline. | Fluxo local não espera a rede; comanda/item permanecem visíveis e fila pendente permanece após reinício. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-ORD-03 / P0 | Comanda/item criados offline; servidor local disponível. | Restabelecer rede; aguardar tentativas/retry; inspecionar estado remoto e fila local. | Mutação sincroniza uma vez; fila passa a confirmada/sincronizada; UI converge para estado canônico sem duplicação. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-ORD-04 / P0 | Comanda aberta sincronizada; usuário sem permissão de edição ou sessão inválida. | Tentar inserir/editar item via interface e chamada direta à API. | Backend rejeita; estado local não é confundido com confirmação canônica; nenhuma alteração é persistida no servidor. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-ORD-05 / P0 | Uma mesa com pelo menos duas comandas abertas distintas; usuário autorizado; itens diferentes em cada comanda. | Abrir a mesa; verificar a lista de comandas; selecionar cada uma alternadamente e conferir identificação, itens e ações disponíveis. | Cada comanda é visível e selecionável de forma distinta; a seleção exibe apenas os dados da comanda correspondente e não mistura itens/ações. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-SYNC-01 / P0 | Dois clientes autenticados com acesso à mesma comanda aberta; API e PostgreSQL locais; itens diferentes disponíveis. | Desconectar ambos; adicionar item distinto em cada dispositivo; reconectar e sincronizar em ordens diferentes. | Ambos os itens são preservados exatamente uma vez; clientes convergem para mesmo estado. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-SYNC-02 / P0 | Dois clientes autenticados; mesma mesa; cada cliente pode criar comandas; API e PostgreSQL locais. | Criar simultaneamente uma comanda em cada dispositivo, confirmando IDs distintos; sincronizar em ordens diferentes; abrir a mesa em ambos os clientes e selecionar cada comanda. | As duas comandas com IDs diferentes são persistidas e continuam distintas; ambas aparecem como abertas e podem ser selecionadas individualmente, sem perda, fusão ou duplicação causada por retry. Não se aplica limite numérico nesta fase. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-SYNC-03 / P0 | Registro versionado conhecido; dois clientes com snapshots da mesma versão; servidor local. | Alterar o mesmo campo em ambos; sincronizar primeiro a versão mais nova e depois a mais antiga. | Versão inferior não sobrescreve a superior; cliente perdedor recebe/aplica estado atual e conflito fica observável. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-SYNC-04 / P0 | Mutação enviada ao servidor; simulação de perda da resposta após commit. | Enviar criação de comanda/item; descartar resposta; provocar retry com a mesma identidade de mutação. | Retry idempotente; uma única comanda/item canônico; cliente recebe confirmação do registro já criado. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-SYNC-05 / P0 | Comanda aberta em dois dispositivos; fechamento operacional habilitado e regra de fechamento definida. | Fechar em A e, simultaneamente ou depois, lançar item/fechar em B; sincronizar ambos. | Primeiro fechamento válido prevalece; B recebe comanda fechada e não adiciona item ao estado canônico. | Não executado — fluxo/regra de fechamento pendente. | Bloqueado por lacuna |
| QA-SYNC-06 / P1 | API/DB local; fila contendo uma mutação pendente. | Simular indisponibilidade/timeout, recuperar serviço e observar tentativas; repetir com erro permanente de validação. | Falha transitória mantém item pendente e faz retry limitado; erro permanente é identificado e não gera retry infinito/perda silenciosa. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-SYNC-07 / P1 | Cliente com estado local versionado e um item ainda pendente; evento/pull remoto disponível. | Receber atualização remota mais nova e, depois, evento antigo; aplicar pull durante mutação local pendente. | Versão antiga não regride o snapshot; atualização remota não apaga a mutação pendente; eventual conflito é reconciliado. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |
| QA-A11Y-01 / P1 | Fluxo de login e mesas em ambiente local executável. | Usar teclado sem mouse no web; verificar foco, rótulos, mensagens de erro, contraste e anúncio de estado dinâmico; no Android verificar alvos de toque. | Navegação por teclado funcional; labels associados; foco perceptível; contraste mínimo de 4.5:1; aria-live para atualizações pertinentes; alvos de toque mínimos de 44×44 px. | Não executado — sem produto/ambiente disponível. | Bloqueado para execução |

## 5. Onde executar: local vs. infraestrutura real

| Tipo de verificação | Pode ser testado localmente | Requer infraestrutura real ou ambiente integrado |
|---|---|---|
| Bootstrap CLI | CLI executado localmente em terminal interativo (TTY), Argon2id e banco descartável local/PostgreSQL de teste com migrations; injetar falhas de persistência e inspecionar transação, hash e logs. Não requer serviços externos nem produção. | Para validar o procedimento operacional de instalação, executar em staging com PostgreSQL de staging migrado, variáveis/secrets de deployment e acesso controlado a terminal/console interativo (ou mecanismo seguro equivalente que preserve entrada interativa da senha). Confirmar que inicialização real ocorre uma única vez. Não executar teste de falha destrutiva em produção. |
| Contratos e validações | Schemas Zod, validação de payload, UUID v7, cálculo/ordenação de versões e serialização UTC com testes unitários. | Não requer produção; validar também compatibilidade entre builds/clientes antes de release. |
| RBAC | Testes unitários da matriz e testes de integração local chamando handlers com usuários/sessões de teste. | Ambiente integrado para confirmar configuração de Auth.js, secrets, cookies/headers, HTTPS, URLs e callbacks do deployment. Não usar contas/dados reais em testes de permissão. |
| Banco e concorrência | PostgreSQL local ou container de teste com migrations: constraints, transações, idempotência, concorrência de abertura e versão. | PostgreSQL implantado/staging para validar rede, pool, migrations de release, disponibilidade e comportamento sob latência/conexões reais. Não é necessário testar concorrência somente em produção. |
| Escrita offline e fila | SQLite local/emulador Android; desconexão de rede simulada; reinício do app; testes controlados do motor de fila e backoff. | Dispositivos reais e Wi‑Fi/celular instáveis para validar suspensão do app/background tasks e reconexão real em condições de restaurante. |
| Sincronização API | API local + PostgreSQL local; injeção de timeout, falha transitória e resposta perdida; clientes simulados em paralelo. | Staging integrado para confirmar DNS/TLS, autenticação entre serviços, limites de rede, deploy, observabilidade e latência. |
| Tempo real / convergência | Servidor Socket.IO e clientes locais podem verificar eventos, autorização de room e reconexão básica. | Staging com instâncias/Redis quando houver múltiplas instâncias; rede e dispositivos distintos para validar entrega real, fallback long-polling e reconexão. |
| Acessibilidade e interface | Navegador local, leitores/inspeção de acessibilidade, emulador Android e ferramentas de contraste. | Verificação complementar em dispositivos reais, tamanhos de tela e leitor de tela suportado; não exige banco/serviços de produção. |

**Não usar produção para testes destrutivos de concorrência ou conectividade.** A maior parte do gate pode e deve ser validada em CI e ambiente local integrado. “Infraestrutura real” significa deployment de staging com serviços configurados e, para conectividade/background, dispositivos e rede reais — não implica executar testes de falha em dados de clientes.

## 6. Lacunas e decisões necessárias antes do aceite final

Estas decisões não estão suficientemente especificadas. Devem ser confirmadas pelo responsável de produto e documentadas; até então, cenários dependentes delas permanecem bloqueados.

1. **Perfil Balança:** consta na lista de perfis (seção 4.1), mas não tem permissões definidas na matriz 4.2. Confirmar quais ações e entidades pode criar/consultar, inclusive se pode operar mesa/comanda.
2. **Perfil Caixa:** CASHIER consta na matriz 4.2, mas não na tabela de perfis/plataformas da seção 4.1. Confirmar plataforma e limites, sobretudo se pode abrir/editar comanda ou apenas receber/fechar.
3. **Cardinalidade da comanda:** decisão do usuário para o MVP: permitir múltiplas comandas abertas na mesma mesa, sem configuração de cardinalidade e sem limite numérico definido nesta fase. Validar visibilidade/seleção de comandas distintas e criações concorrentes com IDs diferentes.
4. **Identificador de login do ADMIN:** foi decidido que o bootstrap solicita nome do restaurante e senha; não foi definido se o primeiro ADMIN também requer e-mail, nome de usuário ou outro identificador. Confirmar o campo de login exigido pelo modelo; não inferir nem criar um valor padrão.
5. **Autenticação e operação offline:** definir duração/expiração/renovação/revogação do JWT, comportamento após logout e se um usuário previamente autenticado pode continuar trabalhando offline; definir também como permissões revogadas são aplicadas a operações locais ainda pendentes.
6. **Endpoint/protocolo de sync:** o fluxo 7.2 menciona `POST /api/sync`, enquanto a seção 7.3 especifica `POST /api/sync/push` e `GET /api/sync/pull`. Definir contrato canônico, formato de resposta, identidade de idempotência e códigos de erro.
7. **Conflito de mesma versão:** a especificação diz que versão igual é aplicada/idempotente, sem distinguir payload idêntico de payload divergente. Definir regra determinística para payload divergente com mesma versão.
8. **Fechamento de comanda:** o fluxo de primeira operação não inclui caixa/pagamento, mas a resolução de conflitos cita fechamento exclusivo. Definir se/como o fechamento entra no MVP de mesas/comandas e as permissões necessárias.
9. **“Enviar para cozinha”:** consta no módulo de mesas/comandas e depende de evento Socket.IO/KDS. Confirmar se o gate deste fluxo exige evento/KDS operacional ou se o aceite inicial limita-se a persistir e sincronizar a comanda.
10. **Estado `failed` da fila e recuperação:** definir quais erros são permanentes, como o usuário identifica/corrige uma mutação falha e se existe ação de reenvio/descartar; a especificação lista `failed`, mas não descreve a resolução.

## 7. Riscos e bloqueios

- **Bloqueio de validação:** não há build, aplicação ou ambiente executável disponível nesta tarefa; nenhum cenário foi executado e nenhum fluxo pode ser declarado aprovado.
- **Risco P0 — bootstrap inicial:** a atomicidade e o hash Argon2id precisam ser verificados em banco de teste; senha em texto puro, credenciais padrão ou estado parcial bloqueiam o aceite.
- **Risco P0 — autorização incompleta:** matriz de Balança e posicionamento de Caixa estão inconsistentes entre as seções 4.1 e 4.2. Implementar permissões por inferência pode conceder acesso excessivo ou bloquear operação legítima.
- **Risco P0 — duplicidade/perda em concorrência:** idempotência por identidade de mutação e transação atômica no servidor precisam de confirmação via testes integrados com PostgreSQL.
- **Risco P0 — fluxo de fechamento:** as regras e permissões de fechamento permanecem pendentes; não inferir política de fechamento a partir da decisão de permitir múltiplas comandas abertas.
- **Risco P1 — segurança offline:** a política de sessão e de mutações pendentes após expiração/revogação não está definida.
- **Risco P1 — integração em tempo real:** entrega de eventos, salas por restaurante, reconexão e eventual Redis Adapter dependem de serviço Socket.IO operacional; podem ser simulados localmente, mas não validados por inspeção da especificação.

**Situação desta entrega:** critérios e cenários documentados; execução QA pendente; nenhuma aprovação funcional concedida.
