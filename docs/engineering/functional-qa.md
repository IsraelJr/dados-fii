# QA funcional automatizado

## Finalidade

A automação usa a infraestrutura Playwright existente para validar Preview e produção como um usuário real. Ela não usa credenciais de proprietário nem de administrador, não cria uma segunda ferramenta E2E e não executa ações sobre usuários reais.

## Provisionamento do usuário

Crie uma conta Firebase Authentication exclusiva para QA com e-mail verificado e sem qualquer e-mail, claim ou papel administrativo. O mesmo usuário deve existir somente para dados artificiais de teste.

Configure, nos environments `Preview` e `Production` do GitHub:

- `E2E_USER_EMAIL`;
- `E2E_USER_PASSWORD`;
- `VERCEL_AUTOMATION_BYPASS_SECRET` no environment `Preview`.

No projeto Vercel, inclua o e-mail de QA em `PREMIUM_PREVIEW_EMAILS`. Essa permissão concede apenas acesso funcional aos relatórios Premium e VIP; ela não concede acesso administrativo. O usuário não deve constar em `ADMIN_EMAILS` nem receber claims administrativos.

Os valores nunca devem ser passados por argumentos de linha de comando, query string, nomes de artefato ou títulos de teste.

## Execuções

| Evento | Ambiente | Escopo | Navegadores |
|---|---|---|---|
| Deploy Vercel Preview bem-sucedido | Preview | jornadas críticas | Desktop Chromium, Mobile Chrome e Mobile Safari/WebKit |
| Deploy Vercel Production bem-sucedido | Produção | smoke | Desktop Chromium |
| Segunda a sábado, 09:23 UTC | Produção | smoke diário | Desktop Chromium |
| Domingo, 09:23 UTC | Produção | suíte completa | Desktop Chromium, Mobile Chrome e Mobile Safari/WebKit |
| Manual | escolhido no dispatch | smoke, crítico ou completo | conforme o escopo |

O workflow usa `workers=1`. Há um retry somente na CI; localmente não há retry.

## Isolamento e limpeza

- O login Firebase verificado emite uma sessão aleatória de carteira com duração máxima de 12 horas.
- O logout revoga essa sessão e apaga os identificadores locais.
- O histórico remove, antes e depois da jornada, somente janeiro a junho do ano corrente do usuário de QA.
- A carteira artificial usada no relatório é salva apenas no usuário de QA e volta a ficar vazia no `finally`.
- O cleanup é idempotente e roda também quando a jornada falha.

## Evidências e sigilo

Em falha, o Playwright conserva trace e vídeo. A fixture adiciona screenshot mascarado, console sanitizado, requests com erro sem headers/body/query string, SHA, ambiente e origem testada. Antes do upload, o redator remove dos arquivos textuais e traces:

- e-mail de QA;
- senha;
- bypass da Vercel;
- tokens Bearer;
- parâmetros sensíveis.

Se a redação falhar, o upload não acontece. Os artefatos permanecem por no máximo sete dias.

## Gate de merge

O workflow publica `Functional QA Preview` no SHA implantado. Esse contexto deve ser obrigatório na proteção de `main`, junto da CI central. `Functional QA Production Smoke` é o gate auditável pós-deploy.

O workflow de `deployment_status` passa a reagir a novos deployments depois que o arquivo estiver presente na branch padrão. O primeiro PR que introduz a automação deve permanecer sem merge até:

1. os secrets terem sido provisionados;
2. a suíte remota ter sido executada contra a URL de Preview por dispatch controlado;
3. a CI central estar verde;
4. a proteção da branch exigir `Functional QA Preview`.

## Execução local

Regressão determinística, sem credenciais:

```bash
npm run test:e2e:local
```

Execução remota:

```bash
E2E_BASE_URL=https://preview.example \
E2E_ENVIRONMENT=Preview \
E2E_REMOTE=1 \
E2E_USER_EMAIL=... \
E2E_USER_PASSWORD=... \
VERCEL_AUTOMATION_BYPASS_SECRET=... \
npm run test:e2e -- --grep @critical
```

Nunca cole valores reais em documentação, issue, PR ou log.
