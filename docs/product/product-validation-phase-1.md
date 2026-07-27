# Dados FII — Fase de Validação do Produto

**Data:** 27/07/2026  
**Status:** diretriz aprovada para incorporação ao `DADOS_FII_HANDOFF.md`  
**Branch:** `agent/product-validation-phase-1`

## Decisão

O Dados FII encerra o ciclo em que concepção, amplitude funcional e testes internos eram o eixo principal. A fase vigente passa a ser **Produto Validável**, orientada a ativação, retenção, confiança e futura conversão paga.

Esta diretriz substitui, no roadmap de produto, a prioridade anterior dada a SEO-S1 e Google AdSense. Correções obrigatórias de segurança, integridade, privacidade e indexação permanecem válidas, mas expansão de SEO, conteúdo e monetização por anúncios fica congelada.

## Objetivo da fase

Comprovar que um usuário real consegue:

1. criar ou carregar sua carteira;
2. compreender patrimônio, dividendos e concentração;
3. completar gratuitamente o histórico do ano corrente;
4. retornar ao produto e encontrar seus dados íntegros;
5. perceber valor suficiente para demonstrar interesse no Premium.

## Sprint atual — PV-1: jornada principal da carteira

### Escopo obrigatório

- auditar cadastro/login, criação, importação e persistência da carteira;
- permitir cadastro manual de histórico do ano corrente;
- registrar `ano`, `mês`, `patrimônio` e `dividendos`;
- editar e excluir registros manuais;
- impedir duplicidade por usuário, carteira, ano e mês;
- distinguir visualmente entrada manual de snapshot automático;
- preservar snapshots e dados legados;
- recalcular gráficos, totais e resumos sem misturar mês corrente provisório com mês encerrado;
- manter a funcionalidade gratuita e sem pedágio de propaganda;
- adicionar telemetria da jornada sem dados financeiros sensíveis em logs ou eventos.

### Regras de domínio

1. Entrada manual só pode representar mês anterior ou mês corrente permitido pelo contrato vigente; datas futuras são rejeitadas.
2. Snapshot automático é a fonte prioritária quando existir para a mesma competência; conflito não é sobrescrito silenciosamente.
3. Valores monetários usam decimal validado e apresentação `pt-BR`; `NaN`, infinito e negativos não permitidos são rejeitados.
4. Ausência não é convertida em zero.
5. Toda mutação exige identidade resolvida no servidor, idempotência e auditoria sanitizada.
6. O usuário pode informar mês e ano. O sistema não presume ano quando houver ambiguidade de virada anual.
7. Gráficos identificam a proveniência do ponto: `manual`, `snapshot` ou `legado`.
8. A funcionalidade não depende de AdSense, anúncio assistido ou plano pago.

### Critérios de aceite

A Sprint PV-1 só pode ser declarada concluída quando houver evidência no mesmo SHA para:

- testes unitários de validação, conflito, edição e exclusão;
- testes de integração da persistência e autorização;
- Firestore Emulator ou equivalente para regras e isolamento entre usuários;
- E2E desktop e mobile da jornada completa;
- carteira vazia, carteira existente e histórico legado;
- fronteira dezembro/janeiro e mês corrente/mês encerrado;
- build de produção e smoke HTTP;
- Preview aprovado;
- deploy de produção do SHA exato;
- smoke não destrutivo em produção;
- zero thread bloqueadora;
- Handoff canônico atualizado com PR, SHA, runs e evidências reais.

## Sprint seguinte — PV-2: descoberta do Premium

### Escopo

- tornar o Premium visível a todos, sem fingir que existe contratação disponível;
- apresentar proposta, benefícios, limitações e amostra;
- disponibilizar `Quero participar do beta`;
- registrar interesse, origem e consentimento;
- manter geração Premium restrita ao proprietário e à coorte beta autorizada no servidor;
- não implementar checkout antes de sinais mínimos de demanda.

### Aceite

- nenhum botão de pagamento falso;
- entitlement exclusivamente server-side;
- telemetria de visualização e interesse;
- custo de IA controlado;
- fluxo de beta revogável e auditável.

## Sprint seguinte — PV-3: telemetria e beta real

Eventos mínimos:

- `portfolio_created`;
- `portfolio_completed`;
- `history_month_added`;
- `history_month_updated`;
- `history_month_deleted`;
- `portfolio_viewed`;
- `portfolio_report_viewed`;
- `premium_viewed`;
- `premium_interest_submitted`;
- `user_returned_7d`;
- `user_returned_30d`.

Nenhum evento pode conter carteira, posição, patrimônio, dividendos, e-mail, token ou identificador bruto desnecessário.

## Métricas de decisão

- ativação: usuário cria e completa carteira;
- adoção: usuário adiciona histórico;
- retenção: retorno em 7 e 30 dias;
- valor percebido: uso recorrente de carteira e relatórios;
- demanda: visualização e manifestação de interesse no Premium;
- confiabilidade: taxa de erro por etapa e divergências financeiras;
- sustentabilidade: custo operacional e de IA por usuário ativo.

## Itens congelados

Até PV-1 estar comprovada em produção:

- novas frentes de Google AdSense;
- expansão editorial em massa;
- screener e comparador avançados;
- novos canais WhatsApp/Telegram;
- checkout, recorrência e conciliação financeira;
- grandes mudanças visuais sem impacto comprovável na jornada;
- novas modalidades de relatório;
- funcionalidades que não aumentem ativação, retenção, confiança ou futura conversão.

## Ordem oficial provisória

1. PV-1 — jornada principal da carteira e histórico manual gratuito do ano corrente;
2. PV-2 — Premium visível e lista de interesse/beta;
3. PV-3 — telemetria, beta e validação de retenção/disposição a pagar;
4. Radar/Acompanhar fundo fora da carteira;
5. inteligência documental e `o que mudou`;
6. carteira histórica avançada, retorno total e atribuição;
7. ferramentas genéricas e expansão SEO somente após evidência de produto.

## Pendências abertas

- provedor e fluxo de cobrança;
- preço e limites dos planos;
- política de beta e quantidade de usuários;
- importação de anos anteriores;
- retenção e exclusão de dados históricos;
- tratamento comercial e fiscal da assinatura;
- canais adicionais de alerta.

## Regra de governança

Nenhuma nova ideia fura a ordem sem demonstrar impacto direto em uma destas dimensões: ativação, retenção, confiança, conversão ou redução de custo/risco. Planejamento sem implementação, teste e evidência de produção não encerra sprint.