Este documento substitui todos os planejamentos anteriores quando houver divergência.

# Dados FII — Documento Canônico de Handoff

**Versão:** 10.3.0  
**Data:** 30/07/2026  
**Repositório:** `IsraelJr/dados-fii`  
**Branch principal:** `main`  
**SHA atual de referência:** `e2f8c6a076e7e1f88b443a06556afde9a5bfea6b`  
**Sprint atual:** `PV-2A — Inteligência da Carteira: núcleo determinístico`

## Decisões vigentes que substituem decisões anteriores

| Decisão vigente | Decisão substituída | Efeito |
|---|---|---|
| PV-1 está concluída funcionalmente. | PV-1 aguardava merge, produção e confirmação dos cards. | Histórico manual, gráfico e cards passam a ser base estável para a próxima sprint. |
| Gráfico e resumo usam a mesma série consolidada. | O resumo dependia de estrutura derivada separada e podia divergir do gráfico. | Maior mês, menor mês, total e média reagem à mesma fonte de dados. |
| A próxima frente é a Inteligência da Carteira determinística. | PV-2 começaria diretamente por descoberta Premium. | Primeiro o produto interpreta dados com regras reproduzíveis; IA generativa entra depois como camada de explicação. |
| ChatGPT conduz produto, arquitetura, critérios e QA; Codex executa código, testes, commits e PRs. | Implementações grandes eram tentadas diretamente por conversa e conectores limitados. | A execução passa a ocorrer em ambiente de código real, com relatório técnico e evidências. |
| Google AdSense continua congelado. | AdSense era tratado como prioridade de monetização. | Nenhuma entrega funcional depende de anúncios. |
| Cobrança continua adiada até validação comercial. | Checkout poderia ser antecipado. | Premium deve provar valor e demanda antes de recorrência, Pix ou cartão. |
| O Handoff v10.3.0 é a única fonte canônica ativa. | Handoffs v10.2.0 e anteriores. | O cenário abaixo prevalece em caso de divergência. |

## 1. Estado atual do projeto

- Fases 1, 2 e 3 permanecem formalmente concluídas.
- A fase vigente continua sendo **Produto Validável**.
- PV-1 foi concluída com histórico manual de dividendos, persistência, reconciliação local/servidor e atualização reativa da carteira.
- PR `#155` entregou a base server-side e a jornada de histórico manual.
- PR `#166` consolidou gráfico e resumo sobre `consolidatedSnapshots`, removeu patches temporários e adicionou E2E.
- PR `#167` restaurou o layout original dos seis cards sem reintroduzir fontes paralelas.
- O usuário confirmou em produção que os cards são atualizados corretamente conforme os meses são inseridos.
- O `main` de referência está em `e2f8c6a076e7e1f88b443a06556afde9a5bfea6b`.
- A PR `#168` permanece aberta, em draft e não mesclada na branch `agent/functional-qa-automation`, com referência `1b9e8837fa681d734c3fa007e9a01e397c6b5354`.
- PV-2A implementada e validada localmente em PR draft `#169`, empilhada sobre a PR `#168`.
- PV-2B implementada e validada localmente na PR draft `#170`, empilhada sobre a PR `#169`, sem alterar autenticação, entitlement ou infraestrutura de QA.
- Functional QA remoto pendente por provisionamento.
- Liberação final ainda não validada.

### Matriz atual

| Área | Estado |
|---|---|
| Regulatory Engine | Concluído |
| Core Intelligence & Product Foundation | Concluído |
| Risk Lab read-only | Concluído |
| Histórico manual do ano corrente | Concluído |
| Sincronização gráfico/cards | Concluída |
| Persistência local + servidor | Concluída |
| Inteligência da Carteira determinística | Implementada e validada localmente na PR draft `#169`; liberação pendente |
| Experiência da Inteligência da Carteira | Implementada e validada localmente na PR draft `#170`; QA remoto e liberação pendentes |
| Explicação por IA dos sinais | Pendente após núcleo determinístico |
| Descoberta Premium/beta | Pendente |
| Checkout/cobrança | Não iniciado |
| AdSense | Congelado |

## 2. Fases concluídas

### Fase 1 — Regulatory Engine

**Estado:** concluída.

Parser regulatório, normalização, reconciliação, QA, publicação, rollback, auditoria e suporte FII/FIAGRO.

### Fase 2 — Core Intelligence & Product Foundation

**Estado:** concluída quanto à fundação.

Inclui `RegulatoryDataService`, repositórios, cache, score, Health, Validation, Admin, relatórios, AI Insights, monitor, catálogo, carteira e jobs.

