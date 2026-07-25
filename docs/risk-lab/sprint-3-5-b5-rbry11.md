# Sprint 3.5-B5 — RBRY11

## Estado

Caso determinístico concluído na branch da fase, aguardando CI, merge, auditoria do `main` e atualização canônica.

Esta unidade processa somente o RBRY11. Dataset final, backtest, calibração, Premium e notificações permanecem fora do escopo.

## Identidade e janela

- ticker: `RBRY11`;
- CNPJ: `30166700000111`;
- papel metodológico: `reversible_stress`;
- janela fechada: `2022-01-01` a `2025-12-31`.

## Fontes imutáveis

### Diagnóstico original

- workflow run: `29881954620`;
- artifact: `8515476365`;
- SHA-256: `8ed76121aa14086cba740ad921cdcef925e44bd274cb86ca42bc14bba1ee9d0e`;
- release commit: `b54bc58276f43695c3f48f2aa8c9f47a2cadac2a`.

### Retentativa oficial

- workflow run: `30128298963`;
- artifact: `8610152329`;
- SHA-256: `7399a9fda29f298c051da2f35b8bd96921e93ffd09daef2a4df6552a5465ed45`;
- head commit da coleta: `46ea417d9976fbc779c73dcd60de277fd129257d`.

Os dois ZIPs foram baixados novamente e seus digests conferiram.

## Estado inicial

- 54 documentos descobertos;
- 49 concluídos e 49 observações preservadas;
- quatro classes secundárias: `300850`/RBRY15, `300852`/RBRY14, `300855`/RBRY13 e `350224`/RBRY13;
- uma falha transitória: `987180` — `This operation was aborted`;
- documento `254829` com competência futura `2022-12`, embora anúncio, informação e data-base fossem de janeiro de 2022.

## Retentativa oficial

O coletor real do projeto retomou o checkpoint congelado e recuperou somente o documento `987180`:

- competência: `2025-08`;
- valor: R$ 1,25 por cota;
- data da informação e data-base: `2025-09-09`;
- pagamento: `2025-09-16`;
- source hash: `ad593ddfdc91a65e3006cc5fec30a492cf260549531526b802d9dd79eadc827c`;
- protocol hash: `00c7be71bcb5620b626f4a9dbc5652f33ce9b06cdc5db355a9ee548754503e35`.

Foi criado `FrozenDividendRetryCheckpointAuditor`, sem ticker ou documento hardcoded. Ele compara os checkpoints antes e depois, exige universo descoberto idêntico, impede alteração de observações anteriores e aceita apenas recuperação transitória oficial ou classe secundária comprovada da mesma família.

## Sanitização temporal

O sanitizador geral já homologado classificou o documento `254829` como `outside_cohort_window_year_rollover_metadata_drift`: a competência reportada `2022-12` foi corrigida metodologicamente para `2021-12`, fora da coorte.

## Reapresentações

- `427520` versão 2 substitui `427474` versão 1 na competência `2023-02`, alterando R$ 1,15 para R$ 1,20;
- `1009923` versão 2 substitui `1009913` versão 1 no mesmo evento oficial e corrige a competência de `2025-10` para `2025-09`;
- `1033803` permanece como observação econômica de `2025-10`.

## Resultado

- documentos classificados: `54/54`;
- observações brutas no diagnóstico: `49`;
- observações após retentativa: `50`;
- observações após sanitização temporal: `49`;
- competências selecionadas: `47`;
- período contínuo: `2022-01` a `2025-11`;
- lacunas: `0`;
- maior sequência contínua: `47` meses;
- pendências: `0`;
- conflitos: `0`.

## Hashes determinísticos

- checkpoint original: `fcdac97fb7bafabb0b5199a31ac2e92b585973af6e08256b45c268a5162cb08a`;
- checkpoint após retentativa: `39de4494f0050568601f81a9db1eb3145df584ffb8d6406a6e85ccc91a38e0df`;
- checkpoint sanitizado/final: `e1b080d2f097fadbe3dcc695bbb5d06f4a2c389671b5125ce26efd7ad8874815`;
- auditoria da retentativa: `0f3848ee50d998a4a49f286ddb21b3afc362ae0492b7aa3f6217d02952f87b40`;
- sanitização: `cd3b231797d25522cd5165191adc4ec0772e5a4ea16afea27b78f29d392ec559`;
- caso: `7ad063f48238652e10862fb0bbbc0d655413afb62ae10a50ff59af4076e6178d`;
- auditoria final: `00b9b25a9e063f95c2041a50f7893a6138daab241cfd59647a677eeafbfebb52`;
- observações: `5085c1610ab8b35c9835443779ef33995540f4ec766a31302694963230dc4e85`;
- índice: `938b856f5a74edcd404b494f68a33654c1f68b4ae01a392de56e6cbc5c741ed1`.

Duas execuções determinísticas produziram os mesmos hashes.

## Segurança e impacto

- nenhuma regra contém exceção por ticker;
- nenhum endpoint, UI, Firestore ou código de produto foi alterado;
- nenhuma notificação foi enviada;
- nenhum relatório Premium consome esta evidência;
- nenhum backtest foi executado;
- o workflow e o script temporários de coleta foram removidos antes do gate final.

## Rollback

Reverter a PR funcional remove o auditor, seus testes, o gate e as evidências do RBRY11. Não existe estado operacional ou integração de produto a desfazer.
