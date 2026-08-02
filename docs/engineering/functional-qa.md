# QA funcional automatizado

## Finalidade e limites

A automação reutiliza o Playwright do projeto para validar Preview e produção como usuário real. Ela não usa credenciais de proprietário ou administrador, não cria uma segunda ferramenta E2E e só altera dados artificiais pertencentes ao usuário exclusivo de QA.

A Home `/` mantém o botão flutuante de Login oculto, conforme a decisão da PR #149. Toda autenticação funcional começa em `/carteira`.

## Provisionamento do usuário

Crie uma conta Firebase Authentication exclusiva para QA, com e-mail verificado e sem e-mail, claim ou papel administrativo. O usuário não pode constar em `ADMIN_EMAILS`.

Configure nos environments `Preview` e `Production` do GitHub:

- `E2E_USER_EMAIL`;
- `E2E_USER_PASSWORD`;
- `VERCEL_AUTOMATION_BYPASS_SECRET`, somente em `Preview`.

O sufixo exato do projeto/equipe Vercel está fixado no runner imutável e coberto por teste arquitetural. O alvo manual não aceita URL livre: recebe um SHA de deployment e resolve a origem pelo registro de Deployments do GitHub, exigindo deployment e status criados por `vercel[bot]`. Execuções locais diretas continuam obrigadas a informar o mesmo sufixo explicitamente.

Para a jornada do relatório de risco da carteira, o documento server-side desse usuário deve ter `isVip: true`. Não use `PREMIUM_PREVIEW_EMAILS` para conceder esse acesso: o controller da carteira aceita somente o entitlement persistido pelo servidor. E-mail ou conteúdo de `localStorage` enviado pelo cliente não concede plano, VIP ou administração.

Antes do provisionamento final, confirme por execução automatizada que o token Firebase do usuário recebe `403` ao tentar criar sessão administrativa. Nenhum valor real deve aparecer em argumentos, query string, nomes de artefato, títulos ou logs.

## Alteração funcional de runtime na PR #168

A PR mantém, por dependência direta da jornada, uma alteração de autenticação aplicável a todos os usuários:

- o componente de Login observa a sessão Firebase e oferece logout em `/carteira`;
- um token Firebase verificado pode ser trocado por uma sessão aleatória da carteira;
- a sessão dura no máximo 12 horas, é vinculada ao par e-mail/token e é revogada no logout;
- a expiração ou um `401` autenticado força nova troca de ID token; falha de renovação limpa a sessão e volta a exibir Login;
- a renovação usa lock entre abas e eventos de storage para impedir que uma aba continue com credenciais antigas;
- a Home continua sem o botão flutuante.

Não há mudança de entitlement Premium nos controllers de relatório: a ampliação originalmente incluída na PR foi removida durante a auditoria. Se a mudança de sessão for separada em outra PR, a suíte funcional deve apontar para um Preview que contenha essa dependência.

## Execuções

| Evento | Ambiente | Escopo | Navegadores |
|---|---|---|---|
| Deploy Vercel Preview bem-sucedido | Preview | crítico + login inválido + isolamento + relatório/PDF | Desktop Chromium, Mobile Chrome e Mobile Safari/WebKit |
| Deploy Vercel Production bem-sucedido | Produção | smoke sem senha incorreta | Desktop Chromium |
| Segunda a sábado, 09:23 UTC | Produção | smoke diário sem senha incorreta | Desktop Chromium |
| Domingo, 09:23 UTC | Produção | suíte completa | Desktop Chromium, Mobile Chrome e Mobile Safari/WebKit |
| Manual | ambiente escolhido | smoke, crítico ou completo | conforme o escopo |

O workflow usa `workers=1`. Há um retry somente na CI; localmente não há retry.

## Separação de confiança

`functional-qa.yml` é apenas um dispatcher sem acesso a secrets. Ele chama `functional-qa-runner.yml` por SHA imutável. O workflow chamado é o único que declara os environments e lê as credenciais. O runner também faz checkout de um SHA imutável próprio; `deployment_sha` nunca é usado como `ref`, comando, dependência ou código executável.

### Bloqueio comprovado de Environment secrets em 02/08/2026