### Fase 3 — Risk Lab

**Estado:** concluída.

Inclui dataset, backtest, ruleset `0.2.0`, Premium read-only, bloqueio de efeitos externos, smoke OIDC e auditoria persistida.

### PV-1 — Jornada principal da carteira e histórico manual

**Estado:** concluída funcionalmente.

Inclui cadastro manual de dividendos de meses encerrados, inclusão, sobrescrita, exclusão, persistência, reconciliação, atualização imediata dos gráficos e cards, navegação/reload e testes desktop/mobile.

## 3. Sprint atual

### PV-2A — Inteligência da Carteira: núcleo determinístico

**Objetivo:** transformar a carteira de um painel de números em um copiloto que identifica mudanças materiais com cálculos reproduzíveis e sem depender de IA generativa.

**Estado comprovado em 31/07/2026:** implementação validada localmente na PR draft `#169`; Functional QA remoto pendente por provisionamento e liberação final ainda não validada.

### Escopo

- criar um domínio próprio para métricas e sinais da carteira;
- calcular variação mensal e acumulada da renda;
- calcular média móvel e estabilidade/volatilidade da renda;
- calcular concentração por fundo e por segmento;
- calcular participação de cada fundo na renda;
- detectar dependência excessiva de um único fundo;
- detectar meses atípicos positivos e negativos;
- classificar tendência de renda em alta, queda, estável ou inconclusiva;
- medir qualidade e completude dos dados;
- produzir sinais estruturados, com código, severidade e evidências;
- não exibir recomendação de compra ou venda;
- não chamar OpenAI para cálculos determinísticos.

### Sinais mínimos

- `RENDA_EM_ALTA`;
- `RENDA_EM_QUEDA`;
- `RENDA_INSTAVEL`;
- `RENDA_ESTAVEL`;
- `CONCENTRACAO_ELEVADA`;
- `DEPENDENCIA_DE_UM_FUNDO`;
- `MES_ATIPICO_POSITIVO`;
- `MES_ATIPICO_NEGATIVO`;
- `DADOS_INSUFICIENTES`.

### Contrato mínimo de sinal

```ts
{
  code: "RENDA_EM_QUEDA",
  severity: "warning",
  title: "Sua renda caiu nos últimos meses",
  evidence: {
    previousAverage: 140,
    recentAverage: 112,
    variationPercent: -20
  }
}
```

## 4. Ordem oficial das próximas sprints

1. **PV-2A — Inteligência da Carteira: núcleo determinístico.**
2. **PV-2B — Apresentação dos sinais na carteira e resumo “O que mudou”.**
3. **PV-2C — IA explicativa sobre sinais prontos, sem recalcular dados.**
4. **PV-3 — Descoberta Premium, beta controlado e telemetria de interesse.**
5. **PV-4 — Relatório incremental: mudanças desde a última análise.**
6. **PV-5 — Radar/Acompanhar fundo fora da carteira: 1 grátis e 10 Premium.**
7. **PV-6 — Validação de preço e cobrança.**
8. **PV-7 — Checkout, recorrência, cancelamento e entitlement.**
9. **PV-8 — Carteira histórica avançada, retorno total e atribuição.**
10. **PV-9 — Screener, comparador, filtros salvos e fair value por categoria.**

SEO editorial, AdSense, WhatsApp, Telegram e grandes mudanças visuais não antecipam PV-2A a PV-3.

## 5. Escopo e critérios de aceite de cada sprint

### PV-2A

Aceite:

- métricas puras e determinísticas, sem dependência de React ou OpenAI;
- testes unitários para cada fórmula e limiar;
- ausência, zero e dados inválidos tratados separadamente;
- resultados reproduzíveis para a mesma entrada;
- nenhum hardcode por ticker ou usuário;
- contrato versionado dos sinais;
- lint, typecheck, suíte, build e E2E verdes;
- nenhum valor financeiro em logs/telemetria;
- documentação dos limiares e das hipóteses.

### PV-2B

Aceite:

- bloco “O que mudou na sua carteira” na interface;
- linguagem simples e orientada a impacto;
- evidência visível para cada sinal;
- ausência de alerta quando não houver mudança material;
- acessibilidade desktop/mobile;
- estados vazio, incompleto, carregando e erro explícitos.

### PV-2C

Aceite:

- IA recebe somente métricas e sinais validados;
- IA não recalcula números;
- saída sem recomendação de compra/venda;
- confiança e limitações explícitas;
- cache/versionamento de prompt;
- custo por geração limitado e auditável;
- fallback determinístico quando IA estiver indisponível.

