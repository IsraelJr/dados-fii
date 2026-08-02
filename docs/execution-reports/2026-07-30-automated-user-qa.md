# Relatório de execução — QA automatizado de usuário

**Data:** 30/07/2026
**PR:** #168 — draft
**Branch:** `agent/functional-qa-automation`
**Status de merge:** não recomendado; não fazer merge

## Auditoria e arquivos alterados

A auditoria inicial identificou e corrigiu regressão da decisão da PR #149 na Home, redação insuficiente de artefatos e dependência fixa de janeiro a junho. A rodada de 30/07 também eliminou quatro bloqueadores de segurança e cobertura: executor privilegiado dependente do SHA implantado, bypass da Vercel em header global, sessão Firebase sem renovação e relatório/PDF fora do gate de Preview.

Arquivos e áreas alterados:

- `src/app/components/Login.tsx` e `src/app/carteira/page.tsx`;
- nova rota/controller/política de sessão Firebase da carteira;
- Playwright, fixture de evidências, redator e teste sentinela;
- suíte funcional remota, helper de competências e regressões de calendário;
- workflow `functional-qa.yml`;
- runner privilegiado imutável em `functional-qa-runner.yml`, com três secrets obrigatórios mapeados nominalmente pelo dispatcher;
- política de origem e setup isolado do cookie de bypass da Vercel;
- cliente de sessão com renovação após ausência, expiração ou `401`, coordenação entre abas e logout propagado;
- testes arquiteturais e de política de sessão;
- relógio `asOf` determinístico para derivados de dividendos, com regressões de fevereiro e da virada dezembro/janeiro;
- documentação operacional, governança e este relatório.

A ampliação de entitlement nos controllers de relatório de risco foi removida. A mudança de sessão permaneceu na PR porque a autenticação real da carteira depende dela; isso constitui alteração funcional para todos os usuários e exige revisão explícita antes de qualquer merge.

## Lista real de testes criados

Testes Node:

- contrato arquitetural de isolamento, matriz, fail-closed, tags, Home e sessão;
- sentinela recursivo de `.trace`, `.network`, HAR, cookies, headers, storage e ZIP aninhado;
- competências encerradas em janeiro, fevereiro e virada dezembro/janeiro;
- duração de 12 horas, expiração, revogação lógica e isolamento por e-mail/token.

Jornadas Playwright remotas:

- `@smoke @critical` login válido, persistência, logout e bloqueio não autorizado;
- `@preview @full` login inválido, fora do smoke;
- `@preview @full` prova de usuário sem admin, isolamento, revogação e rejeição de identidade cliente;
- `@critical` carteira, histórico adaptativo, cards, gráfico, falha de rede, navegação, reload, persistência e cleanup;
- `@smoke @critical` consulta válida/inexistente/inválida e responsividade;
- `@full` relatório, persistência, PDF, erro sanitizado e ausência de recomendação;
- `@smoke @critical` axe nas telas principais.

## Jornadas e proteções cobertas

- Autenticação começa em `/carteira`; Login permanece oculto na Home.
- O dispatcher não faz checkout, não executa `npm`, shell ou scripts e transmite somente três Repository secrets dedicados ao contrato imutável. O SHA implantado é somente o alvo auditado.
- O runner privilegiado é referenciado por SHA completo e faz checkout de uma revisão imutável distinta do deployment.
- O bypass é usado em uma única requisição sem redirects à origem exata do Preview; o navegador recebe somente o cookie `_vercel_jwt`.
- Firebase, Google, analytics e qualquer origem externa recebem zero headers de bypass, conforme teste sentinela.
- Sessão ausente, expirada ou rejeitada com `401` é renovada com novo ID token Firebase; falha limpa a sessão e reapresenta Login.
- Abas concorrentes reutilizam a renovação válida e o logout é propagado sem recriar a sessão.
- Preview executa crítico e os testes `@preview`; produção diária nunca usa senha incorreta.
- Histórico usa somente meses efetivamente encerrados no fuso de São Paulo.
- Em janeiro a jornada não grava competência aberta; em fevereiro grava somente janeiro; quando fevereiro encerra, a exclusão/reinserção e o valor de R$ 450,03 são executados.
- A tentativa de criar sessão admin com o token real de QA deve retornar `403`.
- Trocar e-mail em localStorage mantendo o token deve retornar `401`; o token revogado no logout deve retornar `401`.
- Entitlement do relatório da carteira depende de `User.isVip === true` no servidor.
- `workers=1`, um retry somente na CI, cleanup idempotente e gate fail-closed permanecem.

