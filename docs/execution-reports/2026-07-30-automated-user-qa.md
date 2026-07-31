# Relatório de execução — QA automatizado de usuário

**Data:** 30/07/2026
**Branch:** `agent/functional-qa-automation`
**Status de merge:** não recomendado enquanto secrets e gate remoto não estiverem confirmados

## Arquivos alterados

- configuração Playwright e scripts npm;
- fixture de evidências e redator de artefatos;
- suíte funcional remota e regressão E2E local;
- workflow único de QA funcional;
- política, inventário e testes de governança do GitHub Actions;
- login/logout Firebase e emissão revogável de sessão da carteira;
- integração do usuário de preview com relatórios;
- documentação operacional e este relatório.

## Testes criados

- contrato arquitetural de QA, isolamento, matriz, evidências e sessão;
- autenticação válida e inválida, persistência, logout e bloqueio;
- histórico de janeiro a junho, recálculo, gráfico, navegação, reload, falha de rede e cleanup;
- consulta válida, inexistente e inválida, percentuais e responsividade;
- acesso, geração, persistência, PDF e conteúdo de relatório;
- axe nas telas principais, bloqueando impactos `serious` e `critical`.

## Jornadas cobertas

As jornadas A a G são executadas em Playwright. Preview usa o bypass da Vercel exclusivamente por header. A matriz cobre Desktop Chromium, Mobile Chrome e Mobile Safari/WebKit. O mesmo workflow atende Preview, smoke pós-deploy, smoke diário e suíte semanal completa.

## Secrets necessários

- `E2E_USER_EMAIL`, em `Preview` e `Production`;
- `E2E_USER_PASSWORD`, em `Preview` e `Production`;
- `VERCEL_AUTOMATION_BYPASS_SECRET`, em `Preview`.

O usuário deve ser Firebase verificado, exclusivo de QA, não administrativo e incluído em `PREMIUM_PREVIEW_EMAILS` na Vercel.

## Resultados

| Gate | Resultado |
|---|---|
| TypeScript | aprovado |
| ESLint | aprovado |
| Governança de workflows | aprovado |
| Contrato arquitetural de QA | aprovado |
| Testes completos | aprovado: 602/602 |
| Firestore rules | aprovado: 3/3 no Emulator |
| Cobertura crítica | aprovado: linhas 100%, branches 93,66%, funções 98,53% |
| Mutation sanity | aprovado |
| Secret scan | aprovado: 627 arquivos |
| Auditoria de dependências de produção | aprovado: 0 vulnerabilidades |
| Build | aprovado com credencial Firebase sintética |
| HTTP smoke | aprovado |
| E2E local | aprovado: 16 testes em Desktop Chromium e Mobile Chrome; 10 jornadas remotas corretamente ignoradas sem `E2E_BASE_URL` |
| E2E Preview real | bloqueado até provisionamento dos secrets |

## Riscos

- Os três secrets ainda não existem nos environments consultados.
- A branch `main` ainda não possui proteção configurada.
- O evento `deployment_status` só passa a carregar este workflow automaticamente quando ele existir na branch padrão; o primeiro PR requer dispatch controlado após configurar secrets.
- A geração completa de relatório depende de disponibilidade da OpenAI e dos serviços regulatórios.
- Safari móvel pode revelar diferenças reais de layout ou acessibilidade que hoje não aparecem na regressão Chromium.

## Custo estimado de CI

Estimativa inicial: aproximadamente 520 minutos por mês, considerando 26 smokes diários, quatro suítes semanais e até 12 Previews. A projeção deve ser recalibrada após 30 dias usando duração real dos jobs. Artefatos existem somente em falha e são retidos por sete dias.

## Limitações

- Credenciais e entitlement do usuário de QA não são criados pelo repositório; o provisionamento permanece em Firebase, Vercel e GitHub environments.
- O smoke de produção é intencionalmente não destrutivo; mutações completas ficam no usuário isolado durante Preview e na suíte semanal.
- Vídeos são protegidos visualmente por máscara; traces e relatórios passam por redação antes de qualquer upload.

## Recomendação de merge

Não fazer merge enquanto qualquer gate falhar ou estiver ausente. A recomendação muda para favorável somente após os gates locais completos, o Preview real nos três dispositivos, a configuração dos secrets e a proteção de `main` exigindo `Functional QA Preview`.