### PV-3

Aceite:

- proposta Premium visível sem checkout falso;
- lista de interesse e beta por allowlist server-side;
- telemetria sem dados financeiros ou identidade bruta;
- decisão comercial baseada em usuários externos, não apenas no proprietário.

### PV-4 a PV-9

Cada sprint exige escopo fechado, testes automatizados, Preview, produção e evidência antes de ser marcada como concluída.

## 6. Regras arquiteturais obrigatórias

1. Route Handler → autenticação/schema → controller/application service → domínio → repository → Firestore/provedor.
2. Nenhum `route.ts` importa Firestore diretamente.
3. Componente React não contém regra financeira, conflito ou persistência de domínio.
4. Métricas e sinais da carteira ficam em módulos puros, testáveis e independentes de UI.
5. IA nunca é fonte de verdade para cálculo financeiro.
6. Gráfico e cards que representam o mesmo conceito usam a mesma série consolidada.
7. Ausência não vira zero; `NaN`, infinito, data futura e valor inválido falham fechado.
8. Competência usa `YYYY-MM`.
9. Snapshot automático não é editável como manual.
10. Proveniência e timestamps são obrigatórios.
11. Logs e telemetria não contêm valores financeiros, posições, e-mail, token ou cookie.
12. Plano, admin, identidade e entitlement vêm do servidor.
13. Risk Lab permanece read-only no Premium.
14. Correções são gerais, sem hardcode por ticker, e-mail ou usuário.
15. CI é gate de merge e deploy.
16. Nenhuma transformação de código-fonte em `predev`, `prebuild` ou `buildCommand` é aceita como correção funcional.
17. Codex deve alterar o código-fonte diretamente, executar testes e entregar relatório técnico.
18. Nenhuma validação manual substitui esses gates.

## 7. Arquivos, branches, commits e PRs existentes

### Referências atuais

- Repositório: `IsraelJr/dados-fii`.
- Branch principal: `main`.
- SHA de referência: `e2f8c6a076e7e1f88b443a06556afde9a5bfea6b`.
- PR `#155`: jornada PV-1 e histórico server-side.
- PR `#166`: consolidação do resumo com a série do gráfico.
- PR `#167`: restauração do layout dos cards.
- PR `#165`: fechada sem merge; tentativa substituída por `#166`.
- PR `#168`: automação funcional, aberta, draft e não mesclada; branch `agent/functional-qa-automation`, SHA de base da PV-2A `1b9e8837fa681d734c3fa007e9a01e397c6b5354`.
- PR `#169`: PV-2A, aberta em draft e empilhada sobre `agent/functional-qa-automation`; branch `feat/portfolio-intelligence-core`, HEAD corretivo usado pela PV-2B `654abbba45e99c1093d56aa54cad1aad55e1dc88`.
- PR `#170`: PV-2B, aberta em draft e empilhada sobre `feat/portfolio-intelligence-core`; branch `feat/portfolio-intelligence-experience`, commit técnico validado localmente `e0f189dc4cd13ec76b4473528eefc80d081714be`.

### Arquivos centrais da carteira/histórico

- `src/app/carteira/page.tsx`;
- `src/app/components/PortfolioHistoryPanel.tsx`;
- `src/lib/portfolio/PortfolioHistory.ts`;
- `src/lib/portfolio/PortfolioHistoryRepository.ts`;
- `src/lib/portfolio/PortfolioHistoryService.ts`;
- `src/server/repositories/FirestorePortfolioHistoryRepository.ts`;
- `src/server/controllers/PortfolioHistoryController.ts`;
- `src/app/api/portfolio/history/route.ts`;
- `src/lib/portfolio-intelligence/`;
- `src/app/components/PortfolioIntelligencePanel.tsx`;
- `tests/portfolio-history*.test.*`;
- `tests/portfolio-intelligence*.test.*`;
- `tests/e2e/critical-journeys.spec.ts`.

### Documentos canônicos

- `DADOS_FII_HANDOFF.md`;
- `docs/product/product-validation-phase-1.md`;
- `docs/operations/runtime-environment-inventory.md`;
- `tests/canonical-handoff.test.mjs`.

## 8. Funcionalidades concluídas, parciais e pendentes

### Concluídas

- motor regulatório e catálogo;
- carteira básica e snapshots;
- histórico manual de dividendos do ano corrente;
- persistência local e server-side;
- reconciliação por `updatedAt`;
- inclusão, sobrescrita e exclusão;
- atualização imediata de gráfico e cards;
- maior mês, menor mês, total e média sobre a mesma fonte;
- relatórios Free, AI Insights e Premium controlado;
- Risk Lab read-only;
- segurança, CI e gates de produção.

