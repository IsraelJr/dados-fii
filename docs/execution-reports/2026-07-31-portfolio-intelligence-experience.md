# Relatório de execução — PV-2B Experiência da Inteligência da Carteira

**Data:** 31/07/2026

**Repositório:** `IsraelJr/dados-fii`

**Branch:** `feat/portfolio-intelligence-experience`

**Base:** `feat/portfolio-intelligence-core`

**PR:** [#170](https://github.com/IsraelJr/dados-fii/pull/170), aberta, draft e não mesclada

**SHA técnico validado localmente e pelo Preview:** `e0f189dc4cd13ec76b4473528eefc80d081714be`

**Base exata usada:** `654abbba45e99c1093d56aa54cad1aad55e1dc88`

## Estado executivo

A PV-2B está implementada e validada localmente. O Preview Vercel do SHA técnico foi construído com sucesso, mas o Functional QA Preview permaneceu vermelho e falhou fechado no preflight porque os secrets do usuário exclusivo de QA continuam ausentes. Nenhum navegador autenticado foi iniciado nessa execução remota.

A PR depende das PRs #168 e #169, deve continuar draft, não está aprovada para merge e precisará ser retargetada para `main` após a integração das dependências. Não houve merge, provisionamento de secret, force push ou alteração de entitlement.

## Commits

### Correções publicadas primeiro na PR #169

- `e344d039b8162405781ac69293c21f45ad4f771e` — `fix: complete portfolio intelligence boundaries`;
- `654abbba45e99c1093d56aa54cad1aad55e1dc88` — `docs: reconcile portfolio intelligence audit evidence`.

### Implementação da PR #170

- `e0f189dc4cd13ec76b4473528eefc80d081714be` — `feat: add portfolio intelligence experience`.

A atualização deste relatório e do Handoff é documental e posterior ao SHA técnico acima. Ela não altera o runtime validado.

## Correções aplicadas à PR #169

Antes da criação da branch PV-2B, foram corrigidos os bloqueadores da auditoria do núcleo:

- testes comportamentais para os limites inclusivos de +5%, -5%, CV 20%, maior posição 30%, top 3 70%, HHI 2.500, dependência de renda 35%, cobertura de segmentos 70% e segmento 50%;
- regressões para valores imediatamente dentro dos limiares;
- motivos estruturados para carteira vazia, cotações ausentes, segmentos ausentes, renda estimada ausente, total conhecido igual a zero, histórico curto, lacunas e entrada rejeitada;
- preservação da diferença entre ausência e zero;
- modo seguro com razão específica, sem resumo genérico contraditório;
- relatório da PV-2A reconciliado com o SHA realmente validado, o Preview correspondente e o Functional QA não executado por falta de secrets.

Arquivos do commit técnico corretivo: `PortfolioIntelligence.ts`, `PortfolioIntelligenceDataQuality.ts`, `PortfolioIntelligenceService.ts`, `PortfolioIntelligenceSignals.ts` e `tests/portfolio-intelligence.test.ts`.

## Comportamento anterior e novo

### Anterior

- o painel apresentava os sinais do domínio diretamente;
- não havia resumo explícito de renda, qualidade e quantidade de pontos de atenção;
- evidências e mensagens de qualidade tinham apresentação mínima;
- durante a hidratação ou o enriquecimento regulatório, um diagnóstico temporário podia aparecer antes da conclusão da carga;
- robots e canonical privados também estavam declarados no layout, duplicando a política central de header.

### Novo

- um modelo determinístico transforma somente `PortfolioIntelligenceResult` em dados de apresentação;
- o resumo informa alta, queda, estabilidade ou indisponibilidade, qualidade e pontos de atenção;
- no máximo três sinais aparecem inicialmente, na ordem do domínio, com expansão e recolhimento;
- severidade usa texto e ícone, confiança é explícita e as evidências relevantes usam moeda, percentual e competência em formato brasileiro;
- `null` é “Não disponível” e zero explícito continua zero;
- “Dados usados nesta análise” explica cobertura e todos os motivos estruturados de supressão ou confiança reduzida;
- loading, carteira vazia, histórico insuficiente, parcial, inválido e completo são estados distintos;
- o loading impede conclusão definitiva enquanto a carteira ou os dados regulatórios estão incompletos;
- `/carteira` mantém uma única política efetiva de `noindex, nofollow, noarchive`, centralizada no header;
- cards, gráfico, histórico, formulário, relatório de risco, preferências, inclusão e exclusão foram preservados.

## Decisões arquiteturais

O fluxo adotado é:

```text
PortfolioIntelligenceResult
  -> PortfolioIntelligencePresentation
  -> PortfolioIntelligencePanel
```

- React não recalcula médias, variações, participações, HHI ou thresholds;
- o modelo preserva a ordem recebida, seleciona sinais, formata evidências e mapeia códigos;
- a expansão só alterna entre coleções já construídas e não recalcula o resultado;
- `consolidatedSnapshots` continua sendo a única série histórica da carteira;
- não foi adicionada API, coleção, persistência, snapshot, histórico, fetch, OpenAI, analytics ou dependência externa;
- autenticação, sessão, entitlement, Risk Lab, Premium, notificações, checkout e cobrança não foram alterados.

## Arquivos alterados pela PV-2B

- `docs/engineering/portfolio-intelligence-experience.md`;
- `package.json`;
- `src/app/carteira/layout.tsx`;
- `src/app/carteira/page.tsx`;
- `src/app/components/PortfolioIntelligencePanel.tsx`;
- `src/lib/portfolio-intelligence/PortfolioIntelligencePresentation.ts`;
- `src/lib/portfolio-intelligence/index.ts`;
- `tests/corrective-web-hardening.test.mjs`;
- `tests/e2e/critical-journeys.spec.ts`;
- `tests/e2e/functional-qa.spec.ts`;
- `tests/portfolio-intelligence-architecture.test.mjs`;
- `tests/portfolio-intelligence-integration.test.ts`;
- `tests/portfolio-intelligence-presentation.test.ts`;
- `tests/portfolio-intelligence-seo.test.mjs`.

Arquivos documentais posteriores: `DADOS_FII_HANDOFF.md` e este relatório.

## Gates locais

Todos os resultados abaixo foram obtidos sobre o conteúdo do SHA técnico `e0f189dc4cd13ec76b4473528eefc80d081714be`, salvo a repetição documental do Handoff e do secret scan identificada separadamente.

| Gate | Comando | Resultado local |
|---|---|---|
| Lockfile | `npm ci` | aprovado; 1.137 pacotes instalados, 1.138 auditados |
| Governança | `npm run test:workflow-governance` | 10/10 aprovados |
| Handoff canônico | `npm run test:handoff` | 8/8 aprovados antes da atualização documental; repetido depois |
| Secret scan | `npm run security:secrets` | aprovado em 667 arquivos versionados no SHA técnico e 668 após a documentação final |
| Auditoria de produção | `npm run audit:production` | 0 vulnerabilidades |
| ESLint | `npm run lint` | aprovado, zero warnings |
| TypeScript | `npm run typecheck` | aprovado |
| Suíte completa | `npm run test:all` | 679/679 aprovados |
| Inteligência dedicada | `npm run test:portfolio-intelligence` | 56/56 aprovados |
| Cobertura dedicada | `npm run test:coverage:portfolio-intelligence` | 44/44; 99,26% linhas, 92,33% branches, 97,78% funções |
| Arquitetura | teste isolado de `portfolio-intelligence-architecture` | 8/8 aprovados |
| Integração | teste isolado de `portfolio-intelligence-integration` | 5/5 aprovados |
| SEO privado | teste isolado de `portfolio-intelligence-seo` | 4/4 aprovados |
| Redação de artefatos | `npm run test:artifact-redaction` | 1/1 aprovado |
| Firestore Rules | `npm run test:rules` | 3/3 aprovados no Emulator |
| Cobertura oficial | `npm run test:coverage:critical` | 679/679; 100% linhas, 93,66% branches, 98,53% funções |
| Mutation | `npm run test:mutation` | aprovado; mutante falhou e original restaurado passou |
| Build | `npm run build` | aprovado; 47 páginas estáticas geradas |
| HTTP | `npm run test:http` | aprovado para 200/400/401/403/404/405/503 e headers defensivos |
| E2E local | `npm run test:e2e:local` | 18 aprovados, 16 remotos ignorados, workers=1 |
| Descoberta Playwright | `playwright test --list` | 51 casos: 17 em cada um dos três projetos |

### Cobertura funcional adicionada

- resumo principal, estado e qualidade;
- ordem e limite inicial de três sinais;
- expansão e recolhimento por teclado com `aria-expanded` e `aria-controls`;
- confiança, severidade textual e evidências;
- formatação brasileira e ausência diferente de zero;
- carteira vazia, histórico curto, dados parciais, erro validado e análise completa;
- loading regulatório sem diagnóstico prematuro;
- alteração e exclusão de mês com recálculo;
- mudança de posições com recálculo de concentração;
- área de dados usados e razões específicas;
- tema escuro, axe e ausência de overflow em Desktop Chromium e Mobile Chrome;
- descoberta do mesmo inventário para Mobile Safari/WebKit;
- robots privado único, sitemap sem `/carteira`, ausência de JSON-LD e preservação dos metadados públicos.

### Tentativas intermediárias investigadas

- o primeiro E2E da nova expansão usava um locator dependente do nome acessível, que muda após o clique; o teste foi corrigido para o alvo estável por `aria-controls`, repetido isoladamente em desktop/mobile e depois na suíte completa;
- uma invocação isolada do teste SEO omitiu o loader TypeScript; o comando oficial com loader foi executado e passou 4/4;
- uma tentativa de audit usou o executável npm com um Node antigo no `PATH`; o runtime Node 22 configurado foi aplicado e o gate oficial passou com 0 vulnerabilidades.

Nenhuma falha real foi mascarada com retry excessivo.

## Resultados remotos e Preview

### Vercel

- SHA: `e0f189dc4cd13ec76b4473528eefc80d081714be`;
- status: sucesso;
- [inspeção do deployment](https://vercel.com/israel-alves-projects-aee7aa56/dados-fii/6nqzordaXRUtbkt41Tp4LExhytW6);
- [URL de Preview](https://dados-fii-git-feat-portfo-96bee4-israel-alves-projects-aee7aa56.vercel.app).

O sucesso do build do Preview não equivale a aprovação funcional autenticada.

### Functional QA Preview

- execução: [30652658187](https://github.com/IsraelJr/dados-fii/actions/runs/30652658187);
- status: falha fail-closed em `Validate isolated QA configuration`;
- checkout do runner imutável, prova de identidade e resolução do deployment: aprovados;
- instalação de dependências, redator, browsers, seleção de jornada, login, Playwright e upload autenticado: ignorados;
- motivo operacional: `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` e `VERCEL_AUTOMATION_BYPASS_SECRET` não estão provisionados nos environments correspondentes.

Nenhuma credencial foi registrada, nenhum usuário real foi usado e nenhum artefato autenticado foi enviado. O Functional QA remoto **não foi executado nem aprovado**.

## SEO da rota privada

Por ser uma área autenticada, a aplicação de SEO nesta funcionalidade consiste em controle de indexação, semântica, acessibilidade e desempenho, não em aquisição orgânica.

O header central existente é a única política efetiva de robots para `/carteira`. Não foram adicionados keywords, JSON-LD, schema de produto, canonical indexável ou conteúdo artificial. O sitemap e os metadados públicos permaneceram protegidos por testes.

## Riscos e limitações

- o QA autenticado remoto nos três navegadores ainda não ocorreu;
- a PR é empilhada e herda mudanças de autenticação/sessão da #168 e o domínio da #169;
- a branch precisará ser sincronizada e retargetada após a integração das dependências;
- Mobile Safari/WebKit foi descoberto na matriz, mas não executado localmente; permanece no gate remoto semanal/full;
- a renda por fundo é estimativa corrente, não atribuição histórica;
- o modelo explica evidências e ausências, não causalidade econômica;
- `npm ci` informou 24 vulnerabilidades em dependências incluindo desenvolvimento (5 moderadas, 18 altas e 1 crítica), enquanto o gate de dependências de produção confirmou 0 vulnerabilidades;
- o build de Preview aprovado não valida sessão, persistência, cleanup ou acessibilidade autenticada no ambiente remoto.

## Pendências

1. criar e verificar o usuário Firebase exclusivo de QA, sem privilégio administrativo;
2. provisionar os três secrets apenas nos environments governados;
3. conceder `isVip` somente no documento server-side do usuário de QA;
4. executar o Functional QA Preview real em Desktop Chromium, Mobile Chrome e Mobile Safari/WebKit;
5. integrar ou substituir a PR #168 e integrar a PR #169 após seus próprios gates;
6. retargetar a PR #170 para `main`, sincronizar a branch e repetir todos os gates;
7. obter revisão explícita de produto e segurança antes de qualquer liberação.

## Recomendação de merge

**NÃO FAZER MERGE.** Manter a PR #170 em draft. A implementação está apta para revisão técnica local, mas não para integração final ou produção enquanto o Functional QA autenticado estiver vermelho, as PRs #168 e #169 não estiverem integradas e o SHA retargetado não tiver sido novamente validado.
