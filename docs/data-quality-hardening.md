# Qualidade de dados e catálogo global de fundos

**Versão:** 1.0.0  
**Data:** 16/07/2026  
**Status:** código e auditoria externa local concluídos; carga e auditoria pós-carga em Produção pendentes.

## Objetivo

Esta entrega corrige uma fragilidade transversal das Fases 1 e 2: funcionalidades prontas não significam produto completo quando a base que alimenta scores, relatórios e IA possui lacunas cadastrais ou associações incorretas.

O catálogo passa a reconciliar o universo negociável da B3 com o cadastro e os informes estruturados da CVM. A prévia é imutável e vinculada a hash; a publicação exige administrador, backup, versão, auditoria e double check.

## Regra permanente de conclusão de fase

Uma fase só pode ser declarada totalmente concluída quando todos os itens abaixo forem verdadeiros:

1. código integrado ao branch principal e CI aprovado;
2. deploy de Produção identificado e saudável;
3. cobertura avaliada sobre todo o universo aplicável, não apenas fundos sentinela;
4. 100% dos tickers B3 elegíveis conciliados individualmente com CNPJ CVM;
5. 100% dos fundos ativos conciliados com dados cadastrais básicos;
6. nenhum CNPJ duplicado entre fundos ativos;
7. lacunas das fontes externas registradas como `null`, com data e aviso — nunca como zero ou fato do fundo;
8. mudanças de ticker, liquidações e inativações confirmadas por evidência oficial;
9. double check persistido depois da carga;
10. relatórios gratuito/Premium, scores e IA homologados com amostra estratificada de FII, FIAGRO e FI-Infra, incluindo casos incompletos e excepcionais.

Se qualquer item estiver pendente, o status correto será “implementada, com homologação/cobertura pendente”, e não “totalmente concluída”.

## Contrato canônico normalizado

Os campos foram separados por natureza para evitar redundância e leituras incorretas. Quantidade de cotas, patrimônio e cotistas não são dados fixos: são snapshots com data de referência.

| Grupo | Campos principais | Natureza |
|---|---|---|
| Identidade | ticker, CNPJ, ISIN, código CVM, nome legal, nome de pregão, FII/FIAGRO/FI-Infra | cadastral |
| Prestadores | administrador, CNPJ do administrador, gestores e respectivos CNPJs, modelo de gestão | cadastral versionado |
| Classificação | setor, segmento, estratégia, classificação regulatória, público-alvo, condomínio, exclusividade, FoF | cadastral/derivado explicável |
| Capital | patrimônio líquido, cotas emitidas, valor patrimonial por cota, data de referência | snapshot |
| Cotistas | total, PF, PJ, percentuais derivados, categorias institucionais e data própria | snapshot |
| Carteira regulatória | imóveis, recebíveis, participações, cotas de fundos, caixa/renda fixa e outros | snapshot derivado dos informes |
| Ciclo de vida | ativo, inativo ou em revisão; presença B3; status CVM; sucessor; motivo | cadastral auditável |
| Proveniência | fontes, hashes, método/confiança do pareamento, competência e execução | auditoria |
| Qualidade | campos ausentes, completude básica/essencial e avisos de consistência/defasagem | derivado |

### Maior cotista pessoa jurídica

Os informes estruturados usados divulgam quantidades por categoria de cotista, mas não identificam sistematicamente a pessoa jurídica com maior posição. O campo existe no contrato, porém permanece `null` até haver fonte pública estruturada e auditável. Uma categoria institucional nunca pode ser apresentada como se fosse a identidade de um cotista.

## Fontes e precedência

