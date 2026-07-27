# Dados FII

Aplicação Next.js/TypeScript para dados regulatórios de FIIs, FIAGROs e FI-Infra, carteira, relatórios e Risk Lab.

O estado oficial, a ordem das Sprints e os gates de conclusão ficam em `DADOS_FII_HANDOFF.md`.

## Requisitos

- Node.js 22;
- npm com lockfile;
- Java compatível com o Firestore Emulator;
- variáveis conforme `.env.example`.

Nunca copie credenciais reais para arquivo versionado. Variáveis `NEXT_PUBLIC_*` não podem conceder plano, perfil administrativo ou qualquer privilégio.

## Desenvolvimento

```bash
npm ci
cp .env.example .env.local
npm run dev
```

A aplicação local responde em `http://localhost:3000`.

## Gates obrigatórios

```bash
npm run audit:production
npm run security:secrets
npm run lint
npm run typecheck
npm run test:all
npm run test:rules
npm run test:coverage:critical
npm run build
npm run test:http
npm run test:e2e
```

`npm run verify` executa os gates sem browser. O E2E permanece separado porque exige Chromium instalado com `npx playwright install chromium`.

O CI executa instalação limpa, audit, detecção de segredos, lint, typecheck, testes, Firestore Emulator, cobertura crítica, build, smoke HTTP e Playwright desktop/mobile. Nenhum deploy corretivo é aceito sem todos os checks.

## Arquitetura

Fluxo obrigatório:

```text
Route Handler
  → autenticação e schema HTTP
  → controller/application service
  → engine/RegulatoryDataService
  → repository
  → Firestore ou provedor externo
```

- Route Handlers não acessam Firestore;
- UI não contém regra financeira;
- repositories não conhecem UI ou `NextResponse`;
- dados ausentes não viram zero;
- Risk Lab é read-only no Premium;
- correções devem ser gerais, sem exceção por ticker.

## Produção

O Vercel publica `main`. Após o deployment, o workflow `Production Premium Smoke` usa OIDC efêmero vinculado ao repositório, workflow, branch e SHA para gerar um relatório controlado, reler o evento `premium-read` e registrar evidência imutável.

Um deployment verde ou o health check de flags, isoladamente, não conclui a Sprint.
