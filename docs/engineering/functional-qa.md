# QA funcional automatizado

## Finalidade e limites

A automação reutiliza o Playwright do projeto para validar Preview e produção como usuário real. Ela não usa credenciais de proprietário ou administrador, não cria uma segunda ferramenta E2E e só altera dados artificiais pertencentes ao usuário exclusivo de QA.

A Home `/` mantém o botão flutuante de Login oculto, conforme a decisão da PR #149. Toda autenticação funcional começa em `/carteira`.

## Provisionamento do usuário

Crie uma conta Firebase Authentication exclusiva para QA, com e-mail verificado e sem e-mail, claim ou papel administrativo. O usuário não pode constar em `ADMIN_EMAILS`.

Configure como Repository secrets dedicados ao QA:

- `QA_PREVIEW_USER_EMAIL`;
- `QA_PREVIEW_USER_PASSWORD`;
- `QA_PREVIEW_VERCEL_BYPASS_SECRET`.

O dispatcher mapeia explicitamente esses três nomes para `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` e `VERCEL_AUTOMATION_BYPASS_SECRET` no contrato do reusable workflow. Não se usa `secrets: inherit`. O bypass só é injetado no job literal de Preview; o job de produção não possui essa variável nem o sufixo do Preview.

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

## Estabilização da interface autenticada

As jornadas autenticadas usam uma fixture única para estabilizar o consentimento. Ela detecta o diálogo `Privacidade e cookies`, registra uma escolha explícita quando necessário, aguarda a remoção do diálogo e comprova que o overlay deixou de interceptar cliques. O procedimento é idempotente e não remove o banner do produto, não injeta CSS para ocultá-lo e não usa `force: true`.

Alvos móveis são localizados semanticamente, centralizados na viewport, observados por dois frames de layout e validados com `elementFromPoint` antes do clique normal. Isso cobre o botão `Acessar Premium` sob viewport estreita e header fixo sem coordenadas absolutas.

O login registra `waitForResponse` para `POST /api/user-profile` antes do submit, mas não considera a rede isoladamente como autenticação. O estado só é aceito quando o formulário desaparece, `Sair da conta` fica visível, a sessão existe sem leitura ou impressão dos valores e uma chamada protegida da carteira retorna `200`. A resposta obrigatória do perfil também precisa ser bem-sucedida. Assim, uma resposta rápida continua capturada mesmo quando a validação funcional ocorre depois.

A falha de desktop observada no run `30766752729` não era uma corrida do listener: a validação do produto restringia a senha a letras e dígitos e barrava credenciais Firebase válidas com caractere especial antes de qualquer request. A política continua exigindo seis caracteres, letra e número, mas não limita o restante do alfabeto da senha. Em Mobile Chrome e WebKit, a causa comprovada foi a sobreposição do consentimento e, no WebKit, também a posição relativa ao header.

As oito jornadas determinísticas também rodam no Preview com chamadas externas bloqueadas e APIs mutáveis simuladas. Somadas às sete jornadas reais, a suíte remota full possui exatamente 15 testes por projeto. As regressões autocontidas da fixture são exclusivas do ambiente local e não alteram essa matriz remota.

## Separação de confiança

`functional-qa.yml` é apenas um dispatcher declarativo: não faz checkout, não possui `runs-on`, steps, shell, `npm` ou scripts. Ele referencia somente os três Repository secrets dedicados e os transmite nominalmente a `functional-qa-runner.yml`, chamado por SHA imutável. O runner declara os três aliases como obrigatórios e é o único que os injeta nos jobs privilegiados. Ele também faz checkout de um SHA imutável próprio; `deployment_sha` nunca é usado como `ref`, comando, dependência ou código executável.

### Decisão após o bloqueio de Environment secrets em 02/08/2026

Os três registros existem no environment literal `Preview`, mas execuções novas do reusable workflow receberam os nomes como strings vazias. Também foram testados, sem sucesso, contrato `workflow_call.secrets`, marcador homônimo, marcador de namespace separado e `deployment: false`. O preflight falhou fechado em todas as variantes antes de instalar navegadores, autenticar ou gerar artefatos.

Por decisão arquitetural explícita, os valores passaram a Repository secrets dedicados, com mapeamento nominal no único job reutilizável. `secrets: inherit` continua proibido. Testes arquiteturais limitam o dispatcher aos três nomes, proíbem referências em comandos/logs e comprovam que a ausência falha fechado. Os antigos Environment secrets não participam dessa entrega.

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

Antes de instalar os navegadores ou iniciar uma navegação autenticada, a CI executa `test:artifact-redaction`. O teste sentinela cria `.trace`, `.network`, HAR, cookies, headers, localStorage, ZIP aninhado e um relatório HTML Playwright com ZIP embutido em base64, executa o redator, descompacta recursivamente todo o conteúdo e falha se qualquer sentinela permanecer.

Em falha, o Playwright conserva trace e vídeo. A fixture salva screenshot mascarado, console e requests sanitizados, SHA, ambiente e origem. O redator trata:

- e-mail e senha;
- `Authorization`, tokens Bearer e JWT;
- `x-wallet-session`;
- cookies e `Set-Cookie`;
- localStorage, sessionStorage e storage state;
- bypass da Vercel;
- query parameters sensíveis;
- `.trace`, `.network`, HAR, JSONL e arquivos compactados aninhados.
- o ZIP base64 incorporado pelo Playwright no relatório HTML.

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

Para incluir explicitamente o projeto WebKit local:

```bash
npx playwright test --workers=1 --project=mobile-safari
```

Em hosts macOS antigos, a build congelada disponibilizada pelo Playwright pode falhar antes de criar a página com `Page.overrideSetting: Unknown setting: PushAPIEnabled`. Esse erro é uma limitação do binário/host, não uma aprovação nem uma falha de jornada; Mobile Safari continua obrigatório no runner Linux do GitHub Actions.

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