1. [B3 — Títulos Negociáveis](https://bvmf.bmfbovespa.com.br/suplemento/ExecutaAcaoDownload.asp?arquivo=Titulos_Negociaveis.zip&server=L): universo negociável, ticker, ISIN e tipo de instrumento.
2. [CVM — Cadastro de Fundos e Classes](https://dados.cvm.gov.br/dados/FI/CAD/DADOS/registro_fundo_classe.zip): CNPJ, nome legal, situação, administrador, gestores e classificação cadastral.
3. [CVM — Informe Mensal FII](https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/): janela móvel de três anos para capital, cotistas e composição patrimonial.
4. [CVM — Informe Mensal FIAGRO](https://dados.cvm.gov.br/dados/FIAGRO/DOC/INF_MENSAL/DADOS/): janela móvel de competências para capital, cotistas e carteira do FIAGRO.
5. [CVM — Informe Diário de Fundos](https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/): PL, cota e cotistas de FIAGRO/FI-Infra quando não publicados no layout FII.
6. Diretórios públicos podem fornecer somente a ponte ticker/CNPJ nos casos ambíguos. O CNPJ precisa existir no cadastro CVM; nenhum indicador desses diretórios é internalizado pelo catálogo.

Cada download recebe hash SHA-256, horário, competência e tamanho. Uma fonte mais fraca nunca sobrescreve uma identidade oficial já conciliada.

## Pareamento e proteção contra falsos positivos

A ordem de resolução é:

1. ISIN B3 ↔ informe CVM;
2. CNPJ existente compatível, preservando conciliações já aprovadas;
3. ponte pública ticker/CNPJ validada no cadastro CVM;
4. nome e assinatura distintiva, considerando ordem dos termos, marca, feeder/FIC, master, série e ano;
5. não conciliado e publicação bloqueada.

O gate de conciliação é 100%. Colisões de CNPJ, divergências de identidade e universo B3 incompleto bloqueiam a aplicação. Ticker presente na B3 nunca é inativado por aproximação de nome.

## Ciclo de vida

- Presente na B3 + CVM normal: ativo.
- Presente na B3 + CVM em liquidação: em revisão; continua visível e não é apagado.
- Ausente da B3 + CVM em liquidação/cancelado: inativo no produto, com histórico preservado.
- Ausente da B3 + mesmo CNPJ/ISIN em novo ticker: ticker anterior inativo e sucessor registrado.
- Ausente da B3 sem segunda evidência: em revisão; nenhuma inativação automática.

## Persistência e custo no Firestore

- `RegulatoryFunds/{ticker}.catalog`: documento canônico atual, suficiente para a consulta de um fundo em uma leitura.
- `RegulatoryCatalogDirectory/current`: diretório materializado dos fundos ativos para listagens, evitando uma consulta ampla por tela.
- `RegulatoryCatalogRuns/{run}` + `chunks`: prévia resumida e plano paginado em blocos de 40.
- `RegulatoryFundBackups/{ticker}/backups`: backup imutável antes de cada alteração.
- `RegulatoryFundVersions/{ticker}/versions`: versões auditáveis.
- `RegulatoryCatalogAudits`: double checks e exceções.
- `RegulatoryAuditLogs`: ator, hash, cobertura e resultado operacional.

O job consulta B3/CVM em lote, lê `Fiis` e `RegulatoryFunds` uma vez por execução e só grava documentos cujo `contentHash` material mudou. Não há um documento duplicado por campo nem chamadas por fundo às fontes oficiais.

## Auditoria externa de 16/07/2026

Resultado obtido antes da carga em Produção:

| Métrica | Resultado |
|---|---:|
| Candidatos elegíveis B3 | 511 |
| Conciliados B3/CVM | 511 (100%) |
| CNPJ duplicado entre ativos | 0 |
| Fundos ativos conciliados | 504 |
| Cadastro básico completo | 504/504 (100%) |
| Indicadores essenciais aplicáveis | 491/502 (97,81%) |
| Em revisão por liquidação/presença B3 | 7 |
| Inativação prevista na base existente | HGPO11 |

Pendências essenciais das fontes:

- abertura PF/PJ não publicada: `BFCC11`, `BRHT11`, `BTML11`, `FINF11`, `IDUA11`, `MTOF11`, `PBLV11`, `REME11`, `RRES11` e `SPAF11`;
- `RJDA11`: ausência adicional de cotas emitidas, patrimônio líquido e total de cotistas nos layouts estruturados usados;
- divergência histórica de ISIN preservada para revisão, sem trocar CNPJ: `KISU11`, `SPTW11` e `TRXF11`.

Essas exceções não impedem o cadastro básico, mas impedem afirmar 100% de cobertura essencial. Elas devem continuar visíveis no Admin e nos relatórios quando aplicável.

## Procedimento de Produção

1. publicar o código e confirmar CI/deploy;
2. entrar em `/admin/sistema` com e-mail verificado e autorizado;
3. clicar em **Analisar fontes oficiais**;
4. confirmar 511/511, 100% básico, zero duplicidade e revisar todas as exceções/inativações;
5. clicar em **Aplicar atualização** somente se a prévia estiver liberada;
6. aguardar backups, versões e diretório materializado;
7. clicar em **Fazer double check**;
8. homologar relatórios e IA em amostra estratificada;
9. somente então reavaliar a conclusão das Fases 1 e 2.
