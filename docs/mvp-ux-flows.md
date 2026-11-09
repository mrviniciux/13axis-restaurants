# Fluxos UX — primeiro produto utilizável do 13axis

**Escopo:** back-office web para preparar a operação e acompanhar a cozinha; app Android para o garçom consultar mesas/comandas, lançar itens e encaminhar pedidos.  
**Base:** `specification.md`, especialmente princípios (1.2), papéis/permissões (4), mesas e comandas (5.1), cardápio (5.2), KDS (5.3), sincronização (7), tempo real (8), acessibilidade (11), roadmap (14) e pontos em aberto (16).  
**Status:** proposta de UX, não especificação de regras de negócio. Onde a especificação não determina a regra, a interface deve aguardar decisão indicada em **Lacunas para confirmação**; não presumir um padrão silenciosamente.

## 1. Objetivo e recorte do MVP

Entregar o menor fluxo ponta a ponta que permita preparar e operar uma pista:

1. Um gerente/admin acessa o web, cadastra ou revisa mesas e cardápio e confere os pedidos no KDS.
2. Um garçom autenticado abre o mapa no Android, consulta uma mesa, seleciona uma comanda aberta ou abre outra, inclui itens e envia o pedido à cozinha.
3. O garçom acompanha o estado recebido e identifica claramente o que ainda está no aparelho e o que foi confirmado pelo servidor.

### Incluído no desenho

- Autenticação e acesso conforme perfil existente.
- Configuração mínima de mesas e cardápio no web, para que o app tenha dados operáveis.
- KDS web básico: fila, identificação da mesa, itens, observações e estado definido pela cozinha.
- Mapa de mesas, lista das comandas abertas por mesa, seleção de uma existente ou abertura de outra, inclusão de produtos, revisão e envio no Android.
- Indicadores consistentes de conectividade, fila de sincronização e falha; operações locais não devem ser apresentadas como confirmadas pelo servidor.

### Fora do fluxo inicial

Pagamentos/fechamento financeiro, divisão de conta, transferência de itens ou mesa, reservas/lista de espera, balança, estoque, relatórios, importação com IA, delivery, notificações sonoras e gestão avançada de funcionários. Estão descritos na especificação, mas não são necessários para validar este primeiro fluxo; a inclusão de qualquer um depende de priorização e das decisões em aberto. Não desenhar controles sem ação funcional.

### Provisionamento inicial — operador/desenvolvedor (fora do fluxo do restaurante)

- A primeira configuração é feita por um comando CLI interativo destinado ao operador/desenvolvedor, não por uma tela de cadastro ou onboarding do gerente no produto.
- O comando solicita o nome do restaurante e a senha inicial do ADMIN de forma interativa. A senha é lida sem exibi-la no terminal e armazenada somente após hash Argon2id; não há credenciais padrão.
- Criar o restaurante e seu primeiro ADMIN como uma operação atômica: sucesso confirma a configuração inicial; falha não deve deixar apenas uma das entidades criada. A interface do CLI pode informar o resultado e o nome do restaurante, mas nunca imprimir, repetir ou registrar a senha.
- Após o provisionamento, o ADMIN usa o fluxo normal de entrada no back-office com a senha que escolheu. Não exibir credenciais ou segredos na tela de login, em mensagens de sucesso ou em logs visíveis ao usuário.

## 2. Princípios de experiência

- **Ação primeiro, rede em segundo plano:** no Android, guardar localmente cada edição permitida e manter o garçom no fluxo. Mostrar estado pendente até confirmação; “salvo no aparelho” não equivale a “pedido enviado à cozinha”.
- **Estados explícitos:** distinguir rascunho local, envio pendente, confirmado pelo servidor, atualização recebida e falha que exige atenção.
- **Orientação por tarefa:** pista usa poucos passos, controles grandes e informação essencial; back-office privilegia contexto, configuração e visão de fila.
- **Sem inferir política:** múltiplas comandas abertas por mesa são permitidas no MVP, sem limite numérico configurável; a interface não decide regras de fechamento, se um item indisponível pode ser enviado, quem marca “servido”, nem como resolver uma comanda editada em dois aparelhos.
- **Consistência:** mesma nomenclatura, identificação de mesa/comanda e significado de status em web e mobile. Cores são reforço, nunca único canal.

