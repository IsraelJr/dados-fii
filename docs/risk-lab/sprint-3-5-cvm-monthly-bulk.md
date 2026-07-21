# Sprint 3.5 — série mensal oficial em lote

O backtest segmentado deixa de depender de dezenas de consultas individuais ao Fundos.NET para reconstruir rendimentos.

## Fonte primária

- arquivo anual: `inf_mensal_fii_<ano>.zip`;
- origem: conjunto de dados oficial de Informe Mensal FII da CVM;
- tabelas obrigatórias: ativo/passivo, complemento e geral;
- identidade: CNPJ do fundo/classe;
- competência e versão: `Data_Referencia` e maior `Versao` comum às três tabelas;
- conhecimento temporal: `Data_Entrega`;
- cálculo determinístico: `Rendimentos_Distribuir / Cotas_Emitidas`.

## Controles

- hash SHA-256 do ZIP e das linhas usadas;
- versão da fonte em cada observação;
- corte por janela pré-registrada da coorte;
- exclusão de entrega posterior à data simulada;
- bloqueio para tabelas ausentes, versões incompatíveis, cotas divergentes, campos inválidos, meses ausentes ou competências duplicadas;
- cache anual para evitar downloads repetidos entre os seis fundos;
- nenhuma entrada ou aprovação técnica manual;
- Premium e notificações permanecem fora do fluxo.

O nome `ConcurrentAutomaticDividendSeriesService` é preservado apenas como contrato de compatibilidade do executor segmentado. Sua implementação passa a delegar ao lote anual oficial da CVM.
