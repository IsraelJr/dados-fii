# Importação manual de avisos estruturados FNET — Risk Lab v0.1

## Objetivo

Coletar rendimentos mensais oficiais de MCCI11 e RBRY11 para a validação fora da amostra sem contornar o captcha da pesquisa pública do FNET e sem aceitar agregadores como evidência.

## Fluxo

1. o administrador informa somente o ID numérico de um documento conhecido;
2. o servidor constrói internamente as URLs oficiais do aviso e do protocolo;
3. os dois HTMLs são baixados, limitados a 2 MB e validados;
4. o aviso fornece ticker, competência, valor, data-base e pagamento;
5. o protocolo fornece o horário exato da entrega pública;
6. hashes SHA-256 dos dois artefatos são registrados;
7. o candidato permanece como `pending_manual_review`;
8. o administrador abre os dois documentos oficiais e confirma os campos;
9. a aprovação cria uma observação mensal verificada;
10. nenhum detector ou backtest é executado automaticamente.

## Segurança

- não há campo de URL livre;
- somente IDs numéricos de até 12 dígitos são aceitos;
- somente o host oficial `fnet.bmfbovespa.com.br` é consultado;
- a rota exige sessão administrativa, mesma origem e rate limit;
- a importação é desligada por padrão;
- feature flag: `ENABLE_RISK_LAB_FNET_IMPORT=true`;
- somente MCCI11 e RBRY11 são aceitos nesta rodada;
- conteúdo que não seja HTML é rejeitado;
- timeout de consulta: 15 segundos;
- a aprovação exige confirmação humana explícita.

## Persistência

### `RiskLabNoticeCandidates`

Pré-visualizações importadas, incluindo dados estruturados, hashes, estado da revisão e responsáveis.

### `RiskLabVerifiedDividendNotices`

Uma única observação aprovada por `ticker + competência`. Documento diferente para o mesmo mês produz conflito e não sobrescreve a série.

### `RiskLabNoticeAudit`

Eventos de importação, aprovação e rejeição, com responsável, horário, documento e hashes.

## Checklist de aprovação

Antes de aprovar, conferir nos dois documentos oficiais:

- ticker;
- competência;
- valor por cota;
- data-base;
- data de pagamento;
- data e horário de entrega;
- se o documento é realmente um aviso estruturado de rendimentos;
- se não existe outra versão para a mesma competência que substitua o documento importado.

## Limitações

- o FNET pode alterar a estrutura HTML; o parser falhará fechado quando um campo obrigatório desaparecer;
- a pesquisa pública com captcha não é automatizada nem contornada;
- IDs precisam ser localizados manualmente ou por fonte oficial permitida;
- a aprovação não significa que a janela de estresse esteja completa;
- o detector exige pelo menos nove meses consecutivos e revisados;
- não há integração com Relatório Premium, IA textual ou notificações;
- nenhum backtest externo é liberado por este fluxo.
