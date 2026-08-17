import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const REQUIRED = [
  "src/lib/portfolio-intelligence/PortfolioIntelligenceIncremental.ts",
  "src/lib/portfolio-intelligence/PortfolioIntelligenceIncrementalExplanation.ts",
  "src/lib/security/PortfolioIncrementalRateLimit.ts",
  "src/lib/security/PortfolioIncrementalRequestPolicy.ts",
  "src/lib/security/SameOriginPolicy.ts",
  "src/server/auth/VerifiedWalletIdentityCore.ts",
  "src/server/auth/FirestoreVerifiedWalletIdentity.ts",
  "src/server/controllers/PortfolioIncrementalControllerCore.ts",
  "src/server/controllers/PortfolioIncrementalAvailabilityController.ts",
  "src/server/controllers/PortfolioIncrementalAnalysisController.ts",
  "src/server/controllers/PortfolioIncrementalExplanationController.ts",
  "src/server/repositories/FirestorePortfolioIntelligenceSourceRepositoryCore.ts",
  "src/server/repositories/FirestorePortfolioIntelligenceReferenceRepositoryCore.ts",
  "src/server/services/PortfolioIntelligenceCanonicalInputService.ts",
  "src/server/services/PortfolioIntelligenceReferenceFactory.ts",
  "src/server/services/PortfolioIncrementalServerAnalysisService.ts",
  "src/server/services/PortfolioIncrementalStoredComparisonService.ts",
  "src/server/services/PortfolioIncrementalExplanationService.ts",
  "src/app/api/portfolio/incremental-analysis/route.ts",
  "src/app/api/portfolio/incremental-analysis/availability/route.ts",
  "src/app/api/portfolio/incremental-analysis/explanation/route.ts",
  "src/app/components/PortfolioIncrementalReportPanel.tsx",
  "src/app/components/PortfolioIncrementalExplanationPanel.tsx",
];

test("PV-4 possui domínio, fonte canônica, persistência, controles e apresentação próprios", () => {
  for (const path of REQUIRED) assert.equal(existsSync(path), true, `arquivo ausente: ${path}`);
});

