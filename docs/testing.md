# Executar e testar a versão desktop

Este fluxo inicia um PostgreSQL local, cria o restaurante e o primeiro ADMIN,
adiciona mesas de demonstração somente em desenvolvimento e inicia a interface
web. Não há credenciais padrão: o operador escolhe a senha do ADMIN no CLI.

## Requisitos

- Windows 10/11 com Docker Desktop iniciado (ou PostgreSQL 16 acessível)
- Node.js 22+
- pnpm 12+

## Primeira execução local (PowerShell)

Na raiz do workspace, o arquivo `.env` guarda as configurações locais e é
ignorado pelo Git. Para uma instalação nova, copie o exemplo e substitua os
valores de exemplo por segredos locais; use uma senha hexadecimal aleatória
para `13AXIS_DB_PASSWORD` e gere `AUTH_SECRET` com pelo menos 32 bytes aleatórios.
Não reutilize credenciais de outros serviços nem compartilhe o `.env`.

```powershell
Copy-Item .env.example .env
```

O Docker Compose lê o `.env` da raiz automaticamente. Para que comandos Prisma
e CLIs Node executados nesta janela também recebam as variáveis:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    $name = $Matches[1]
    $value = $Matches[2].Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    Set-Item -Path "Env:$name" -Value $value
  }
}