## 3. Navegação e hierarquia

### Web — gerente/admin (desktop)

**Estrutura persistente**

- Barra superior: nome do produto/restaurante (se definido), usuário/perfil e indicador de conexão/sincronização web.
- Navegação lateral com seções do MVP: **Visão geral**, **Cardápio**, **Mesas**, **Cozinha (KDS)**. Mostrar somente destinos disponíveis ao perfil; itens sem implementação não devem aparecer como se estivessem ativos.
- Conteúdo principal com título, contexto e ação primária única por tela.
- Em telas estreitas, recolher a navegação lateral em menu acessível; manter título, contexto e ação primária visíveis sem rolagem horizontal.

**Visão geral:** resumo operacional limitado a informação realmente disponível. Se não houver métricas definidas, usar atalhos (Cardápio, Mesas, KDS) em vez de números inventados.

**Cardápio:** lista pesquisável de categorias/itens, filtros de disponibilidade e ação “Novo item”/“Nova categoria”. Criar/editar em página ou painel amplo com campos agrupados: identificação, descrição, preço, categoria, disponibilidade, variações/adicionais e composição/horários apenas se estes comportamentos forem incluídos no MVP. A especificação não determina campos obrigatórios, formatos, exclusão ou regras de preço; validar somente requisitos confirmados.

**Mesas:** lista em tabela para cadastro e revisão da configuração; mapa visual de status pertence principalmente à operação mobile. Se uma visualização de mapa for fornecida no web, oferecer também tabela equivalente e controles por teclado (não depender de arrastar e soltar). Não permitir alterar status operacional por uma tela administrativa sem definir quem pode fazê-lo.

**KDS:** fila de pedidos em colunas ou lista por estado, com mesa/comanda, nome e quantidade dos itens, observações, tempo decorrido e estado. A prioridade e limite de alerta só aparecem após definição. Ações de status devem ser claras e apresentar confirmação visual; não avançar automaticamente com base em tempo.

### Android — garçom

Navegação curta e previsível, com destinos principais **Mesas** e **Pendências** (fila local/envios que precisam de atenção). Evitar menu escondido como única entrada para tarefa frequente. A tela de pendências pode ser uma seção da tela de mesas se a densidade não prejudicar a leitura.

1. **Entrar:** autenticar o usuário já provisionado; o bootstrap inicial não é um fluxo de cadastro dentro do app. Apresentar falha de autenticação sem expor detalhes técnicos ou credenciais. O acesso offline após reinício, expiração da sessão ou troca de usuário depende de política a confirmar.
2. **Mesas:** mapa em grade que se adapta à largura, com alternativa em lista. Cada cartão mostra número/nome confirmado e estado textual. Ao abrir uma mesa, exibir a lista de suas comandas abertas.
3. **Comandas da mesa:** listar as comandas abertas com identificação suficiente para o garçom escolher a correta, sem presumir limite numérico ou regra de fechamento. Oferecer ações distintas para **selecionar uma comanda existente** e **abrir outra comanda**. A mesa pode ter várias comandas abertas simultaneamente.
4. **Comanda selecionada:** cabeçalho persistente com mesa e identificação da comanda; itens com nome, quantidade e estado local/de envio; total somente se os preços e regras de cálculo estiverem definidos. Ação primária “Adicionar itens”; ação de envio fica visível ao revisar.
5. **Adicionar itens:** categorias navegáveis, busca por nome e lista de produtos com nome, preço (se definido) e disponibilidade. Selecionar produto atualiza um resumo/cartão de seleção; oferecer edição de quantidade e observação apenas conforme regra aprovada. A ação “Adicionar à comanda” grava a seleção localmente e retorna à comanda ou permite continuar escolhendo, sem perder o contexto.
6. **Revisar e enviar:** resumo dos itens ainda não enviados, identificação da mesa e da comanda selecionada e ação “Enviar pedido à cozinha”. Antes do envio, permitir corrigir/remover somente os itens/estados que a regra aprovada considerar editáveis. Enquanto offline, deixar explícito se o usuário está apenas enfileirando localmente ou se o envio não é permitido sem rede (decisão pendente). Nunca mostrar “enviado” antes da confirmação do servidor.
7. **Acompanhar:** estado do pedido/item apresentado na comanda em texto e com ícone/cor; atualizar ao receber evento ou resposta de sincronização. Informar quando o estado exibido pode estar desatualizado.