## Secrets e provisionamento

Em 02/08/2026, a API do GitHub confirmou que os Environment secrets existiam, mas o reusable workflow os recebia vazios nessa topologia. A decisão vigente usa os Repository secrets dedicados `QA_PREVIEW_USER_EMAIL`, `QA_PREVIEW_USER_PASSWORD` e `QA_PREVIEW_VERCEL_BYPASS_SECRET`, transmitidos explicitamente para os três aliases obrigatórios do contrato. Não há `secrets: inherit`. Valores, tamanhos, hashes e fragmentos não são lidos nem registrados.

O usuário deve ser Firebase verificado, exclusivo de QA, ausente de `ADMIN_EMAILS` e de claims administrativos. O documento server-side pode receber `isVip: true` exclusivamente para a jornada de relatório. Nenhuma identidade enviada pelo cliente concede entitlement.

## Resultados

| Gate | Resultado da nova rodada |
|---|---|
| Teste sentinela de artefatos | aprovado |
| TypeScript | aprovado |
| ESLint | aprovado, zero warnings |
| `test:all` | aprovado: 628/628 |
| Firestore Rules | aprovado: 3/3 no Emulator |
| Cobertura crítica | aprovado: 100% linhas, 93,66% branches, 98,53% funções |
| Mutation sanity | aprovado |
| Build | aprovado com Firebase sintético em memória |
| HTTP smoke | aprovado: 200/400/401/403/404/405/503 e headers defensivos |
| Secret scan | aprovado: 649 arquivos versionados |
| E2E local | 30 descobertos: 16 aprovados em Desktop Chromium e Mobile Chrome; 14 remotos ignorados sem `E2E_BASE_URL` |
| E2E Preview real | run `30758552638`: preflight, sentinela e instalação Chromium/WebKit aprovados; bloqueado antes do login porque a Vercel recusou o bypass recebido |

A validação nova incluiu 17 testes direcionados de arquitetura, origem, renovação, falha, logout e múltiplas abas. A bateria completa passou sem retry. O primeiro build local falhou pela ausência intencional de configuração Firebase; a repetição com a mesma credencial sintética e as mesmas variáveis públicas usadas pela CI oficial passou.

Na rodada de 02/08/2026, quatro Previews novos comprovaram o mesmo bloqueio sem reutilizar cache: runs `30756572076`, `30756849179`, `30757027145` e `30757186956`. Foram testados contrato explícito, marcador homônimo, environment sem auto-deployment e marcador de namespace separado. Em todos, o runner imutável e o alvo Vercel foram validados, Production ficou ignorado e o preflight parou antes de dependências, sentinela, Chromium/WebKit, autenticação ou artefatos. O log informou somente os nomes ausentes; nenhum valor sensível foi exposto.

Na rodada da decisão por Repository secrets, os testes diretamente afetados passaram: 26/26 regressões de dados e arquitetura, sentinela de artefatos, ESLint, TypeScript e secret scan de 649 arquivos. A expectativa temporal de `REG-DEF-04` foi substituída por um `asOf` explícito, sem mudar a regra funcional; fevereiro e a virada dezembro/janeiro possuem regressões determinísticas. A bateria completa passou em 628/628, Firestore Rules em 3/3, mutation, build, HTTP e E2E local também passaram. A cobertura atingiu 100% de linhas, 93,66% de branches e 98,53% de funções.

O run novo `30758552638`, no HEAD `d7030611676effb2d2d66b3fa56e458470815163`, comprovou a entrega dos três Repository secrets: o preflight passou, o sentinela passou e Chromium/WebKit foram instalados. A inicialização segura recebeu redirecionamento para o SSO da Vercel, em vez do cookie `_vercel_jwt`; assim, nenhum teste, login ou cleanup autenticado iniciou. A falha publicou o gate vermelho corretamente.

A auditoria independente do artefato dessa falha expandiu o ZIP base64 interno do relatório HTML e encontrou uma categoria de e-mail que o redator anterior não alcançava. O artefato remoto `8836716154` foi removido de forma irreversível; o run permanece como registro. O redator e o sentinela agora expandem também o HTML Playwright, e a reaplicação local ao mesmo relatório retornou zero categorias sensíveis.

## Riscos restantes

### Correção das falhas funcionais observadas em 02/08/2026

