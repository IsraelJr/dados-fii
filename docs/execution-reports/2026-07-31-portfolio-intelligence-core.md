# Relatório de execução — PV-2A Inteligência da Carteira

**Data:** 31/07/2026
**Branch:** `feat/portfolio-intelligence-core`
**Base empilhada:** `agent/functional-qa-automation`
**HEAD inicial:** `1b9e8837fa681d734c3fa007e9a01e397c6b5354`
**HEAD final da implementação:** `5b7c07f5c6c833013be82f416248c332125e9bd6`
**SHA da primeira atualização documental:** `1954bbb55350f7bef53cd7557c52454fff404864`
**SHA da reconciliação documental anterior:** `cf1c5c44d3953c5ec4865e223252a961dee74d97`
**SHA da correção técnica da auditoria:** `e344d039b8162405781ac69293c21f45ad4f771e`
**PR:** `#169`, aberta e em draft
**Estado:** implementação validada localmente; liberação final não validada

## Objetivo

Construir o núcleo determinístico, reproduzível e independente de OpenAI que interpreta o histórico consolidado e as posições atuais da carteira por métricas, qualidade e sinais estruturados.

## Estratégia de branch

A branch foi criada limpa sobre o HEAD remoto mais recente da PR #168, conforme a decisão explícita da tarefa. A PR #169 foi aberta em draft, com base `agent/functional-qa-automation` e head `feat/portfolio-intelligence-core`. A PR #168 não foi mesclada, fechada ou marcada como pronta e nenhum secret foi provisionado.

## Arquivos e áreas

- oito módulos de domínio em `src/lib/portfolio-intelligence/`;
- painel discreto em `src/app/components/PortfolioIntelligencePanel.tsx`;
- integração em `src/app/carteira/page.tsx`;
- scripts dedicados em `package.json`;
- três arquivos de testes unitários, integração, arquitetura e performance;
- uma jornada adicionada ao E2E funcional existente;
- documentação de engenharia e este relatório.

## Decisões arquiteturais

- `consolidatedSnapshots` permanece a única série consumida por cards, gráfico e inteligência;
- posições são adaptadas dos dados já carregados por `/api/fii/batch`, que usa `RegulatoryDataService`;
- nenhuma API, repository, coleção, workflow, usuário ou credencial foi criado;
- componentes React apenas adaptam entrada e apresentam o resultado;
- valores ausentes permanecem `null`;
- motivos de insuficiência são estruturados por código, conclusão afetada, impacto, mensagem e evidências;
- qualquer cotação ausente torna a cobertura patrimonial percentual indeterminada e suprime concentração forte;
- qualquer renda por posição ausente suprime dependência de renda;
- o domínio não importa React, Next.js, Firestore ou OpenAI;
- o painel mínimo foi antecipado por instrução explícita desta tarefa, divergindo da separação PV-2A/PV-2B descrita no Handoff v10.3.0.

## Fórmulas e thresholds

- tendência: média dos três meses recentes contra os três anteriores; alta ≥ +5%, queda ≤ -5%, estabilidade entre os limites;
- instabilidade: desvio-padrão populacional e CV dos seis últimos meses; sinal em CV ≥ 20%;
- concentração: maior posição ≥ 30%, três maiores ≥ 70% ou HHI ≥ 2.500;
- dependência de renda: um fundo ≥ 35%;
- segmento: cobertura ≥ 70% e um segmento ≥ 50%;
- mês atípico: mediana dos seis anteriores, MAD, robust score ≥ 3,5 e desvio relativo ≥ 50%;
- MAD zero: desvio absoluto médio; baseline constante usa diferença mínima de R$ 0,01 e materialidade relativa quando aplicável.

## Métricas e sinais

Métricas:

- contagem, último mês, renda, variação mensal, médias, variação entre blocos, média de seis meses, desvio-padrão, CV, mediana, maior, menor e atípico;
- patrimônio válido, participações, maior posição, três maiores e HHI;
- participações e cobertura por segmento;
- renda estimada total, participações e maior contribuidor;
- cobertura de cotação, segmento, renda e histórico.

Sinais:

