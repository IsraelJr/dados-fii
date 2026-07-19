# Fila manual de coleta FNET — v0.1

## Objetivo

Organizar IDs oficiais já localizados para MCCI11 e RBRY11 sem criar importação em lote, aprovação automática ou execução do detector.

## Rota

`/admin/risk-lab/collection-queue`

Abrir a página realiza somente um `GET` no endpoint existente de avisos para reconhecer IDs já importados.

## Entrada

- IDs numéricos com até 12 dígitos;
- separadores aceitos: espaço, vírgula, ponto e vírgula e quebra de linha;
- duplicidades removidas preservando a primeira ocorrência;
- máximo de 20 IDs válidos e únicos;
- tokens inválidos são ignorados e informados ao administrador.

## Regra operacional

Montar a fila é uma operação local e não produz chamadas de importação.

Cada documento possui um botão próprio `Importar este ID`. Somente um documento pode estar em importação por vez.

Não existe:

- botão `Importar todos`;
- `Promise.all` de documentos;
- loop de chamadas ao endpoint;
- aprovação automática;
- execução automática do detector.

## Fonte confiável

A fila não é evidência e não cria nova coleção no Firestore. O registro confiável continua sendo o candidato persistido pelo importador existente, com aviso, protocolo, hashes e revisão humana.

## Efeitos proibidos

A fila não pode:

- aprovar ou rejeitar candidatos;
- gravar observações verificadas diretamente;
- executar o detector de estresse;
- criar alertas ou notificações;
- alterar o Relatório Premium;
- escolher a janela histórica com base no valor dos rendimentos.

## Feature flag

A fila respeita a mesma flag do importador existente:

```text
ENABLE_RISK_LAB_FNET_IMPORT=true
```

Com a flag desligada, ainda é possível montar a fila local, mas os botões de importação permanecem desabilitados.