O run full `30766752729`, no HEAD `6c67e467b6a6571daf597983b2bc1056fb9cfa7a`, comprovou entrega dos secrets, resolução do Preview, `_vercel_jwt`, preflight, instalação de Chromium/WebKit e redação segura, mas falhou na primeira jornada autenticada dos três projetos.

Causa raiz por navegador:

- **Desktop Chromium:** o `waitForRequest` aguardava `/api/user-profile`, porém a UI havia rejeitado a senha antes do submit por permitir somente letras e dígitos. A senha permaneceu mascarada e nenhum valor foi inspecionado ou registrado. A política do produto agora aceita caracteres especiais, mantendo letra, número e mínimo de seis caracteres.
- **Mobile Chrome:** o banner de consentimento permaneceu acima do formulário e interceptou o clique.
- **Mobile Safari/WebKit:** o mesmo banner e a relação do alvo com o header sticky impediam o clique normal em `Acessar Premium`.

Arquivos desta correção:

- `src/lib/users/WalletLoginPolicy.ts` e `src/app/components/Login.tsx`;
- `tests/e2e/fixtures.ts`, `functional-qa.spec.ts`, `critical-journeys.spec.ts` e `functional-qa-fixtures.spec.ts`;
- `playwright.config.ts`;
- `tests/wallet-login-policy.test.ts` e `tests/functional-qa-architecture.test.mjs`;
- `docs/engineering/functional-qa.md` e este relatório.

Regressões adicionadas:

- consentimento ainda não informado e consentimento já salvo/idempotente;
- clique sem `force` em viewport mobile com header fixo;
- resposta de perfil rápida e resposta ocorrida antes da espera funcional tardia;
- rejeição de resposta de rede sem UI e sessão autenticadas;
- senha Firebase com letra, número e caractere especial;
- contrato arquitetural proibindo `waitForRequest` exclusivo e `force: true` na jornada.

Resultados locais desta etapa:

- fixture: 12/12 em Desktop Chromium e Mobile Chrome;
- suíte local completa nesses dois projetos: 28 aprovados e 14 jornadas remotas ignoradas por ausência deliberada de credenciais locais;
- descoberta remota: 45 casos, exatamente 15 por projeto, sem ignorar as oito jornadas determinísticas;
- Mobile Safari local: WebKit instalado, mas a build congelada do host falhou antes de criar a página com `Unknown setting: PushAPIEnabled`; nenhuma jornada WebKit foi considerada aprovada localmente;
- TypeScript, ESLint e 16 testes focados de arquitetura/política: aprovados.

O resultado remoto final desta correção ainda depende de um novo Functional QA Preview full no HEAD publicado. A recomendação permanece negativa até 15/15 passarem nos três projetos e login, persistência, logout, renovação, isolamento e cleanup serem comprovados.

- A PR ainda contém alteração funcional de autenticação/sessão para todos os usuários; idealmente ela seria revisada ou separada antes do merge.
- A entrega dos três Repository secrets, o Automation Bypass vigente, a emissão de `_vercel_jwt` e o acesso ao Preview protegido já foram comprovados. A jornada autenticada corrigida ainda precisa ser repetida no runner remoto antes de qualquer recomendação positiva.
- `Functional QA Preview` ainda não está comprovado como required check de `main`.
- Vídeo é um formato binário e não pode ser redigido depois; a proteção depende da máscara visual instalada antes de qualquer preenchimento. O teste verifica a máscara, mas a execução real de Preview ainda é obrigatória.
- Serviços externos podem afetar consulta de fundos e geração do relatório.
- Em janeiro não existem competências do ano corrente encerradas; a jornada valida esse estado sem fabricar dados retroativos.

## Custo estimado de CI

Estimativa inicial: cerca de 520 minutos/mês para 26 smokes diários, quatro suítes semanais e até 12 Previews. O sentinela adiciona menos de um segundo de CPU por job na medição local. Recalibrar após 30 dias. Artefatos são gerados somente em falha e retidos por sete dias.

## Limitações

- Credenciais, conta Firebase e `User.isVip` não são criados pelo repositório.
- A prova real de `403` administrativo depende do usuário provisionado.
- O smoke de produção é curto e não executa senha inválida nem a jornada destrutiva completa.
- A suíte semanal continua mutando somente o usuário isolado e sempre executa cleanup.

## Recomendação de merge

Não fazer merge e não marcar a PR como pronta. A recomendação permanece negativa até todos os gates passarem, a suíte de Preview real comprovar os três dispositivos e a segurança do usuário de QA, e `Functional QA Preview` estar configurado como gate obrigatório.