docker compose up -d postgres
```

O Next.js carrega o `.env` da raiz ao iniciar. `DATABASE_URL` deve apontar para `127.0.0.1:55432`; a senha nela precisa ser URL-encoded. Mantenha `13AXIS_DB_PASSWORD` igual à senha usada na primeira inicialização do volume PostgreSQL.

Instale dependências e aplique as migrations:

```powershell
pnpm install
pnpm --filter @13axis/database db:migrate:deploy
```

Crie o restaurante e o ADMIN. O comando pede nome, email, nome de exibição e
senha; a senha não aparece enquanto é digitada:

```powershell
pnpm --filter @13axis/database create-admin
```

Adicione 12 mesas para teste. Este comando só funciona com `NODE_ENV=development`,
recusa restaurantes que já tenham mesas ativas e não deve ser usado em produção:

```powershell
$env:NODE_ENV = "development"
pnpm --filter @13axis/database seed:demo-tables
```

Crie categorias e produtos de demonstração para lançar nas comandas. O comando
também só funciona em desenvolvimento e recusa restaurantes que já tenham
categorias ou produtos ativos:

```powershell
pnpm --filter @13axis/database seed:demo-menu
```

Abra as comandas numeradas de demonstração **20 a 29**. O seed é idempotente:
mantém as comandas existentes e cria somente os números que ainda não estão
abertos. Execute apenas contra o banco local de desenvolvimento:

```powershell
$env:NODE_ENV = "development"
pnpm --filter @13axis/database seed:demo-orders
```

Inicie somente o back-office web:

```powershell
pnpm --filter @13axis/web dev
```

Abra **http://localhost:3000** no navegador e entre com o email e senha
escolhidos no `create-admin`. A sessão usa cookie seguro gerenciado pelo Auth.js.

## Cenários manuais de verificação

1. **Login válido:** entre com as credenciais do ADMIN. A área operacional deve
   carregar as mesas persistidas; não deve mostrar os dados fictícios antigos
   como se fossem reais.
2. **Login inválido:** saia e tente uma senha errada. Nenhuma sessão é criada e
   a mensagem não deve revelar se o email está cadastrado.
3. **Acesso sem sessão:** em janela anônima, abra `/api/tables` e
   `/api/orders`. Ambas devem responder `401` como `application/problem+json`.
4. **Visão Comanda:** abra uma comanda independente. Ela deve aparecer sem
   mesa associada; não deve ser necessário cadastrar ou selecionar mesa.
5. **Visão Mesa:** confirme que são exibidas somente mesas, sem comandas,
   contagem de comandas ou ação para abrir comanda.
6. **Visão Mesa + comanda:** abra uma comanda pela mesa. Ela deve aparecer
   associada à mesa, e novas comandas continuam permitidas na mesma mesa.
   Comandas abertas sem mesa também aparecem como “Sem mesa”. Mesas reservadas
   ou em fechamento não podem receber comandas vinculadas.
7. **Lançar produto:** selecione um produto ativo, informe quantidade e, se
   necessário, observação. O item e o total devem aparecer após o lançamento e
   continuar corretos depois de atualizar a página.
   No cadastro do Cardápio (`/menu`), como ADMIN, crie por exemplo “Buffet
   Livre” por `64,90` e “Buffet por KG” por `94,90`. Na busca do produto, os
   produtos prioritários aparecem primeiro; ao não encontrar um produto, só o
   ADMIN deve ver a opção de cadastrá-lo. Confirme que abrir uma comanda mostra
   o formulário e posiciona o foco na busca de produto.
   Para o buffet por quilo, informe quantidade `0,340`; o lançamento deve
   aceitar a vírgula decimal e calcular o subtotal como `R$ 32,27`.
   Tente cadastrar o produto com um usuário MANAGER: a interface não deve
   oferecer o cadastro e `POST /api/menu-items` deve responder `403`.
8. **Editar ou excluir item pendente:** os itens e ações aparecem diretamente
   na lista principal de cada comanda. Use Editar para alterar quantidade ou
   observação antes do envio à cozinha; confirme que o subtotal e o total da
   comanda são atualizados. Use Excluir e confirme para remover o item e
   subtrair seu subtotal. Itens que já tenham status de cozinha não podem ser
   alterados por este fluxo.
9. **Concorrência:** altere um item em duas sessões ou envie duas alterações
   usando a mesma versão. A segunda alteração deve retornar `409` sem sobrescrever
   silenciosamente o estado mais recente.
10. **Preço e validação:** altere o preço enviado pelo cliente ou tente informar
    um produto de outro restaurante/inativo; a API não aceita preço do cliente
    nem produto indisponível. Quantidade precisa ser positiva e ter no máximo
    três casas decimais.
11. **Idempotência:** repetir a mesma solicitação `POST /api/orders` ou
    `POST /api/orders/{orderId}/items` com o mesmo UUID v7 deve retornar o
    registro existente, sem duplicá-lo; reutilizar o ID com conteúdo diferente
    deve retornar `409`.
12. **Escopo do restaurante:** confirme que respostas da sessão não contêm
    `passwordHash`, e que o corpo da API não pode escolher outro
    `restaurantId`/`role`.
13. **Logout:** saia e confirme que `/api/tables` volta a responder `401`.
14. **Propriedades da visualização:** em Gestão de Mesas/Comandas, confirme que
    a visão inicial é **Comanda**. Em **Propriedades**, alterne para **Mesa** e
    **Mesa + comanda**, atualize a página e confirme que a seleção permanece.
    Entre com outro usuário e confirme que a preferência dele é independente.
    Sem sessão, `PATCH /api/preferences/tables-comandas-view` deve responder
    `401`; valores fora de `COMANDA`, `MESA` e `MESA_E_COMANDA` devem responder
    `400`.
15. **Cards e detalhamento:** na visão **Mesa**, confirme que as mesas aparecem
    em cards compactos com situação e capacidade, sem comandas ou itens. Nas
    visões **Comanda** e **Mesa + comanda**, confirme que as abas **Mapa +
    Cards**, **Mapa + detalhamento** e **Cards** alternam a apresentação. As
    duas primeiras mostram a grade de números; **Mapa + Cards** exibe os cards
    com os 3 itens mais recentes, **Mapa + detalhamento** mantém o mapa à
    esquerda e mostra à direita o resumo completo da comanda selecionada, e
    **Cards** oculta a grade. Em **Mapa + Cards**, confirme
    que cada comanda mostra ações **Editar**/**Excluir** para itens ainda
    pendentes. **Adicionar item** abre o formulário rápido. **Ver comanda**
    abre um diálogo com produtos, quantidade, preço unitário e total atual.
    Taxa de garçom e desconto devem aparecer como “Não configurada(s)” e não
    ser aplicados ao total. Confirme que o diálogo fecha pelo botão e pela tecla
    Escape. Clique também em uma comanda verde na grade: deve abrir o mesmo
    diálogo usando os itens e totais já carregados na página.
    Em **Mapa + detalhamento**, selecione uma comanda verde e confirme que o
    painel direito mostra o mesmo conteúdo do diálogo, incluindo todos os
    itens, totais, registro de pagamento e fechamento para perfis com
    permissão. A seção **Registrar pagamento** deve iniciar expandida, mostrar o
    total da comanda, os campos de valor e forma de pagamento e o botão para
    recolher/reexpandir. Confirme também que **Fechar comanda** abre uma
    confirmação compacta (“Deseja realmente fechar esta comanda?”) em vez de
    fechar imediatamente; **Cancelar** mantém a comanda aberta. Edite a
    quantidade ou observação de um item pendente, exclua um
    item com confirmação e use **+ Adicionar produto** para abrir o formulário
    do painel; confirme que ele começa recolhido e que **Cancelar** e
    **Fechar** o recolhem sem lançar o item. No campo **Produto**, digite parte
    do nome, selecione uma sugestão e confirme que a seleção fica ativa. Digite
    um nome inexistente, use **Cadastrar “…”**, informe categoria e preço,
    salve e confirme que o novo produto fica selecionado. Adicione um produto e
    confirme que os totais são atualizados e que o campo **Produto** volta ao
    estado vazio, com quantidade redefinida para 1 e observação limpa.
    Selecione outra comanda verde no
    mapa e confirme que o painel troca de conteúdo; números cinza exibem a
    confirmação no painel direito, com o botão **Abrir comanda** à direita.
    Abra uma comanda cinza e confirme que o painel passa a mostrar os detalhes
    dela.
16. **Atualização em tempo real:** abra a mesma tela em duas sessões autenticadas
    do mesmo restaurante. Confirme que a tela mostra “Atualizações em tempo real
    ativas”. Adicione, edite e exclua um item na primeira sessão; os cards e um
    diálogo aberto na outra sessão devem atualizar automaticamente sem recarga
    manual. Com o Socket.IO indisponível, a tela deve indicar reconexão e
    reconciliar os dados periodicamente enquanto estiver visível.
    No desenvolvimento, confirme que `REALTIME_JWT_SECRET` é compartilhado
    pelos processos web e realtime, `REALTIME_CORS_ORIGINS` inclui
    `http://localhost:3000` e as URLs de Socket.IO/publicação estão configuradas
    conforme o README.
