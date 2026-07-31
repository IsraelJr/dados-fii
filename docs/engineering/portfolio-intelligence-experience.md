# Experiência da Inteligência da Carteira

## Objetivo

A PV-2B transforma o `PortfolioIntelligenceResult` determinístico da PV-2A em uma leitura clara da renda, dos pontos de atenção, das evidências e das limitações dos dados. A experiência continua informativa: não explica causalidade, não recomenda compra ou venda e não usa OpenAI.

Cards, gráfico, histórico, formulário, relatório de risco, preferências e operações de inclusão e exclusão permanecem com a estrutura e o comportamento existentes.

## Arquitetura de apresentação

```text
PortfolioIntelligenceResult
  → buildPortfolioIntelligencePresentation
  → PortfolioIntelligencePresentation
  → PortfolioIntelligencePanel
```

Responsabilidades:

- o domínio calcula médias, variações, participações, HHI, cobertura, thresholds, qualidade e sinais;
- `PortfolioIntelligencePresentation.ts` preserva a ordem do domínio, seleciona os três primeiros sinais, mapeia códigos, formata valores e organiza motivos;
- `PortfolioIntelligencePanel.tsx` mantém apenas o estado efêmero de expansão e renderiza o modelo;
- `page.tsx` continua adaptando somente `consolidatedSnapshots` e as posições já carregadas pelo `RegulatoryDataService`;
- `PortfolioIntelligenceLoading` impede que o fallback vazio seja apresentado enquanto carteira ou dados regulatórios ainda estão carregando.

Expandir ou recolher não recalcula `PortfolioIntelligenceResult`. O modelo completo é memoizado pela identidade do resultado; a interação escolhe entre `primarySignals` e `allSignals`.

Não foi criada API, coleção, persistência, snapshot, histórico paralelo, workflow ou dependência externa.

## Resumo e estados da interface

O resumo apresenta:

- renda em alta, queda, estável ou indisponível, conforme o código de sinal já emitido pelo domínio;
- qualidade suficiente, parcial ou insuficiente, conforme `dataQuality.state`;
- quantidade de sinais com severidade `warning` ou `attention`.

Estados explícitos:

- `loading`: carteira local ou enriquecimento regulatório ainda não terminou; nenhuma conclusão é exibida;
- `empty`: existe motivo `EMPTY_PORTFOLIO`;
- `insufficient_history`: existe motivo `INSUFFICIENT_CLOSED_MONTHS`;
- `partial`: há evidência utilizável com alguma supressão ou confiança reduzida;
- `invalid`: a entrada foi rejeitada pelo modo seguro;
- `complete`: não há ressalva estruturada e todas as dimensões têm evidência suficiente.

## Mapeamento dos sinais

A ordem é recebida pronta do domínio e nunca é reclassificada na interface:

1. dados insuficientes;
2. concentração patrimonial;
3. dependência de renda de um fundo;
4. concentração por segmento;
5. renda em queda;
6. renda instável;
7. mês atípico negativo;
8. renda em alta;
9. renda estável;
10. mês atípico positivo.

Cada card mostra severidade por texto e ícone, confiança alta/média/baixa, resumo determinístico e apenas as evidências previstas para o código. Moeda, percentual e competência usam apresentação brasileira. `null` vira “Não disponível”; zero explícito recebe formatação numérica normal.

## Qualidade e dados ausentes

“Dados usados nesta análise” apresenta:

- meses encerrados disponíveis e necessários;
- posições com e sem cotação;
- cobertura de segmentos;
- cobertura de renda;
- todos os motivos estruturados, com indicação de conclusão indisponível ou confiança reduzida.

São distinguídos carteira vazia, cotação ausente, segmento ausente, renda estimada ausente, total de rendas conhecido igual a zero, histórico curto, histórico com lacunas e entrada rejeitada. A interface não substitui ausência por zero e não reduz essas situações a “complete os dados”.

## Acessibilidade e responsividade

- `h2` identifica o bloco; `h3` separa sinais e dados usados; `h4` identifica cada sinal;
- o botão de expansão possui `aria-expanded`, `aria-controls`, alvo mínimo e foco visível;
- severidade usa texto e ícone, não apenas cor;
- confiança e ressalvas são textuais;
- o carregamento usa `aria-busy` e um `status` pontual; atualizações comuns não usam `aria-live` ruidoso;
- o bloco limita largura e overflow, com grids responsivos para desktop e mobile;
- classes de tema claro e escuro mantêm texto e bordas explícitos;
- não há transição nova; o único movimento é o indicador existente sob `motion-safe`, respeitando redução de movimento.

As jornadas locais executam axe para violações sérias e críticas e verificam ausência de overflow em Desktop Chromium e Mobile Chrome. Mobile Safari/WebKit permanece na matriz remota existente.

## Performance e privacidade

- nenhum fetch foi adicionado;
- a expansão não recalcula métricas nem o modelo completo;
- sinais não são gravados em `localStorage`, servidor ou cache novo;
- nenhum ticker, valor, e-mail ou identificador é enviado a log ou analytics;
- formatação usa `Intl` nativo e não aumenta dependências;
- a análise permanece em memória e deriva do resultado já existente.

## SEO da rota privada

Por ser uma área autenticada, a aplicação de SEO nesta funcionalidade consiste em controle de indexação, semântica, acessibilidade e desempenho, não em aquisição orgânica.

A política oficial permanece centralizada em `next.config.ts`: `/carteira/:path*` recebe um único `X-Robots-Tag: noindex, nofollow, noarchive`. A duplicação anterior na metadata do layout foi removida, assim como o canonical privado. O título e a descrição privados permanecem no layout.

Testes comprovam que:

- existe uma única regra efetiva para `/carteira`;
- a diretiva contém `noindex`, `nofollow` e `noarchive`;
- `/carteira`, `/admin` e `/api` não aparecem no sitemap público;
- a rota privada não inclui canonical, keywords ou JSON-LD;
- título, canonical, robots indexável e conta AdSense da metadata pública permanecem inalterados.

## Limitações

- a interface explica a evidência e sua ausência, mas não causalidade econômica;
- a renda por fundo continua sendo estimativa corrente, não atribuição histórica;
- uma URL remota e credenciais do usuário de QA são necessárias para validar a jornada autenticada nos três navegadores;
- o estado de carregamento depende do ciclo da carteira atual; não introduz timeout ou política de retry nova;
- a PV-2B não altera autenticação, sessão, entitlement, Premium, Risk Lab, notificações ou cobrança.

## Relação com a futura camada generativa

Uma camada generativa futura poderá explicar em linguagem natural apenas o `PortfolioIntelligenceResult` e o modelo de apresentação já validados. Ela não poderá recalcular métricas, inventar evidências, inferir causalidade, ampliar entitlement nem transformar o conteúdo em recomendação de investimento.
