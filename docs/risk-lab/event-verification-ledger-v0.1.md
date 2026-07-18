# Ledger de verificação de eventos — Risk Lab v0.1

## Objetivo

Registrar documentos candidatos para os casos fora da amostra sem promover datas, fatos ou janelas para a coorte antes da revisão manual da fonte primária.

## Estados

- `pending_document_location`: ainda não há documento oficial candidato.
- `candidate_document_located`: a URL oficial foi localizada, mas o conteúdo primário ainda não foi revisado.
- `primary_content_verified`: página, trecho, data de publicação, revisor e denominador da métrica foram confirmados manualmente.

Somente `primary_content_verified` pode se tornar elegível para promoção da coorte. O ledger nunca libera o backtest diretamente.

## Casos localizados

### VSLH11

Documento candidato:

- FNET ID: `677773`
- tipo: Relatório Gerencial
- competência: fevereiro de 2024
- entrega pública candidata: 12/06/2024 às 09:49

O localizador secundário resume possível deterioração material: operações inadimplentes, ativos em execução, marcação negativa e execução judicial de um CRI. Esses fatos ainda não são evidência aceita pelo motor. Precisam ser conferidos no PDF oficial, com página, trecho e denominador.

### DEVA11

Documento candidato:

- FNET ID: `1124543`
- tipo: Relatório Gerencial
- competência: janeiro de 2026
- entrega pública candidata: 27/02/2026 às 18:38

O localizador secundário indica possível cruzamento do limiar de 10% de inadimplência da carteira de CRIs. Antes de promover a data, é obrigatório confirmar o PDF oficial, o denominador utilizado e se houve documento primário anterior que já atendia ao critério pré-registrado.

## Casos ainda sem janela

### MCCI11

A janela de estresse reversível só pode ser definida depois de:

1. coletar avisos oficiais de rendimentos mensais;
2. calcular a queda da média móvel de três meses;
3. confirmar explicação em relatório gerencial primário;
4. confirmar recuperação posterior sem default material.

### RBRY11

Aplica-se o mesmo procedimento de MCCI11. Nenhuma data deve ser inferida a partir de agregadores de dividendos.

## Regras de promoção

Um candidato só pode promover a coorte quando:

- a URL pertence ao FNET ou ao site oficial da gestora;
- o PDF foi aberto e revisado manualmente;
- a página e o trecho estão registrados;
- `publishedAt` representa a primeira data pública;
- a competência não é confundida com a data acionável;
- o denominador da métrica foi confirmado;
- o revisor e a data da revisão estão registrados;
- foi pesquisado se existe documento primário anterior que já atende ao critério.

## Bloqueios atuais

- o ledger está em `research_only_blocked`;
- `executionAllowed` permanece `false`;
- a coorte continua bloqueada;
- fontes secundárias funcionam apenas como localizadores;
- nenhuma regra do ruleset v0.1.0 foi alterada;
- nenhum backtest externo foi executado.
