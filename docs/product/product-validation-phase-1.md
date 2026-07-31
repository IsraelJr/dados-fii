# Dados FII — Fase de Validação do Produto

**Data:** 30/07/2026  
**Status:** diretriz canônica vigente  
**Fase:** Produto Validável  
**Sprint atual:** PV-2A — Inteligência da Carteira: núcleo determinístico

## Decisão vigente

PV-1 está concluída funcionalmente. O histórico manual de dividendos persiste, reconcilia cache e servidor, atualiza gráfico e cards pela mesma série consolidada e mantém o layout validado.

Esta atualização substitui a regra anterior que mantinha PV-1 como sprint corrente e colocava descoberta Premium imediatamente em seguida.

A próxima prioridade é construir a Inteligência da Carteira em duas camadas:

1. motor determinístico de métricas e sinais;
2. explicação por IA apenas depois que os cálculos estiverem prontos e validados.

## Objetivo da fase

Comprovar que um usuário real consegue:

1. criar ou carregar sua carteira;
2. completar o histórico de dividendos;
3. retornar e encontrar dados íntegros;
4. compreender o que mudou e por que importa;
5. perceber valor suficiente para demonstrar interesse no Premium.

## PV-1 — encerramento

### Entregas concluídas

- histórico manual server-side;
- cadastro de dividendos de meses encerrados;
- inclusão, sobrescrita e exclusão;
- persistência local e Firestore;
- reconciliação por atualização válida mais recente;
- bloqueio de mês corrente e futuro;
- gráfico e cards usando `consolidatedSnapshots`;
- maior mês, menor mês, total e média recalculados em memória;
- navegação e reload sem perda;
- E2E desktop/mobile;
- restauração do layout original dos seis cards.

### Referências

- PR `#155`: base da jornada e histórico;
- PR `#166`: fonte única para gráfico e resumo;
- PR `#167`: restauração do layout;
- SHA de referência em `main`: `e2f8c6a076e7e1f88b443a06556afde9a5bfea6b`.

## Sprint atual — PV-2A

### Objetivo

Criar um motor puro e reproduzível que transforme a série da carteira em métricas e sinais estruturados, sem usar IA generativa para calcular.

### Métricas mínimas

- renda mensal e acumulada;
- variação mês a mês;
- média móvel;
- estabilidade/volatilidade da renda;
- concentração por fundo;
- concentração por segmento;
- participação de cada fundo na renda;
- dependência de um único fundo;
- tendência de alta, queda, estabilidade ou inconclusiva;
- mês atípico positivo ou negativo;
- completude e confiança dos dados.

### Sinais mínimos

- `RENDA_EM_ALTA`;
- `RENDA_EM_QUEDA`;
- `RENDA_ESTAVEL`;
- `RENDA_INSTAVEL`;
- `CONCENTRACAO_ELEVADA`;
- `DEPENDENCIA_DE_UM_FUNDO`;
- `MES_ATIPICO_POSITIVO`;
- `MES_ATIPICO_NEGATIVO`;
- `DADOS_INSUFICIENTES`.

### Regras

1. IA não calcula métricas financeiras.
2. Mesma entrada produz o mesmo resultado.
3. Ausência não vira zero.
4. Dados insuficientes não geram conclusão forte.
5. Limiar deve ser explícito, versionado e testado.
6. Nenhum hardcode por ticker, usuário ou carteira.
7. Sinal contém código, severidade, título e evidências.
8. Sinal não recomenda compra ou venda.
9. Nenhum valor financeiro é enviado para telemetria.
10. UI e OpenAI consomem o mesmo contrato de sinais.

### Critérios de aceite

- módulos independentes de React e Firestore;
- testes unitários para fórmulas e fronteiras;
- testes com histórico completo, parcial e vazio;
- testes de concentração e mês atípico;
- contrato versionado;
- lint, typecheck, suíte, build e E2E verdes;
- documentação de fórmulas, janelas e limiares;
- nenhuma alteração visual fora do necessário.

## PV-2B — apresentação

Criar o bloco **O que mudou na sua carteira**, com linguagem simples, evidências e estados explícitos.

Aceite:

- não alertar quando nada material mudou;
- destacar no máximo os sinais prioritários;
- explicar impacto prático;
- desktop/mobile e acessibilidade aprovados;
- nenhum texto contradiz as evidências.

## PV-2C — IA explicativa

A IA recebe métricas e sinais já calculados e produz explicação curta.

Aceite:

- não recalcular números;
- não inventar causa;
- separar fato, inferência e limitação;
- fallback determinístico;
- custo e versão auditáveis;
- sem recomendação de compra/venda.

## Ordem oficial

1. PV-2A — núcleo determinístico;
2. PV-2B — apresentação dos sinais;
3. PV-2C — IA explicativa;
4. PV-3 — descoberta Premium e beta;
5. PV-4 — relatório incremental;
6. PV-5 — Radar/Acompanhar fundo;
7. PV-6 — validação comercial e preço;
8. PV-7 — cobrança;
9. PV-8 — retorno total e atribuição;
10. PV-9 — screener e comparador.

## Métricas de decisão

- ativação: carteira criada e histórico completado;
- adoção: uso do diagnóstico da carteira;
- retenção: retorno D7 e D30;
- confiança: ausência de divergência entre cálculo e interface;
- valor percebido: leitura dos sinais e relatórios;
- demanda: interesse no Premium;
- sustentabilidade: custo operacional e de IA.

## Itens congelados

Até PV-2A e PV-2B estarem comprovadas:

- Google AdSense;
- expansão editorial em massa;
- checkout e recorrência;
- WhatsApp/Telegram;
- grandes mudanças visuais;
- screener e comparador;
- novas modalidades de relatório não relacionadas à inteligência da carteira.

## Processo de execução

- ChatGPT: produto, arquitetura, regras, critérios de aceite, QA e prompt técnico.
- Codex: implementação, testes, commits, PR e relatório técnico.
- Usuário: validação funcional em produção.

O Codex não recebe liberdade para alterar escopo, regra financeira ou prioridade sem decisão canônica.

## Pendências abertas

- janela da média móvel;
- critério de tendência;
- limiar de concentração;
- limiar de mês atípico;
- severidades dos sinais;
- política de explicação por IA;
- preço e limites dos planos;
- provedor e fluxo de cobrança;
- canais adicionais de alerta.

## Regra de governança

Planejamento sem implementação, testes e evidência não encerra sprint. Nenhuma nova ideia antecipa a ordem sem demonstrar impacto direto em ativação, retenção, confiança, conversão ou redução de custo/risco.