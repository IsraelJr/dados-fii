# Histórico anual da carteira — V2

## Decisão canônica

O histórico manual de dividendos usa a coleção `UserPortfolioHistory`, com um documento por usuário, carteira e ano.

```text
UserPortfolioHistory/{ownerHash}__{portfolioId}__{year}
```

Cada documento contém `schemaVersion: 2`, `ownerId`, `portfolioId`, `year` e um mapa `months`. Cada mês preserva `dividends`, `source`, `createdAt` e `updatedAt`.

O mapa aninhado é obrigatório. Por exemplo, fevereiro é armazenado como:

```json
{
  "months": {
    "02": {
      "dividends": 450.03,
      "source": "manual"
    }
  }
}
```

Um campo top-level cujo nome literal seja `months.02` não pertence ao formato canônico. Em `set(data, { merge: true })`, chaves do objeto são nomes literais; a semântica de field path pontuado pertence a operações como `update`. A implementação sempre envia um objeto `months` aninhado ao `set`, preservando os demais meses do documento anual.

## Compatibilidade lazy com o campo literal defeituoso

A compatibilidade é restrita ao documento anual do usuário e da carteira acessados; não existe varredura global.

- somente literal: a mesma transação copia o mês para `months[MM]` e remove o campo literal;
- canônico e literal idênticos: mantém o canônico e remove o duplicado literal;
- canônico e literal diferentes: lê o canônico, preserva o literal e emite somente o diagnóstico `PORTFOLIO_HISTORY_LEGACY_CONFLICT` com ano e mês;
- entrada persistida inválida: falha fechado e não sobrescreve o conteúdo existente.

O diagnóstico não contém usuário, carteira, e-mail, valores financeiros ou conteúdo do registro. Uma exclusão manual válida remove os dois formatos da competência solicitada, sem remover o documento anual ou outros meses. Repetir a exclusão é uma operação idempotente.

## Fonte de verdade

- Não há leitura nem migração da estrutura legada existente em `User`.
- Não há documento independente por mês.
- O valor manual representa o total efetivamente recebido no mês.
- Patrimônio manual é proibido; patrimônio histórico depende de snapshot automático confiável.

## Precedência nos dividendos

Para uma mesma competência:

1. valor manual informado pelo usuário;
2. estimativa calculada com os dados atuais da carteira, somente quando não há valor manual.

A regra evita dupla contagem e impede que uma estimativa baseada nas cotas atuais substitua silenciosamente o valor efetivamente recebido no passado.

## Consumidores obrigatórios

A mesma fonte consolidada alimenta:

- lista editável do histórico;
- gráfico anual de dividendos;
- total do ano;
- média mensal;
- maior e menor mês;
- atualizações imediatas após incluir, editar ou excluir.

## Contratos de UX

- O botão de persistência é `Salvar mês`.
- O sucesso deve permanecer visível após o recarregamento.
- A lista permanece após salvar porque funciona como confirmação, edição e auditoria.
- A visualização deve funcionar em modo escuro e em largura móvel sem tabela horizontal cortada.

## Critérios de aceite

- Um único documento anual recebe múltiplos meses.
- Inclusão, edição e exclusão atualizam o gráfico sem recarregar a página.
- Ao retornar à página, o histórico é carregado do banco.
- O gráfico expõe nome acessível por ponto, por exemplo `Jan R$ 120`.
- Testes unitários, Firestore Emulator, build, smoke HTTP e E2E desktop/mobile devem passar no mesmo SHA antes do merge.