test("domínio incremental v2 é puro, determinístico e distingue dados de política", () => {
  const domain = read("src/lib/portfolio-intelligence/PortfolioIntelligenceIncremental.ts");
  const explanation = read("src/lib/portfolio-intelligence/PortfolioIntelligenceIncrementalExplanation.ts");
  const combined = `${domain}\n${explanation}`;
  assert.doesNotMatch(combined, /from\s+["']react|from\s+["']next|firebase|Firestore|OpenAI|AIInsights|fetch\(/i);
  assert.match(domain, /PORTFOLIO_INCREMENTAL_SCHEMA_VERSION = 2/);
  assert.match(domain, /PORTFOLIO_INCREMENTAL_POLICY_VERSION = "2\.0\.0"/);
  assert.match(domain, /dataFingerprint/);
  assert.match(domain, /policyFingerprint/);
  assert.match(domain, /category: "rule"/);
  assert.match(domain, /category: "coverage"/);
  assert.match(domain, /category: "quality"/);
  assert.match(domain, /INCOME_COVERAGE/);
  assert.match(explanation, /deterministicFieldsAreImmutable: true/);
  assert.match(explanation, /introduziu números/);
  assert.match(explanation, /introduziu recomendação/);
});

test("navegador envia somente intenção e nunca resultado ou comparação financeira", () => {
  const report = read("src/app/components/PortfolioIncrementalReportPanel.tsx");
  const explanation = read("src/app/components/PortfolioIncrementalExplanationPanel.tsx");
  assert.match(report, /JSON\.stringify\(\{ portfolioId: PORTFOLIO_ID \}\)/);
  assert.match(explanation, /JSON\.stringify\(\{ portfolioId: PORTFOLIO_ID, currentFingerprint, comparisonId \}\)/);
  assert.doesNotMatch(report, /body:\s*JSON\.stringify\(\{[^}]*\bresult\b/s);
  assert.doesNotMatch(explanation, /body:\s*JSON\.stringify\(\{[^}]*\bcomparison\b/s);
  assert.doesNotMatch(`${report}\n${explanation}`, /localStorage\.setItem/);
});

test("análise nasce de carteira, snapshots e histórico canônicos no servidor", () => {
  const contracts = read("src/lib/portfolio-intelligence/PortfolioIntelligenceIncrementalService.ts");
  const source = read("src/server/repositories/FirestorePortfolioIntelligenceSourceRepositoryCore.ts");
  const canonical = read("src/server/services/PortfolioIntelligenceCanonicalInputService.ts");
  const server = read("src/server/services/PortfolioIncrementalServerAnalysisService.ts");
  assert.match(source, /collection\(USER_COLLECTION\)\.doc\(ownerId\)/);
  assert.match(source, /WalletSnapshots/);
  assert.match(source, /orderBy\("monthKey", "desc"\)/);
  assert.match(source, /history\.listByPortfolio\(ownerId, portfolioId\)/);
  assert.match(source, /PortfolioHistory has the same precedence used by consolidatedSnapshots/);
  assert.match(canonical, /regulatory\.getMany\(tickers, MAX_POSITIONS, \{ asOf \}\)/);
  assert.match(server, /analyzer\.analyze\(canonicalInput/);
  assert.match(server, /referenceFactory\.create\(analysis, canonicalInput\)/);
  assert.doesNotMatch(server, /analyzeSafely/);
  assert.match(server, /const asOf = asOfFrom\(input\.asOf \?\? this\.clock\(\)\)/);
  assert.doesNotMatch(contracts, /class\s+PortfolioIntelligenceIncrementalService/);
  assert.doesNotMatch(contracts, /result:\s*PortfolioIntelligenceResult/);
});

test("referência mínima usa SHA-256 e par monotônico transacional isolado", () => {
  const factory = read("src/server/services/PortfolioIntelligenceReferenceFactory.ts");
  const repository = read("src/server/repositories/FirestorePortfolioIntelligenceReferenceRepositoryCore.ts");
  assert.match(factory, /createHash\("sha256"\)/);
  assert.doesNotMatch(factory, /ownerId|email|cookie|sessionToken/);
  assert.match(repository, /runTransaction/);
  assert.match(repository, /incomingTime < storedTime/);
  assert.match(repository, /incomingTime === storedTime/);
  assert.match(repository, /REFERENCE_STALE/);
  assert.match(repository, /REFERENCE_CONFLICT/);
  assert.match(repository, /previous: pair\.current/);
  assert.match(repository, /readPair/);
  assert.match(repository, /ownerHash/);
  assert.doesNotMatch(repository, /positions|snapshots|quotas|rawPortfolio/);
});

test("ambas as rotas são finas, autenticadas, same-origin e fail-closed por flag", () => {
  const analysisRoute = read("src/app/api/portfolio/incremental-analysis/route.ts");
  const explanationRoute = read("src/app/api/portfolio/incremental-analysis/explanation/route.ts");
  const analysis = read("src/server/controllers/PortfolioIncrementalAnalysisController.ts");
  const explanation = read("src/server/controllers/PortfolioIncrementalExplanationController.ts");
  const core = read("src/server/controllers/PortfolioIncrementalControllerCore.ts");
  const identityCore = read("src/server/auth/VerifiedWalletIdentityCore.ts");
  assert.match(analysisRoute, /export \{ POST \} from "@\/server\/controllers\/PortfolioIncrementalAnalysisController"/);
  assert.match(explanationRoute, /PortfolioIncrementalExplanationController/);
  assert.doesNotMatch(`${analysisRoute}\n${explanationRoute}`, /firebase|Firestore|adminDb|collection\(/i);
  for (const controller of [analysis, explanation]) {
    assert.match(controller, /featureEnabled\("ENABLE_INCREMENTAL_PORTFOLIO_REPORT", false\)/);
    assert.match(controller, /resolveVerifiedWalletIdentity/);
    assert.match(controller, /isStrictSameOrigin/);
  }
  assert.match(core, /readPortfolioIncrementalIntent/);
  assert.match(core, /readPortfolioIncrementalExplanationIntent/);
  assert.match(core, /Cache-Control": "private, no-store/);
  assert.doesNotMatch(`${analysis}\n${explanation}\n${core}`, /resolveWalletIdentity\(/);
  assert.doesNotMatch(identityCore, /ownerId\s*=\s*request|headers\.get\(["']owner/i);
  assert.match(identityCore, /findOwnerId\(email\)/);
});

test("preflight server-only remove a superfície antes de ler credenciais", () => {
  const availabilityRoute = read("src/app/api/portfolio/incremental-analysis/availability/route.ts");
  const availability = read("src/server/controllers/PortfolioIncrementalAvailabilityController.ts");
  const core = read("src/server/controllers/PortfolioIncrementalControllerCore.ts");
  const report = read("src/app/components/PortfolioIncrementalReportPanel.tsx");
  assert.match(availabilityRoute, /export \{ GET \} from "@\/server\/controllers\/PortfolioIncrementalAvailabilityController"/);
  assert.doesNotMatch(availabilityRoute, /firebase|Firestore|adminDb|collection\(/i);
  assert.match(availability, /featureEnabled\("ENABLE_INCREMENTAL_PORTFOLIO_REPORT", false\)/);
  assert.match(core, /createPortfolioIncrementalAvailabilityHandler/);
  assert.match(report, /incremental-analysis\/availability/);
  assert.match(report, /if \(state === "checking" \|\| state === "disabled"\) return null/);
  assert.match(report, /let incrementalDisabledForTab = false/);
  assert.match(report, /if \(incrementalDisabledForTab\)[\s\S]*setState\("disabled"\)/);
  assert.match(report, /if \(!available \|\| disposed \|\| incrementalDisabledForTab\) return/);
  assert.match(report, /availabilityResponse\.status !== 204[\s\S]*available = true;[\s\S]*scheduleRefresh\(0\)/);
  assert.match(report, /PORTFOLIO_INCREMENTAL_DISABLED"\) \{[\s\S]*incrementalDisabledForTab = true;[\s\S]*available = false;[\s\S]*setState\("disabled"\)/);
  assert.match(report, /event\.key === null \|\| event\.key === EMAIL_KEY/);
  assert.doesNotMatch(report, /event\.key === null \|\| event\.key === EMAIL_KEY \|\| event\.key === TOKEN_KEY/);
  assert.match(report, /addEventListener\("storage", refreshAfterCrossTabSessionChange\)/);
  assert.match(report, /removeEventListener\("storage", refreshAfterCrossTabSessionChange\)/);
  assert.doesNotMatch(`${availabilityRoute}\n${availability}\n${report}`, /NEXT_PUBLIC_ENABLE_INCREMENTAL_PORTFOLIO_REPORT/);
});

test("explicação lê o par persistido, limita distribuído e respeita IA desligada", () => {
  const controller = read("src/server/controllers/PortfolioIncrementalExplanationController.ts");
  const stored = read("src/server/services/PortfolioIncrementalStoredComparisonService.ts");
  const service = read("src/server/services/PortfolioIncrementalExplanationService.ts");
  const limiter = read("src/lib/security/PortfolioIncrementalRateLimit.ts");
  assert.match(controller, /createPortfolioIncrementalStoredComparisonService/);
  assert.match(controller, /distributedRateLimitRepository/);
  assert.match(stored, /readPair/);
  assert.match(stored, /currentFingerprint/);
  assert.match(stored, /comparisonId/);
  assert.doesNotMatch(stored, /compareAndStore/);
  assert.match(limiter, /RATE_LIMIT_UNAVAILABLE/);
  assert.match(limiter, /createHash\("sha256"\)/);
  assert.doesNotMatch(limiter, /cf-connecting-ip|x-real-ip|x-forwarded-for/);
  assert.match(service, /featureEnabled\("ENABLE_AI_INSIGHTS", false\)/);
  assert.match(service, /if \(!this\.aiEnabled\(\)\) return this\.fallback\(input\)/);
  assert.doesNotMatch(service, /rateLimits = new Map/);
});

test("rollback é server-only e cobre análise, leitura e explicação", () => {
  const env = read(".env.example");
  const flags = read("src/lib/featureFlags.ts");
  const analysis = read("src/server/controllers/PortfolioIncrementalAnalysisController.ts");
  const availability = read("src/server/controllers/PortfolioIncrementalAvailabilityController.ts");
  const explanation = read("src/server/controllers/PortfolioIncrementalExplanationController.ts");
  assert.match(env, /^ENABLE_INCREMENTAL_PORTFOLIO_REPORT=false$/m);
  assert.match(flags, /ENABLE_INCREMENTAL_PORTFOLIO_REPORT/);
  assert.match(availability, /featureEnabled\("ENABLE_INCREMENTAL_PORTFOLIO_REPORT", false\)/);
  assert.doesNotMatch(`${env}\n${flags}\n${analysis}\n${availability}\n${explanation}`, /NEXT_PUBLIC_ENABLE_INCREMENTAL_PORTFOLIO_REPORT/);
});

test("arquivos TypeScript novos são compatíveis com Node 22 strip-only", () => {
  const paths = REQUIRED.filter((path) => path.endsWith(".ts"));
  for (const path of paths) {
    const source = read(path);
    assert.doesNotMatch(
      source,
      /constructor\s*\([^)]*\b(?:private|public|protected|readonly)\s+[A-Za-z_$]/s,
      `parameter property incompatível em ${path}`,
    );
  }
});