## 4. Estados de tela e feedback

### Compartilhados

- **Carregando:** esqueleto/lista com dimensão estável e rótulo acessível; não bloquear navegação por animações longas. Ações locais existentes continuam acessíveis.
- **Vazio inicial:** explicar o que falta e oferecer ação adequada (“Cadastrar mesas”/“Criar item”) para perfil autorizado. Sem ação disponível, explicar a quem solicitar acesso.
- **Sem resultados:** diferenciar de coleção vazia; oferecer limpar busca/filtros.
- **Erro recuperável:** frase direta, consequência e ação concreta (tentar novamente, editar ou consultar pendências); preservar dados digitados.
- **Erro não recuperável/conflito:** manter a operação visível, explicar que requer revisão e não descartá-la. Não oferecer “tentar de novo” em ciclo infinito.
- **Atualização externa:** informar que a mesa, comanda ou item mudou em outro dispositivo e atualizar a visão de forma não disruptiva. Se houver edição local conflitante, conservar o rascunho e sinalizar revisão necessária.

### Estados de mesas/comandas no Android

- **Livre / ocupada / reservada / em fechamento:** texto sempre presente; cores e ícones apenas complementares. O que significa “em fechamento” e como interage com abertura precisa de definição.
- **Mesa sem comanda local disponível:** diferenciar de livre no servidor e de dados ainda não carregados.
- **Comanda aberta:** mostrar itens e status; indicar quais itens não foram sincronizados.
- **Sem cardápio em cache:** estado de bloqueio informativo para adicionar itens, não lista vazia indistinguível. Explicar a necessidade de obter o cardápio quando houver conexão.
- **Item indisponível ou cardápio alterado:** não assumir comportamento de envio. Identificar a versão/dado desatualizado e pedir atualização/revisão conforme política definida.

## 5. Offline, sincronização e conflitos

### Android

Indicador persistente, visível e acessível em todas as telas de operação:

- **Conectado / sincronizado:** última atualização concluída, sem fila pendente.
- **Sincronizando:** quantidade de ações pendentes, quando disponível; nunca usar spinner indefinido sem texto.
- **Offline:** faixa ou chip “Sem conexão — alterações ficam neste aparelho” apenas se a escrita local foi realmente persistida. Diferenciar ações locais de envio confirmado.
- **Pendente:** badge em mesa/comanda e seção de pendências; ao abrir, listar ação afetada e horário local, quando disponível. A fila não deve desaparecer ao navegar ou fechar/reabrir o app.
- **Falha de sincronização:** indicar tentativa pendente e ação segura para tentar novamente. Preservar dados e evitar duplicar uma mutação ao repetir.
- **Conflito / rejeição do servidor:** exibir informação atual recebida e alteração local envolvida; não sobrescrever silenciosamente. A resolução operacional de conflitos deve aguardar regra definida.
- **Reconexão:** sincronizar em segundo plano, atualizar telas sem interromper a tarefa e anunciar um resumo não intrusivo (“Conexão restabelecida; 2 ações pendentes”) por região acessível. Confirmar individualmente o que foi aceito/rejeitado.
- **Evento em tempo real perdido:** após retorno/conexão, reconciliar snapshot; não deduzir que o estado não mudou só porque nenhum evento chegou.

Se uma ação não tiver suporte offline, desabilitar ou explicar a indisponibilidade no ponto da tarefa, em vez de aceitar e apagar depois. Antes de fechar o app ou sair da sessão com fila pendente, oferecer aviso claro; não descartar a fila.

### Web

A especificação declara web/PWA offline-first, mas também coloca PWA, Service Worker e refinamento offline na Fase 6. Para o MVP, projetar e rotular o estado conforme a capacidade que existir no produto entregue:

- Se o MVP web não tiver persistência offline implementada, indicar indisponibilidade da rede e preservar formulário local enquanto a página permanecer aberta; não anunciar “salvo offline”.
- Se escrita offline for entregue, reproduzir estados de pendência, confirmação, erro e conflito do mobile, com status por alteração e fila visível.
- Em ambos os casos, não permitir que o estado visual sugira que uma alteração no cardápio/mesas está disponível nos dispositivos antes da confirmação necessária. Definir o que significa a atualização chegar aos garçons.