- `RENDA_EM_ALTA`;
- `RENDA_EM_QUEDA`;
- `RENDA_ESTAVEL`;
- `RENDA_INSTAVEL`;
- `CONCENTRACAO_ELEVADA`;
- `CONCENTRACAO_POR_SEGMENTO`;
- `DEPENDENCIA_DE_UM_FUNDO`;
- `MES_ATIPICO_POSITIVO`;
- `MES_ATIPICO_NEGATIVO`;
- `DADOS_INSUFICIENTES`.

## Gates locais executados

Os gates completos da implementação original pertencem ao SHA `5b7c07f5c6c833013be82f416248c332125e9bd6`. Após a auditoria, somente os gates exigidos para a correção foram reexecutados sobre o conteúdo que se tornou `e344d039b8162405781ac69293c21f45ad4f771e`; os demais não são implicitamente promovidos para esse SHA.

| Gate | Resultado | SHA local comprovado |
|---|---|---|
| `npm ci` | aprovado: 1.120 pacotes instalados pelo lockfile | `5b7c07f5c6c833013be82f416248c332125e9bd6` |
| Governança de workflows | aprovado: 10/10 | `5b7c07f5c6c833013be82f416248c332125e9bd6` |
| Handoff canônico | aprovado: 8/8 | `5b7c07f5c6c833013be82f416248c332125e9bd6` |
| Auditoria de produção | aprovado: 0 vulnerabilidades | `5b7c07f5c6c833013be82f416248c332125e9bd6` |
| Secret scan | aprovado: 663 arquivos versionados | `e344d039b8162405781ac69293c21f45ad4f771e` |
| ESLint | aprovado, zero warnings | `e344d039b8162405781ac69293c21f45ad4f771e` |
| TypeScript | aprovado | `e344d039b8162405781ac69293c21f45ad4f771e` |
| `test:all` | aprovado: 659/659 | `5b7c07f5c6c833013be82f416248c332125e9bd6` |
| Testes específicos PV-2A | aprovado: 43/43 | `e344d039b8162405781ac69293c21f45ad4f771e` |
| Firestore Rules | aprovado: 3/3 com JDK 21 | `5b7c07f5c6c833013be82f416248c332125e9bd6` |
| Cobertura crítica | aprovado: 100% linhas, 93,66% branches, 98,53% funções | `5b7c07f5c6c833013be82f416248c332125e9bd6` |
| Cobertura dedicada PV-2A | aprovado: 97,25% linhas, 90,48% branches, 95,52% funções | `5b7c07f5c6c833013be82f416248c332125e9bd6` |
| Mutation sanity | aprovado | `5b7c07f5c6c833013be82f416248c332125e9bd6` |
| Build Next.js 16.2.12 | aprovado: 47 páginas estáticas e rotas dinâmicas, com credencial sintética de build | `e344d039b8162405781ac69293c21f45ad4f771e` |
| HTTP smoke | aprovado: 200/400/401/403/404/405/503 e headers defensivos | `5b7c07f5c6c833013be82f416248c332125e9bd6` |
| E2E local | aprovado: 16/16; 16 remotos ignorados corretamente | `5b7c07f5c6c833013be82f416248c332125e9bd6` |
| Descoberta E2E | aprovado: 48 testes, 16 por projeto, em três dispositivos | `5b7c07f5c6c833013be82f416248c332125e9bd6` |

Os cenários específicos cobrem os limites inclusivos exatos de +5%, -5%, CV 20%, maior posição 30%, top 3 70%, HHI 2.500, dependência 35%, cobertura de segmentos 70% e concentração por segmento 50%. Também cobrem valores imediatamente internos aos limites de tendência e instabilidade, ausência diferente de zero, mês corrente/futuro, determinismo, valores inválidos, divisão por zero, MAD zero, busca de atípico anterior, imutabilidade, ordenação, empates, integração e performance com 200 posições e 120 meses.

Os motivos estruturados de dados insuficientes foram comprovados para carteira vazia, cotação ausente, segmento ausente, renda estimada ausente, rendas conhecidas com total zero, menos de seis meses, seis meses com lacunas e entrada rejeitada pelo modo seguro.

## E2E e acessibilidade