Os três registros existem no environment literal `Preview`, mas execuções novas do reusable workflow receberam os nomes como strings vazias. Também foram testados, sem sucesso, contrato `workflow_call.secrets`, marcador homônimo, marcador de namespace separado e `deployment: false`. O preflight falhou fechado em todas as variantes antes de instalar navegadores, autenticar ou gerar artefatos.

Não foi adotado repasse pelo dispatcher, `secrets: inherit`, Repository secrets nem um runner direto mutável, pois essas alternativas quebrariam a separação de confiança desta PR. O gate remoto permanece bloqueado até o GitHub disponibilizar os Environment secrets ao job chamado ou até uma nova topologia de runner direto e separadamente confiável ser aprovada e auditada.

Para Preview manual, o operador informa somente o SHA. O runner consulta os Deployments do próprio repositório, aceita apenas registros do `vercel[bot]` e extrai a URL do status bem-sucedido correspondente. A origem ainda precisa passar pela política de hostname do projeto.

## Competências, isolamento e limpeza

- A suíte calcula o calendário em `America/Sao_Paulo`.
- Só competências do ano corrente que já terminaram são usadas.
- Em janeiro, nenhuma competência é gravada; em fevereiro, somente janeiro; a regressão cobre janeiro, fevereiro e a virada dezembro/janeiro.
- Os valores artificiais de janeiro a junho são usados apenas quando os respectivos meses já encerraram.
- Fevereiro é excluído e reinserido quando já é uma competência fechada.
- O cleanup consulta o backend e remove somente competências manuais artificiais da execução corrente.
- A carteira artificial do relatório fica vazia no `finally`.
- O cleanup é idempotente e roda também em falha.

## Evidências e sigilo

Antes de instalar os navegadores ou iniciar uma navegação autenticada, a CI executa `test:artifact-redaction`. O teste sentinela cria `.trace`, `.network`, HAR, cookies, headers, localStorage e ZIP aninhado com valores falsos, executa o redator, descompacta recursivamente todo o conteúdo e falha se qualquer sentinela permanecer.

Em falha, o Playwright conserva trace e vídeo. A fixture salva screenshot mascarado, console e requests sanitizados, SHA, ambiente e origem. O redator trata:

- e-mail e senha;
- `Authorization`, tokens Bearer e JWT;
- `x-wallet-session`;
- cookies e `Set-Cookie`;
- localStorage, sessionStorage e storage state;
- bypass da Vercel;
- query parameters sensíveis;
- `.trace`, `.network`, HAR, JSONL e arquivos compactados aninhados.

E-mail e senha ficam visualmente transparentes durante toda a captura de vídeo e são mascarados nos screenshots. Se o sentinela ou a redação pós-falha falhar, o upload não acontece. Artefatos ficam retidos por até sete dias.

O bypass da Vercel não é configurado como header global do navegador. Um setup isolado faz uma única requisição sem redirects para a origem exata do Preview, obtém `_vercel_jwt`, encerra o cliente HTTP e entrega apenas o cookie ao contexto Playwright. Testes provam que Firebase, Google Analytics e origens externas recebem conjunto vazio de headers de bypass.

## Gate e operação

O workflow publica `Functional QA Preview` no SHA implantado. Esse contexto deve ser obrigatório em `main`, junto da CI central. `Functional QA Production Smoke` é o gate pós-deploy.

A PR #168 deve permanecer draft e sem merge até:

1. todos os gates locais e da PR estarem verdes;
2. os secrets terem sido provisionados;
3. a suíte real de Preview passar nos três dispositivos;
4. o usuário de QA provar `403` administrativo e entitlement apenas server-side;
5. a proteção de `main` exigir `Functional QA Preview`.

Execução local determinística:

```bash
npm run test:e2e:local
```

Execução remota direta de desenvolvimento:

```bash
E2E_BASE_URL=https://preview.example \
E2E_ENVIRONMENT=Preview \
E2E_REMOTE=1 \
E2E_USER_EMAIL=... \
E2E_USER_PASSWORD=... \
VERCEL_AUTOMATION_BYPASS_SECRET=... \
VERCEL_PREVIEW_HOST_SUFFIX=-equipe-exata.vercel.app \
npm run test:e2e -- --grep='@critical|@preview'
```

Nunca cole valores reais em documentação, issue, PR ou log.