### Erros por etapa

| Situação observável                                     | Resposta de interface                                                                                                                          |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Falha ao carregar mapa/cardápio                         | Manter dados em cache se existentes e indicar quando foram atualizados; sem cache, explicar o próximo passo.                                   |
| Falha ao gravar item localmente                         | Não simular inclusão; manter seleção e oferecer tentar novamente.                                                                              |
| Envio pendente sem conexão                              | Exibir explicitamente se a fila local aceitou o pedido; não informar a cozinha como notificada.                                                |
| Servidor rejeita ou retorna comanda já alterada/fechada | Preservar tentativa, mostrar estado atual e solicitar ação humana conforme regra aprovada; não repetir envio automaticamente sem idempotência. |
| Falha ao salvar formulário web                          | Manter campos preenchidos, indicar campos inválidos junto ao campo e oferecer nova tentativa.                                                  |
| Falha de login/permissão                                | Explicar que o acesso não foi concluído e apontar suporte/administração; esconder controles sem permissão.                                     |

## 6. Acessibilidade e interação

### Web

- Meta WCAG 2.1 AA conforme especificação; contraste mínimo de 4.5:1 para texto normal e 3:1 para texto grande/elementos visuais relevantes.
- Ordem de tabulação acompanha a leitura; foco sempre visível, não encoberto e restaurado após fechar diálogo. Escape fecha modal não destrutivo; foco retorna ao acionador.
- Radix/shadcn ajuda, mas não garante conformidade: nome acessível de ícones, labels associados, mensagens de erro vinculadas aos campos, estados `disabled`/`invalid` anunciados e validação com teclado/leitor de tela.
- Tabela do cardápio e fila do KDS possuem cabeçalhos semânticos; estado não é comunicado apenas por cor. Evitar atualização automática que mova foco ou interrompa leitura.
- Para modal de criação/edição, anunciar título, erro e resultado; não usar toast como único registro de erro persistente.

### Android

- Alvos de toque de pelo menos 44 × 44 px (conforme alvo da especificação), com espaçamento para evitar acionamento acidental; alvos de envio/status devem ser especialmente claros.
- Compatibilidade com TalkBack: nome, papel, estado e valor de controles; cartões de mesa anunciam mesa + estado + ação numa ordem compreensível. Não depender apenas de gesto, cor, som ou posição no mapa.
- Suportar ampliação de fonte e conteúdo rolável sem corte/overlap; considerar telas menores e orientação vertical; controles críticos permanecem visíveis sem exigir precisão.
- Feedback de seleção, gravação local, envio e falha deve ser anunciado sem mover o foco. Respeitar preferências de redução de movimento e não usar piscadas.
- Usar controles nativos React Native/Expo e comportamento esperado de voltar; confirmar antes de descartar alterações, não para toda ação reversível.

### Ambos

- Linguagem curta, consistente e operacional; datas/horários legíveis e preços com formato local apenas após definição da moeda.
- Não usar apenas vermelho/verde. Combinar texto, ícone e estado.
- Testar contraste, teclado, leitor de tela (NVDA/VoiceOver na web conforme plataforma; TalkBack no Android), zoom/fonte ampliada, alvos de toque, orientação e estados offline reais antes da liberação.

## 7. Comportamento responsivo

- **Back-office:** priorizar desktop; larguras menores substituem sidebar por menu, empilham filtros e formulários e permitem tabela com colunas prioritárias/reflow, sem ocultar estado ou ação principal. KDS para tablet usa cartões/colunas responsivas; manter contraste e alvos de toque ampliados.
- **Android:** primeiro desenho para retrato e uso com uma mão. Mapa adapta colunas ao espaço, mas sempre oferece lista equivalente. Comanda mantém acesso claro ao resumo e botão principal; rolagem de itens não deve esconder o estado de conexão.
- Em ambas, não depender de hover, arrastar e soltar ou tooltip como única forma de acessar informação/ação.

## 8. Lacunas de negócio que exigem confirmação

Resolver antes de fixar rótulos, ações finais ou critérios de aceite:

