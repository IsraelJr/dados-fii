# Ledger de verificação de eventos — Risk Lab v0.1

## Objetivo

Registrar documentos candidatos para os casos fora da amostra sem promover datas, fatos ou janelas para a coorte antes da revisão manual da fonte primária.

## Estados

- `pending_document_location`: ainda não há documento oficial candidato.
- `candidate_document_located`: a URL ou o ID oficial foi localizado, mas o conteúdo e as datas primárias ainda podem permanecer desconhecidos.
- `primary_content_verified`: página, trecho, competência, primeira data pública, revisor e denominador da métrica foram confirmados manualmente.

Somente `primary_content_verified` pode se tornar elegível para promoção da coorte. O ledger nunca libera o backtest diretamente.

## Regra para datas

Datas exibidas por agregadores, comentários ou páginas secundárias não são copiadas para `referenceDate`, `publishedAt` ou `eventDateCandidate`.

Enquanto a competência e a primeira data pública não forem confirmadas no documento ou protocolo oficial, os três campos permanecem `null`.

## Casos localizados

### VSLH11

Documento prioritário atualmente localizado:

- FNET ID: `585037`
- tipo: Relatório Gerencial
- competência oficial: ainda não confirmada
- primeira data pública oficial: ainda não confirmada

Um localizador secundário reproduz texto atribuído à gestão indicando aproximadamente 32,8% de inadimplência aguardando renegociação. Esse conteúdo não é evidência aceita pelo motor e precisa ser conferido no documento oficial, com página, trecho e denominador.

O documento FNET `677773`, inicialmente considerado, é posterior ao `585037`. Portanto, ele foi descartado como candidato prioritário para a primeira “bomba”. Usá-lo criaria um evento artificialmente tardio e poderia aumentar falsamente a antecedência aparente do motor.

Ainda é necessário pesquisar documentos anteriores ao `585037`, porque o objetivo é identificar o primeiro documento primário que atende ao critério pré-registrado.

### DEVA11

Documento candidato localizado:

- FNET ID: `1124543`
- tipo: Relatório Gerencial
- competência oficial: ainda não confirmada
- primeira data pública oficial: ainda não confirmada

O localizador secundário indica possível cruzamento do limiar de 10% de inadimplência da carteira de CRIs. As datas exibidas pelo localizador foram removidas do ledger e só poderão retornar depois de validação no protocolo primário.

Antes de promover esse documento, é obrigatório confirmar o PDF oficial, o denominador utilizado e se houve documento anterior que já atendia ao critério pré-registrado.

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
- `publishedAt` representa a primeira data pública confirmada em fonte primária;
- a competência não é confundida com a data acionável;
- o denominador da métrica foi confirmado;
- o revisor e a data da revisão estão registrados;
- foi pesquisado se existe documento primário anterior que já atende ao critério.

## Bloqueios atuais

- o ledger está em `research_only_blocked`;
- `executionAllowed` permanece `false`;
- a coorte continua bloqueada;
- fontes secundárias funcionam apenas como localizadores;
- nenhuma data secundária é armazenada como data oficial;
- nenhuma regra do ruleset v0.1.0 foi alterada;
- nenhum backtest externo foi executado.