17. **Comandas numeradas:** em **Propriedades**, confirme a lista inicial
    `{20-110}` e configure `{1-30}`, `[{1-30}, 50, 60, 90]` e
    `1,2,3,4,5,6`. A lista deve ser compartilhada por usuários do mesmo
    restaurante. A grade mostra até 100 números por página; números abertos
    ficam verdes e os demais cinza. Clique em um número cinza, confirme a
    abertura e verifique que a comanda correspondente e o formulário de
    adicionar produto são abertos. Clique em um número verde para abrir o
    diálogo da comanda. Tente abrir o mesmo número em outra sessão: a operação
    deve retornar conflito, sem criar duas comandas. Números com comandas abertas
    devem continuar visíveis mesmo após remover esses números da configuração.
    O índice reserva números somente para comandas abertas; a reutilização após
    fechamento poderá ser validada quando o fluxo de fechamento estiver disponível.
    Formatos inválidos devem apresentar uma mensagem de validação.
18. **Preferência de números sem sessão:** `PATCH /api/preferences/comanda-numbers`
    deve responder `401` sem autenticação. Com sessão, envie uma sequência
    válida no corpo `{ "comandaNumbers": "[{1-30}, 50]" }`; a resposta deve
    confirmar a lista salva.
19. **Seed de comandas para testes:** com `NODE_ENV=development`, execute
    `pnpm --filter @13axis/database seed:demo-orders` duas vezes. A primeira
    execução deve completar as comandas 20 a 29; a segunda não deve criar
    duplicatas. Confirme que o comando recusa execução com `NODE_ENV` diferente
    de `development`.

Os endpoints são acessíveis no navegador em `/api/tables` e `/api/orders`;
operações autenticadas são mais fáceis de exercitar pela interface, que mantém
os cookies de sessão. O app desktop atual suporta login, consulta e abertura de
mesas/comandas, lançamento de produtos com quantidade e observação, e edição ou
remoção de itens ainda pendentes de envio. Pagamentos, fechamento de comandas,
sincronização offline e KDS conectado ainda não fazem parte deste fluxo testável.

## Outros comandos de validação

Na raiz, usando as mesmas dependências instaladas:

```powershell
pnpm --filter @13axis/shared test
pnpm --filter @13axis/database db:validate
pnpm --filter @13axis/database typecheck
pnpm --filter @13axis/web test
pnpm --filter @13axis/web lint
pnpm --filter @13axis/web typecheck
pnpm --filter @13axis/web build
```

O typecheck/build da web exigem que o pacote compartilhado e o cliente Prisma
tenham sido compilados/gerados. O script `pnpm install` mantém a política de
idade mínima de pacotes vigente; não a desative para contornar erros de lockfile.

Os testes unitários de `src/components/orders-tables` cobrem as ações do store
Zustand contextual, a busca de produtos e a montagem/paginação da grade de
comandas, sem depender de renderização de componentes.

## Persistência e limpeza

O volume Docker `13axis-postgres` preserva os dados entre reinicializações.
`docker compose stop` interrompe o banco sem apagar dados. Não remova volumes
que contenham dados de que você precisa. Use um banco separado para qualquer
teste destrutivo ou de migration/backfill.

### Recriar o banco local do zero (destrutivo)

Estes comandos apagam restaurantes, usuários, mesas, cardápio e comandas.
Execute somente em desenvolvimento, com os apps parados e após confirmar que
não precisa preservar os dados.

Reset completo, removendo também o volume Docker:

```powershell
docker compose down -v
docker compose up -d --wait postgres
pnpm --filter @13axis/database db:migrate:deploy
pnpm --filter @13axis/database db:generate
pnpm --filter @13axis/database create-admin
```

Para recriar apenas o schema, mantendo o container e o volume:

```powershell
docker compose up -d --wait postgres
docker compose exec -T postgres psql -U 13axis -d 13axis -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pnpm --filter @13axis/database db:migrate:deploy
pnpm --filter @13axis/database create-admin
```

Alternativa com Prisma, que apaga o schema, reaplica as migrations e regenera o
cliente:

```powershell
docker compose up -d --wait postgres
pnpm --filter @13axis/database exec prisma migrate reset --force --skip-seed
pnpm --filter @13axis/database create-admin
```

Depois de qualquer reset, os dados de demonstração precisam ser recarregados:

```powershell
$env:NODE_ENV = "development"
pnpm --filter @13axis/database seed:demo-tables
pnpm --filter @13axis/database seed:demo-menu
pnpm --filter @13axis/database seed:demo-orders
```