1. **Comanda e mesa:** decisão confirmada para o MVP: permitir múltiplas comandas abertas na mesma mesa, sem configuração de cardinalidade e sem limite numérico definido. Falta confirmar como identificar cada comanda para seleção confiável, o que significa abrir outra comanda quando a mesa já tem comandas abertas e qual regra de fechamento libera a mesa; não inferir essas regras na interface.
2. **Abertura offline:** pode abrir outra comanda sem rede? Se sim, como apresentar/resolver aberturas concorrentes se outro dispositivo abrir ou fechar uma comanda no intervalo? A política de fechamento continua a confirmar.
3. **Envio à cozinha sem rede:** pode enfileirar pedido local para envio posterior ou deve exigir rede? Qual aviso evita que o garçom pense que a cozinha recebeu?
4. **Rascunho versus envio:** inclusão de item fica como rascunho até tocar “Enviar”? Quais itens podem ser editados/excluídos antes/depois do envio, e como enviar novas rodadas à mesma comanda?
5. **Papel do status:** quem pode marcar item como servido? Garçom pode alterar “enviado/em preparo/pronto”? KDS avança item individual ou pedido inteiro? O fluxo lista enviado → em preparo → pronto → servido, enquanto KDS descreve novo → preparando → pronto.
6. **Disponibilidade e preços:** quais campos são obrigatórios, moeda, arredondamento, impostos/taxas, variações/adicionais e comportamento se preço/disponibilidade mudar após cache ou inclusão?
7. **Quantidade e observações:** permitir quantidade fracionária, observações e modificadores no MVP? Há validações/limites?
8. **Transferência e edição concorrente:** transferência de mesa/itens está incluída? Como o usuário entende e resolve alteração simultânea e rejeição por versão; qual operação é considerada exclusiva?
9. **Fechamento e pagamento:** fechamento, divisão de conta e recebimento estão fora do fluxo inicial? Se algum for necessário ao primeiro uso, definir responsáveis/permissões e pré-condições.
10. **Reserva:** como “reservada” afeta o mapa, se o módulo de reservas não está no primeiro recorte? Quem pode liberar/ocupar essa mesa?
11. **Permissões:** garçom pode editar/excluir comanda e receber pagamento parcial (perfil) versus permissões RBAC listadas? Definir permissões exatas e feedback de ação negada.
12. **Sessão offline:** duração da sessão, reautenticação e acesso a dados locais quando dispositivo é compartilhado/perdido; comportamento após logout com mutações pendentes.
13. **Web offline:** quais páginas e mutações realmente operam sem rede no MVP, qual política de cache e como conflito é resolvido? O roadmap posterga PWA/offline para Fase 6.
14. **Operação web/KDS:** o gerente precisa de quais indicadores iniciais? Haverá perfil de cozinha no MVP? Alertas sonoros/limite de tempo/prioridade entram agora?
15. **Atualização do menu:** quando uma edição web passa a valer no Android e como lidar com pedido em rascunho baseado em versão anterior?

## 9. Critérios observáveis de validação UX

- Garçom consegue localizar uma mesa, distinguir seu estado, ver as comandas abertas, selecionar uma existente ou abrir outra, e identificar itens pendentes sem depender exclusivamente de cor.
- Inclusão offline (quando autorizada) continua visível após navegar e reabrir o app; falha de persistência não finge sucesso.
- Cada item/pedido mostra diferença perceptível entre rascunho local, envio pendente, confirmado e rejeitado.
- Reconexão sincroniza sem bloquear navegação, sem duplicar envio e sem apagar dados; resultado de conflitos é explicado.
- A cozinha só vê como recebido o que o servidor confirmou; o app não confunde fila local com evento entregue.
- Um operador web consegue localizar e editar dados do MVP; erros preservam campos, e alterações confirmadas têm feedback.
- Rotas essenciais são utilizáveis por teclado na web e TalkBack no Android; foco, rótulos, mensagens e alvos atendem à meta definida.
- Em viewport reduzido/fonte ampliada, ações principais, estados e conteúdo não se sobrepõem nem desaparecem.

**Dependências de produto:** confirmar as lacunas da seção 8 e o limite do MVP antes de transformar esta proposta em telas finais ou critérios funcionais. Este documento descreve experiência; não define API, infraestrutura ou regras do servidor.
