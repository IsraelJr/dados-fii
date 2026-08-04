import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const REQUIRED = [
  "src/lib/portfolio-intelligence/PortfolioIntelligenceIncremental.ts",
  "src/lib/portfolio-intelligence/PortfolioIntelligenceIncrementalService.ts",
  "src/server/repositories/FirestorePortfolioIntelligenceReferenceRepositoryCore.ts",
  "src/server/repositories/FirestorePortfolioIntelligenceReferenceRepository.ts",
  "src/server/controllers/PortfolioIncrementalAnalysisController.ts",
  "src/app/api/portfolio/incremental-analysis/route.ts",
  "src/app/components/PortfolioIncrementalReportPanel.tsx",
];

test("PV-4 possui domínio, persistência, controller, rota e apresentação próprios", () => {
  for (const path of REQUIRED) assert.equal(existsSync(path), true, `arquivo ausente: ${path}`);
});

test("comparação permanece pura e não conhece React, Next, Firestore ou IA", () => {
  const domain = read("src/lib/portfolio-intelligence/PortfolioIntelligenceIncremental.ts");
  const service = read("src/lib/portfolio-intelligence/PortfolioIntelligenceIncrementalService.ts");
  const combined = `${domain}\n${service}`;
  assert.doesNotMatch(combined, /from\s+["']react|from\s+["']next|firebase|Firestore|OpenAI|AIInsights|fetch\(/i);
  assert.match(domain, /PORTFOLIO_INCREMENTAL_POLICY_VERSION = "1\.0\.0"/);
  assert.match(domain, /comparePortfolioIntelligenceReferences/);
  assert.match(domain, /fingerprint/);
  assert.match(domain, /category: "rule"/);
  assert.match(domain, /category: "coverage"/);
  assert.match(domain, /category: "quality"/);
});

test("rota é fina e Firestore permanece isolado no repositório", () => {
  const route = read("src/app/api/portfolio/incremental-analysis/route.ts");
  const controller = read("src/server/controllers/PortfolioIncrementalAnalysisController.ts");
  const repository = read("src/server/repositories/FirestorePortfolioIntelligenceReferenceRepositoryCore.ts");
  assert.match(route, /export \{ POST \} from "@\/server\/controllers\/PortfolioIncrementalAnalysisController"/);
  assert.doesNotMatch(route, /firebase|Firestore|adminDb|collection\(/i);
  assert.match(controller, /resolveWalletIdentity/);
  assert.match(controller, /PortfolioIntelligenceIncrementalService/);
  assert.doesNotMatch(controller, /adminDb\.collection|firebase-admin/);
  assert.match(repository, /UserPortfolioIntelligenceReference/);
  assert.match(repository, /runTransaction/);
  assert.match(repository, /data\.ownerId !== input\.ownerId/);
  assert.match(repository, /data\.portfolioId !== input\.portfolioId/);
});

test("persistência é idempotente e não mistura referências de usuários", () => {
  const repository = read("src/server/repositories/FirestorePortfolioIntelligenceReferenceRepositoryCore.ts");
  assert.match(repository, /previous\?\.fingerprint === input\.current\.fingerprint/);
  assert.match(repository, /stored: false/);
  assert.match(repository, /createHash\("sha256"\)/);
  assert.match(repository, /ownerId: input\.ownerId/);
  assert.match(repository, /portfolioId: input\.portfolioId/);
});

test("interface não recalcula diferenças e não persiste carteira no navegador", () => {
  const component = read("src/app/components/PortfolioIncrementalReportPanel.tsx");
  assert.match(component, /\/api\/portfolio\/incremental-analysis/);
  assert.match(component, /Mudanças financeiras são decididas pelo domínio determinístico/);
  assert.match(component, /credentials: "same-origin"/);
  assert.doesNotMatch(component, /localStorage\.setItem/);
  assert.doesNotMatch(component, /comparePortfolioIntelligenceReferences|calculate|Math\.(?:abs|max|min)/);
});

test("rollback é server-side e não depende de variável pública", () => {
  const controller = read("src/server/controllers/PortfolioIncrementalAnalysisController.ts");
  assert.match(controller, /ENABLE_INCREMENTAL_PORTFOLIO_REPORT/);
  assert.doesNotMatch(controller, /NEXT_PUBLIC_/);
  assert.match(controller, /PORTFOLIO_INCREMENTAL_DISABLED/);
});

test("payload persistido é uma referência sanitizada, não a carteira bruta", () => {
  const domain = read("src/lib/portfolio-intelligence/PortfolioIntelligenceIncremental.ts");
  const repository = read("src/server/repositories/FirestorePortfolioIntelligenceReferenceRepositoryCore.ts");
  assert.match(domain, /createPortfolioIntelligenceReference/);
  assert.match(domain, /signals:/);
  assert.match(domain, /metrics:/);
  assert.match(domain, /quality:/);
  assert.doesNotMatch(repository, /positions|snapshots|quotas|quantity|rawPortfolio/);
});
