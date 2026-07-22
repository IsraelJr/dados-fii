# Sprint 3.5 — execução faseada

Status: reorganizada em 22/07/2026

## Decisão

A Sprint 3.5 deixa de ser tratada como uma entrega única. O trabalho passa a ser executado em fases independentes, pequenas e auditáveis. Nenhuma fase bloqueia a evolução de outras funcionalidades do Dados FII.

A funcionalidade completa só será integrada ao produto depois que todas as fases técnicas forem concluídas. Não existe compromisso de entrega rápida nem necessidade de aprovação manual do proprietário sobre conteúdo técnico de FIIs.

## Regras de execução

1. Uma única fase fica ativa por vez.
2. Cada fase deve produzir uma saída verificável própria.
3. Uma fase reprovada não abre automaticamente trabalho na fase seguinte.
4. Correções devem ser gerais; exceções por ticker são proibidas, salvo documentação oficial que justifique uma regra de domínio reutilizável.
5. Produção, Premium e notificações permanecem fora do escopo até as fases finais.
6. O projeto pode priorizar outras funcionalidades entre as fases sem perder o trabalho já produzido.
7. Não serão criadas novas camadas de automação apenas para contornar uma falha externa temporária.

## Fase 3.5-R — reorganização e pausa operacional

Objetivo: interromper o ciclo monolítico e preservar o estado atual.

Entregas:

- remover o agendamento periódico do workflow de recovery;
- manter o workflow disponível somente para execução manual futura;
- preservar checkpoints, evidências, commits e testes existentes;
- arquivar ou fechar PRs experimentais que não serão usados diretamente;
- registrar este plano como referência da Sprint 3.5.

Critérios de aceite:

- nenhuma nova retentativa automática de deploy;
- nenhum novo backtest ou coleta acionado pelo recovery antigo;
- estado anterior preservado e rastreável;
- próxima fase claramente definida.

## Fase 3.5-A — coleta determinística de um único fundo

Fundo inicial: DEVA11.

Objetivo: provar o coletor e o parser em um caso completo, sem backtest e sem Produção.

Entregas:

- processar somente os documentos oficiais de DEVA11 dentro da janela da coorte;
- retomar a partir do checkpoint existente;
- gerar um arquivo de observações mensais de DEVA11;
- gerar resumo de documentos descobertos, processados, ignorados e rejeitados;
- gerar hash do arquivo final;
- adicionar testes para todos os formatos encontrados no caso.

Critérios de aceite:

- zero documentos pendentes dentro da janela;
- zero conflitos não explicados;
- competência, valor, data-base e pagamento rastreáveis ao documento oficial;
- execução repetida produz o mesmo hash;
- nenhuma chamada à Vercel, Produção, Premium ou notificações.

Fora do escopo:

- os outros cinco fundos;
- backtest;
- classificação de risco;
- publicação no produto;
- recovery automático.

## Fase 3.5-B — ampliação fundo a fundo

Objetivo: aplicar o mesmo contrato validado na Fase A aos demais fundos, um por subfase.

Subfases oficiais:

- 3.5-B1: VSLH11;
- 3.5-B2: KNCR11;
- 3.5-B3: KNSC11;
- 3.5-B4: MCCI11;
- 3.5-B5: RBRY11.

Cada subfase terá PR, testes, arquivo de observações e hash próprios. A aprovação de um fundo não depende da conclusão dos fundos seguintes.

Critérios de aceite por subfase:

- mesmos critérios da Fase A;
- nenhuma regressão nos fundos já aprovados;
- nenhuma regra codificada pelo ticker;
- erro documental oficial tratado por regra reutilizável ou documentado como exclusão da coorte.

## Fase 3.5-C — dataset congelado da coorte

Objetivo: unir somente os seis arquivos aprovados nas fases anteriores.

Entregas:

- dataset único da coorte;
- manifesto com versões, fontes e período;
- hash global imutável;
- validação de duplicidade, lacunas, conflitos e look-ahead;
- auditoria automatizada do dataset.

Critérios de aceite:

- seis casos completos;
- zero pendências;
- zero conflitos não resolvidos;
- zero uso de informação futura;
- hash reproduzível;
- nenhuma dependência de Produção.

## Fase 3.5-D — backtest offline

Objetivo: testar a metodologia exclusivamente contra o dataset congelado.

Entregas:

- execução local ou em CI, sem endpoint público;
- resultado por fundo;
- falsos positivos, falsos negativos e casos inconclusivos;
- justificativa técnica de cada resultado;
- evidência com hash vinculada ao dataset da Fase C.

Critérios de aceite:

- resultado determinístico;
- ruleset não alterado durante a mesma execução;
- toda decisão explicável pelos dados congelados;
- nenhuma integração com relatórios Premium ou notificações.

## Fase 3.5-E — automação controlada

Objetivo: automatizar apenas o processo que já tiver sido comprovado offline.

Entregas:

- workflow pequeno e retomável;
- limites explícitos de execução e de novas tentativas;
- artefatos intermediários preservados;
- falhas externas não geram cadeia infinita de commits ou deploys;
- CI oficial e auditoria de segurança.

Critérios de aceite:

- execução sem ação manual do proprietário;
- nenhuma retentativa ilimitada;
- falha deixa evidência clara e retomável;
- não modifica o dataset congelado aprovado.

## Fase 3.5-F — validação em Produção e decisão de produto

Objetivo: validar a infraestrutura final sem ativar automaticamente a funcionalidade para usuários.

Entregas:

- deploy exato da release aprovada;
- smoke test em Produção;
- comparação entre resultado offline e Produção;
- decisão separada sobre integração no relatório, Premium ou alertas.

Critérios de aceite:

- SHA implantado comprovado;
- resultados idênticos ao backtest offline;
- evidência final persistida;
- Handoff canônico atualizado.

## Fase ativa após a reorganização

A próxima fase técnica é a **3.5-A — coleta determinística de DEVA11**.

Ela deve ser iniciada somente depois da conclusão e merge da Fase 3.5-R. Até lá, nenhuma nova tentativa automática da implementação monolítica deve ser executada.