### Parciais

- inteligência da carteira: núcleo e política `1.0.0` na PR draft `#169`, com experiência determinística, evidências, estados e cobertura local na PR draft `#170`; Functional QA remoto e liberação final permanecem pendentes;
- Premium: relatório existe, mas descoberta, beta e cobrança não estão finalizados;
- notificações: existem, mas ainda precisam seguir rigorosamente mudança material e deduplicação.

### Pendentes

- liberação final do núcleo determinístico após sincronização com `main` e Functional QA Preview autenticado;
- validação remota da experiência “O que mudou” nos três projetos Playwright;
- IA explicativa sobre sinais;
- descoberta Premium e beta externo;
- relatório incremental;
- acompanhar fundo fora da carteira;
- cobrança e entitlement comercial;
- WhatsApp/Telegram;
- retorno total, atribuição, screener e comparador.

## 9. Decisões de segurança

- Segredos são server-only.
- `NEXT_PUBLIC_*` nunca concede plano, admin, ownership ou privilégio.
- Carteira e histórico são privados e `noindex`.
- Entitlement e identidade são resolvidos no servidor.
- Escritas exigem autenticação, schema e ownership.
- Usuário só acessa e altera seus próprios registros.
- Eventos analíticos não armazenam valores da carteira.
- E-mail ou `ownerId` enviados no body não concedem identidade.
- Não existe exceção por e-mail pessoal.
- IA recebe apenas dados necessários e sanitizados.
- Sinais determinísticos não podem disparar efeitos externos por conta própria.

## 10. Variáveis de ambiente

O inventário versionado está em:

`docs/operations/runtime-environment-inventory.md`

Regras:

- valores nunca são registrados no Git, Handoff, logs ou evidências;
- variável nova exige classificação, owner, ambientes, fallback, rollback e teste;
- feature flag temporária exige condição de remoção;
- credenciais OpenAI permanecem server-only;
- flags de Premium e Risk Lab permanecem fail-closed.

## 11. Testes obrigatórios

Gate mínimo:

1. `npm ci`;
2. governança de workflows;
3. Handoff canônico;
4. audit de produção;
5. secret scan;
6. lint;
7. typecheck;
8. suíte unitária, integração e contratos;
9. Firestore Emulator;
10. cobertura crítica;
11. mutation sanity;
12. build;
13. smoke HTTP;
14. E2E desktop/mobile;
15. Preview Vercel;
16. produção e smoke pós-deploy.

Para carteira/histórico/inteligência, adicionar obrigatoriamente:

- inclusão, sobrescrita e exclusão de mês;
- navegação e reload;
- reconciliação local/servidor;
- gráfico e cards sincronizados;
- zero sem informação não entra como menor mês;
- limiares de sinais em testes de fronteira;
- dados insuficientes não geram conclusão forte;
- IA indisponível não quebra o diagnóstico determinístico.

## 12. Pendências e decisões ainda abertas

### Imediatas

- revisar as PRs draft `#169` e `#170` sem mesclar enquanto os gates remotos estiverem pendentes;
- provisionar o usuário e os secrets de QA em fluxo separado;
- executar o Functional QA Preview autenticado nos três dispositivos;
- após integração ou substituição da PR `#168`, sincronizar a PV-2A com `main` e repetir todos os gates;
- depois da integração das PRs anteriores, retargetar a PR `#170` para `main`, repetir os gates e somente então avaliar a liberação final.

### Comerciais

- preço do Premium;
- recorrência, anual ou compra avulsa;
- provedor de pagamento;
- cartão, Pix recorrente ou Pix avulso;
- política e limites do beta;
- limites de uso de IA por plano.

### Produto

- importação de anos anteriores;
- importação por planilha;
- Radar/Acompanhar fundo;
- relatório incremental;
- retorno total e atribuição;
- screener e comparador.

### Canais

- WhatsApp: custo, opt-in, template e frequência;
- Telegram permanece adiado;
- e-mail deve ser deduplicado e orientado a mudança material.

### Processo de desenvolvimento

- ChatGPT define escopo, regras, arquitetura, critérios de aceite e prompts técnicos.
- Codex implementa no repositório, executa testes, abre PR e produz relatório técnico.
- O resultado do Codex retorna para revisão de produto e QA antes da próxima sprint.

Uma demanda só antecipa a ordem quando comprovar impacto direto em ativação, retenção, confiança, conversão ou redução de custo/risco.
