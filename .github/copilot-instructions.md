# Diretrizes do projeto

## Contexto

- Consulte [specification.md](../specification.md) como fonte principal de requisitos e decisões técnicas.
- O produto é um sistema para restaurante com back-office web e app Android, ambos offline-first; priorize continuidade operacional mesmo com rede instável.
- A arquitetura especificada é um monorepo Turborepo/pnpm com Next.js, Expo/React Native, PostgreSQL/Prisma, packages compartilhados e serviço Socket.IO.
- O workspace contém atualmente a especificação do produto. Não presuma que aplicações, comandos ou infraestrutura já existam: confira os arquivos presentes antes de implementar ou validar.

## Trabalho em equipe

- Use os agentes especializados em `.github/agents/` quando a tarefa exigir aquela especialidade; respeite suas áreas e envolva os papéis relacionados quando necessário.
- Analista de Sistemas transforma necessidades em requisitos e fluxos verificáveis e pesquisa na web boas práticas e referências para regras de negócio, citando fontes confiáveis; Designer UX/UI cuida dos fluxos, acessibilidade e consistência; Product Owner define critérios de aceite e valida o produto.
- Frontend Web e Frontend Mobile são responsáveis por suas plataformas. Backend API/Domínio, Dados/Sincronização e Tempo Real/Integrações são especializações distintas do backend. DevOps cuida de CI/CD, ambientes e deploy.
- Resolva divergências com a especificação antes de introduzir novas decisões. Destaque lacunas relevantes em vez de inventar comportamento de negócio.

## Qualidade

- Preserve escrita local-first, sincronização em background, idempotência e tratamento explícito de conflitos onde aplicável.
- Reutilize tipos, schemas Zod e regras de domínio compartilhados entre plataformas.
- Considere acessibilidade WCAG 2.1 AA, segurança de credenciais e validação no servidor.
- Para mudanças de código, valide o comportamento com os testes, lint, typecheck ou build disponíveis no workspace; não invente resultados nem comandos.
- Comunique-se em português brasileiro, mantendo nomes de APIs, identificadores e termos técnicos originais quando apropriado.
