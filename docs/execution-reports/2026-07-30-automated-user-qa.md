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
- runner privilegiado imutável em `functional-qa-runner.yml`, separado do dispatcher sem secrets;
- política de origem e setup isolado do cookie de bypass da Vercel;
- cliente de sessão com renovação após ausência, expiração ou `401`, coordenação entre abas e logout propagado;
- testes arquiteturais e de política de sessão;
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
- O dispatcher não faz checkout, não executa `npm` e não recebe secrets. O SHA implantado é somente o alvo auditado.
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

Em 02/08/2026, a API do GitHub confirmou no environment literal `Preview` os registros `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` e `VERCEL_AUTOMATION_BYPASS_SECRET`, com timestamps posteriores às tentativas iniciais. Valores, tamanhos, hashes e fragmentos não foram lidos nem registrados. O provisionamento de `Production` não fez parte desta rodada.

O usuário deve ser Firebase verificado, exclusivo de QA, ausente de `ADMIN_EMAILS` e de claims administrativos. O documento server-side pode receber `isVip: true` exclusivamente para a jornada de relatório. Nenhuma identidade enviada pelo cliente concede entitlement.

## Resultados

| Gate | Resultado da nova rodada |
|---|---|
| Teste sentinela de artefatos | aprovado |
| TypeScript | aprovado |
| ESLint | aprovado, zero warnings |
| `test:all` | aprovado: 623/623 |
| Firestore Rules | aprovado: 3/3 no Emulator |
| Cobertura crítica | aprovado: 100% linhas, 93,66% branches, 98,53% funções |
| Mutation sanity | aprovado |
| Build | aprovado com Firebase sintético em memória |
| HTTP smoke | aprovado: 200/400/401/403/404/405/503 e headers defensivos |
| Secret scan | aprovado: 649 arquivos versionados |
| E2E local | 30 descobertos: 16 aprovados em Desktop Chromium e Mobile Chrome; 14 remotos ignorados sem `E2E_BASE_URL` |
| E2E Preview real | bloqueado em preflight fail-closed: os registros existem em `Preview`, mas o reusable workflow os recebeu vazios |

A validação nova incluiu 17 testes direcionados de arquitetura, origem, renovação, falha, logout e múltiplas abas. A bateria completa passou sem retry. O primeiro build local falhou pela ausência intencional de configuração Firebase; a repetição com a mesma credencial sintética e as mesmas variáveis públicas usadas pela CI oficial passou.

Na rodada de 02/08/2026, quatro Previews novos comprovaram o mesmo bloqueio sem reutilizar cache: runs `30756572076`, `30756849179`, `30757027145` e `30757186956`. Foram testados contrato explícito, marcador homônimo, environment sem auto-deployment e marcador de namespace separado. Em todos, o runner imutável e o alvo Vercel foram validados, Production ficou ignorado e o preflight parou antes de dependências, sentinela, Chromium/WebKit, autenticação ou artefatos. O log informou somente os nomes ausentes; nenhum valor sensível foi exposto.

Os gates diretamente afetados passaram: sintaxe YAML, 21 testes de arquitetura/governança, ESLint, TypeScript e secret scan. A bateria completa local desta data manteve uma falha temporal preexistente e fora do diff em `corrective-data-quality.test.ts` (623/624), reproduzida porque a fixture usa o mês corrente antes do dia de pagamento. Firestore Rules, mutation, build, HTTP e E2E local continuaram aprovados na rodada de fechamento; a cobertura gerada atingiu 100% de linhas, 93,66% de branches e 98,53% de funções.

## Riscos restantes

- A PR ainda contém alteração funcional de autenticação/sessão para todos os usuários; idealmente ela seria revisada ou separada antes do merge.
- Os registros de `Preview` estão provisionados, mas a entrega pelo reusable workflow continua bloqueada; usuário QA e entitlement server-side não foram exercitados remotamente.
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
