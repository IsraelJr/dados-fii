# PV-1 — Auditoria da jornada principal da carteira

**Data:** 27/07/2026  
**Branch:** `agent/product-validation-phase-1`  
**Issue:** `#154`  
**PR:** `#155`

## Veredito

A carteira atual é funcional como protótipo local, mas não atende ao padrão de Produto Validável.

## Evidências observadas

Arquivo principal auditado: `src/app/carteira/page.tsx`.

### Persistência

- carteira em `localStorage` pela chave `dados-fii-wallet-v1`;
- snapshots em `localStorage` pela chave `dados-fii-wallet-monthly-snapshots-v1`;
- ausência de ownership server-side;
- ausência de isolamento comprovável entre usuários;
- perda potencial ao trocar navegador, limpar armazenamento ou usar outro dispositivo.

### Domínio

- regras de moeda, competência, snapshots, dividendos, pesos, histórico e interface estão no mesmo componente;
- `parseCurrency` converte entrada inválida em `0`, escondendo erro de qualidade;
- `getCurrentYearData` usa o ano anterior como fallback, o que pode misturar competências sem estado explícito;
- histórico de dividendos é recalculado com as cotas atuais, não com a posição histórica;
- snapshot do mês corrente é atualizado conforme preço e dados carregados;
- assinatura de snapshot não considera todos os campos do snapshot;
- não existe proveniência `manual`, `automatic_snapshot` ou `legacy`;
- não existe regra explícita de conflito entre entrada manual e snapshot automático.

### Arquitetura

O componente cliente acumula responsabilidades incompatíveis:

1. persistência;
2. integração HTTP;
3. regra financeira;
4. normalização;
5. snapshots;
6. construção de histórico;
7. exportação;
8. apresentação.

Isso impede teste isolado adequado e aumenta o risco de regressões.

## Decisão técnica

Não será adicionada apenas uma modal sobre o `localStorage` existente. Isso criaria aparência de produto sem corrigir integridade e persistência.

A PV-1 será dividida em blocos internos:

### PV-1A — Domínio e contratos

- `PortfolioHistoryEntry` tipado e versionado;
- competência canônica `YYYY-MM`;
- schemas de criação, edição e leitura;
- validação fail-closed de valores;
- proveniência e política de conflito;
- testes unitários.

### PV-1B — Persistência e ownership

- repository server-side;
- chave determinística por usuário/carteira/competência;
- autenticação e ownership;
- migração/leitura compatível do legado;
- testes de integração e regras.

### PV-1C — Interface e gráficos

- formulário acessível;
- criação, edição e exclusão de registros manuais;
- snapshots automáticos somente leitura;
- conflito explícito;
- gráficos e resumos derivados do domínio;
- E2E desktop/mobile.

### PV-1D — Telemetria e produção

- eventos sanitizados;
- Preview;
- deploy do SHA exato;
- smoke não destrutivo;
- atualização final do Handoff.

## Contrato inicial proposto

```ts
export type PortfolioHistorySource =
  | "manual"
  | "automatic_snapshot"
  | "legacy";

export type PortfolioHistoryEntry = {
  schemaVersion: 1;
  userId: string;
  portfolioId: string;
  competence: `${number}-${string}`;
  totalValue: number | null;
  dividends: number | null;
  source: PortfolioHistorySource;
  createdAt: string;
  updatedAt: string;
};
```

O contrato final não confiará em `userId` recebido do cliente. A identidade será injetada pelo servidor.

## Casos obrigatórios

- usuário novo sem carteira;
- usuário com carteira local legada;
- carteira persistida no servidor;
- competência duplicada;
- dezembro para janeiro;
- mês futuro;
- zero válido;
- ausência;
- moeda pt-BR;
- `NaN` e infinito;
- conflito manual/snapshot;
- edição de manual;
- tentativa de editar snapshot;
- tentativa de acessar registro de outro usuário;
- troca de dispositivo/navegador.

## Itens que não serão feitos nesta sprint

- anos anteriores ao corrente;
- importação por planilha;
- checkout;
- anúncios;
- WhatsApp ou Telegram;
- recomendação automática de compra ou venda.