Uma jornada `@critical` foi adicionada à suíte existente da PR #168. Ela reutiliza o usuário, fixture, cleanup e matriz atuais e cobre:

- painel e dados insuficientes;
- tendência e concentração;
- alteração e exclusão de mês;
- recálculo;
- navegação e reload;
- axe;
- cleanup idempotente.

Nenhum workflow E2E foi criado.

A execução local utilizou `desktop-chromium` e `mobile-chrome`, `workers=1`, sem credencial real, e incluiu axe nas jornadas críticas. Os 16 testes autenticados/remotos foram ignorados pelo contrato existente, não simulados. A configuração `mobile-safari` foi descoberta com os mesmos 16 testes e depende do gate remoto semanal/Preview para execução suportada.

## Preview e Functional QA

O SHA corretivo `e344d039b8162405781ac69293c21f45ad4f771e` recebeu status Vercel `success` depois da publicação. O alvo auditável do status é `https://vercel.com/israel-alves-projects-aee7aa56/dados-fii/ALdFqKmBZTHqsA87a1ZVnBYjuidD`. O conector não forneceu uma URL pública de Preview para esse SHA, portanto este relatório não inventa uma.

O SHA efetivamente validado pelo Preview antes da correção foi `cf1c5c44d3953c5ec4865e223252a961dee74d97`, em:

`https://dados-lc884vjop-israel-alves-projects-aee7aa56.vercel.app`

O `Functional QA Preview` associado falhou corretamente no preflight fail-closed:

- execução `30646629307`;
- implementação privilegiada fixada em `18995c079d53848c5ac8e6205d220c2149e02f9b`;
- alvo confirmado como o Preview HTTPS do SHA auditado;
- variáveis de QA vazias;
- nenhum navegador instalado;
- nenhuma autenticação executada;
- nenhum artefato autenticado enviado.

Após a correção, a execução `30651071190` repetiu o mesmo comportamento fail-closed no SHA `e344d039b8162405781ac69293c21f45ad4f771e`: checkout do runner imutável, prova da identidade e resolução do deployment passaram; `Validate isolated QA configuration` falhou; instalação de dependências, redator sentinela, navegadores, Playwright autenticado, redação e upload foram ignorados. O status Vercel passou e o Functional QA permaneceu vermelho pelos secrets ausentes.

Secrets ausentes:

- `E2E_USER_EMAIL`;
- `E2E_USER_PASSWORD`;
- `VERCEL_AUTOMATION_BYPASS_SECRET`.

Não houve autenticação real, evidência autenticada nos três dispositivos ou validação de produção nesta entrega.

Assim, a URL pública de Preview comprovada pertence a `cf1c5c44d3953c5ec4865e223252a961dee74d97`; o status Vercel e o preflight remoto mais recentes pertencem a `e344d039b8162405781ac69293c21f45ad4f771e`. O commit que contém esta atualização documental é posterior aos dois e não é declarado como Preview-validado neste relatório.

## Riscos próprios

- cotação ausente impede comprovar a cobertura patrimonial e suprime sinais de concentração;
- renda estimada incompleta impede o sinal de dependência;
- renda por fundo é estimativa corrente, não atribuição histórica;
- primeira análise de atípico exige sete meses válidos;
- o painel mínimo antecipa uma parte de apresentação originalmente planejada para PV-2B.

## Riscos herdados da PR #168

- logout e renovação entre múltiplas abas ainda precisam de validação adicional;
- renovação após `401` não comprova repetição transparente da requisição original;
- Functional QA autenticado ainda não executou nos três dispositivos;
- `main` ainda não possui o gate `Functional QA Preview` obrigatório.

Nenhum desses pontos foi reescrito ou ampliado pela PV-2A.

## Pendências

- revisar a PR draft empilhada;
- provisionar o QA isolado em fluxo separado;
- executar Functional QA Preview nos três dispositivos;
- após a integração/substituição da PR #168, rebasear em `main` e repetir os gates.

## Recomendação

**Não aprovado para merge.** A implementação local da PV-2A está concluída. Liberação e produção continuam bloqueadas pelo Functional QA remoto, revisão da PR empilhada e sincronização futura com `main`.
