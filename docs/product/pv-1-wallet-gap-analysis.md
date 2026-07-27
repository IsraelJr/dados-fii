# PV-1 — Auditoria da jornada principal da carteira

**Data:** 27/07/2026  
**Branch:** `agent/product-validation-phase-1`  
**Issue:** `#154`  
**PR:** `#155`

## Veredito

A carteira atual é funcional como protótipo local, mas ainda não atende ao padrão de Produto Validável.

## Evidências observadas

Arquivo principal auditado: `src/app/carteira/page.tsx`.

### Persistência atual da interface

- carteira em `localStorage` pela chave `dados-fii-wallet-v1`;
- snapshots em `localStorage` pela chave `dados-fii-wallet-monthly-snapshots-v1`;
- perda potencial ao trocar navegador, limpar armazenamento ou usar outro dispositivo;
- a interface ainda não consome o novo histórico server-side.

### Domínio legado da tela

- regras de moeda, competência, snapshots, dividendos, pesos, histórico e interface continuam no mesmo componente;
- `parseCurrency` converte entrada inválida em `0`, escondendo erro de qualidade;
- `getCurrentYearData` usa o ano anterior como fallback, o que pode misturar competências sem estado explícito;
- histórico de dividendos é recalculado com as cotas atuais, não com a posição histórica;
- snapshot do mês corrente é atualizado conforme preço e dados carregados;
- assinatura de snapshot não considera todos os campos do snapshot.

## Avanço implementado no branch

### PV-1A — domínio e contratos

Implementado:

- `PortfolioHistoryEntry` tipado e versionado;
- competência canônica `YYYY-MM`;
- validação fail-closed de moeda pt-BR;
- zero válido separado de ausência;
- bloqueio de mês futuro;
- proveniência `manual`, `automatic_snapshot` e `legacy`;
- política de conflito e snapshot imutável;
- testes unitários.

### PV-1B — persistência e ownership

Implementado no branch, ainda sujeito aos gates completos:

- `PortfolioHistoryRepository`;
- `InMemoryPortfolioHistoryRepository` para testes;
- `FirestorePortfolioHistoryRepository` server-side;
- chave determinística por owner, carteira e competência;
- `PortfolioHistoryService` com criação, listagem, edição, exclusão e importação legada;
- `WalletIdentityResolver` centralizado;
- identidade por sessão validada ou cookie anônimo existente;
- nenhum `ownerId`, `userId` ou e-mail do body concede ownership;
- rotas finas em `/api/portfolio/history`;
- migração idempotente em `/api/portfolio/history/migrate`;
- migração limitada ao ano corrente;
- entradas futuras, inválidas ou vazias rejeitadas;
- testes de isolamento entre usuários, idempotência e arquitetura;
- índice Firestore por `ownerId`, `portfolioId` e `competence`.

## Achado da esteira

O run `30304926247` foi reprovado no teste canônico do Handoff por divergência textual entre a regra documentada e a asserção. A causa foi corrigida no commit `95b3906470f2b3f0679181c55eb730de048be2fb`. Os demais gates ainda precisam executar no novo SHA.

## Próximos blocos

### PV-1C — interface e gráficos

- formulário acessível;
- criação, edição e exclusão de registros manuais;
- snapshots automáticos somente leitura;
- migração acionada após autenticação, sem apagar o local antes da confirmação;
- conflito explícito;
- gráficos e resumos derivados da fonte server-side;
- E2E desktop/mobile.

### PV-1D — telemetria e produção

- eventos sanitizados;
- Preview;
- deploy do SHA exato;
- smoke não destrutivo;
- atualização final do Handoff.

## Casos obrigatórios restantes

- usuário novo sem carteira;
- usuário com carteira local legada;
- carteira persistida no servidor;
- conflito manual/snapshot;
- dezembro para janeiro;
- troca de dispositivo/navegador;
- E2E e acessibilidade;
- produção.

## Fora de escopo

- anos anteriores ao corrente;
- importação por planilha;
- checkout;
- anúncios;
- WhatsApp ou Telegram;
- recomendação automática de compra ou venda.
