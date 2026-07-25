# Prompt Premium v3 — Modo Gestor informativo

## Origem e integridade

- especificação de origem: `Modo_Gestor_Relatorio_Premium_v2(1).html`;
- SHA-256 da especificação: `420eb6c2ac23ab0b0daa331ffd54cdb7215f688f38c5b628c57eabccbcc25a59`;
- versão implementada: `premium-fund-analysis-v3`;
- integração Risk Lab: `premium-readonly-v1`;
- ruleset consumido: `0.2.0`.

## Adaptação aplicada

A especificação de origem descreve um Modo Gestor completo, com quantidades planejadas, preço médio, aporte mensal e decisões de compra. O contrato atual do Relatório Premium recebe apenas ticker e quantidade de cotas da carteira. Portanto, a Sprint 3.7 implementa somente a parte que pode ser sustentada pelos dados existentes:

- leitura objetiva da posição atual;
- qualidade e completude dos dados disponíveis;
- valuation, renda, scores, pares, cenários e eventos;
- Risk Lab homologado em modo read-only;
- gatilhos positivos e negativos de monitoramento;
- limitações explícitas para preço médio, quantidade planejada, aporte e meta.

A IA não pode produzir ranking de compra, quantidade de próxima ordem ou recomendação individualizada enquanto esses dados não fizerem parte de um contrato determinístico e validado.

## Invariantes

1. cálculos determinísticos vêm antes da IA;
2. o JSON é a única fonte do modelo;
3. a IA não altera disposição, alerta, proveniência ou limitações do Risk Lab;
4. ausência de sinal não significa ausência de risco;
5. recuperação informativa não significa compra;
6. MCCI11 permanece inconclusivo;
7. maior desconto não implica automaticamente melhor ativo;
8. dado ausente permanece indisponível;
9. nenhuma notificação ou efeito externo é permitido;
10. o conteúdo é informativo e não constitui recomendação de investimento.

## Registro gerado

O registro runtime `risk-lab-premium-readonly-v1.json` possui SHA-256 `982b1c9911610eb58ad6e0af5ea6ed801063c2b9f80783a5ee9c0b45b6de9ac9` e é validado antes de qualquer leitura.
