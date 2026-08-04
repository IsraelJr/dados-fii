import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function text(path) {
  return readFileSync(path, "utf8");
}

test("route da descoberta Premium permanece fina e sem Firestore", () => {
  const route = text("src/app/api/premium/discovery/route.ts");
  assert.match(route, /server\/controllers\/PremiumDiscoveryController/);
  assert.doesNotMatch(route, /firebaseAdmin|adminDb|\.collection\(/);
});

test("entitlement do beta é resolvido exclusivamente no servidor", () => {
  const security = text("src/lib/premiumSecurity.ts");
  const controller = text("src/server/controllers/PremiumDiscoveryController.ts");
  const premiumRoute = text("src/app/api/fii/[ticker]/report/premium/route.ts");
  assert.match(security, /process\.env\.PREMIUM_BETA_UIDS/);
  assert.match(security, /PREMIUM_BETA_EMAILS/);
  assert.match(security, /verifyIdToken\(token, true\)/);
  assert.match(security, /accessSource: "beta"/);
  assert.doesNotMatch(security, /NEXT_PUBLIC_/);
  assert.match(controller, /resolvePremiumRequestIdentity/);
  assert.match(controller, /resolvePremiumEntitlement/);
  assert.doesNotMatch(controller, /body\.(?:ownerId|uid|email|plan|premium)/);
  assert.match(premiumRoute, /requirePremium\(request\)/);
});

test("telemetria Premium possui correlação, retenção e identidade pseudonimizada", () => {
  const domain = text("src/lib/premium-discovery/PremiumDiscovery.ts");
  const repository = text("src/server/repositories/FirestorePremiumDiscoveryRepository.ts");
  const legacyRepository = text("src/server/repositories/FirestoreProductEventRepository.ts");
  assert.match(domain, /correlationId/);
  assert.match(domain, /retentionDays/);
  assert.match(domain, /PREMIUM_DISCOVERY_RETENTION_DAYS = 90/);
  assert.match(repository, /subjectHash/);
  assert.match(repository, /createHash\("sha256"\)/);
  assert.doesNotMatch(repository, /ownerId\s*:/);
  assert.doesNotMatch(repository, /email:\s*event|ticker|quotas|dividends|patrimony|positions|token|cookie/i);
  assert.match(legacyRepository, /subjectHash/);
  assert.doesNotMatch(legacyRepository, /ownerId\s*:/);
});

test("interface comunica validação comercial sem checkout falso", () => {
  const panel = text("src/app/components/PremiumDiscoveryPanel.tsx");
  const integration = text("src/app/components/PortfolioIntelligencePanel.tsx");
  assert.match(panel, /Premium em validação/);
  assert.match(panel, /não cria cobrança/);
  assert.match(panel, /não garante liberação automática/);
  assert.match(panel, /Quero participar do beta/);
  assert.match(panel, /getIdToken\(\)/);
  assert.doesNotMatch(panel, /NEXT_PUBLIC_.*(?:PREMIUM|BETA|ALLOW)/);
  assert.doesNotMatch(panel, />\s*(?:Assinar|Comprar|Pagar agora)\s*</i);
  assert.match(integration, /<PremiumDiscoveryPanel \/>/);
});

test("rollout é ativo na configuração versionada e falha fechado fora dela", () => {
  const controller = text("src/server/controllers/PremiumDiscoveryController.ts");
  const flags = text("src/lib/featureFlags.ts");
  const vercel = JSON.parse(text("vercel.json"));
  assert.match(flags, /ENABLE_PREMIUM_DISCOVERY/);
  assert.match(controller, /featureEnabled\("ENABLE_PREMIUM_DISCOVERY", false\)/);
  assert.equal(vercel.env.ENABLE_PREMIUM_DISCOVERY, "true");
});
