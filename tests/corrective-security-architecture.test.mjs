import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function filesBelow(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const target = path.join(directory, entry);
    return statSync(target).isDirectory() ? filesBelow(target) : [target.replaceAll(path.sep, "/")];
  });
}

test("[REG-DEF-08] segredos administrativos não são aceitos em query, body ou cabeçalho legado", () => {
  const routes = [
    "src/app/api/admin/audit-fii-data/route.ts",
    "src/app/api/admin/clean-fii-fields/route.ts",
    "src/app/api/admin/create-fii/route.ts",
    "src/app/api/admin/create-portfolio-snapshots/route.ts",
    "src/app/api/admin/diagnose-data-sources/route.ts",
    "src/app/api/admin/enrich-fii-derived-data/route.ts",
    "src/app/api/admin/fii-maintenance/route.ts",
    "src/app/api/admin/inspect-user-wallet/route.ts",
    "src/app/api/admin/migrate-ios-wallet-history/route.ts",
    "src/app/api/admin/monthly-wallet-snapshots/route.ts",
    "src/app/api/admin/process-portfolio-notifications/route.ts",
    "src/app/api/admin/update-dividends-batch/route.ts",
    "src/app/api/admin/update-market-benchmarks/route.ts",
    "src/app/api/admin/update-one-dividend/route.ts",
    "src/app/api/admin/update-pending-dividends/route.ts",
  ];
  for (const path of routes) {
    const routeSource = read(path);
    const controller = routeSource.match(/@\/server\/controllers\/([A-Za-z0-9_-]+)/)?.[1];
    const source = controller ? read(`src/server/controllers/${controller}.ts`) : routeSource;
    assert.match(source, /requireAdminOrCron|requireAdmin|requireCron/, path);
    assert.doesNotMatch(source, /x-admin-secret|x-cron-secret|searchParams\.get\(["']secret|body\??\.secret/, path);
    assert.doesNotMatch(routeSource, /firebaseAdmin|adminDb|\.collection\(/, path);
    const post = source.slice(source.indexOf("export async function POST"));
    if (post && /await (?:req|request)\.json/.test(post)) {
      const authorizationIndex = post.search(/await require(?:AdminOrCron|Admin|Cron)/);
      const payloadIndex = post.search(/await (?:req|request)\.json/);
      assert.ok(
        authorizationIndex >= 0 && authorizationIndex < payloadIndex,
        `${path} deve autenticar antes de ler o payload`,
      );
    }
  }
  const security = read("src/lib/adminSecurity.ts");
  assert.match(security, /distributedRateLimitRepository\.consume/);
  assert.doesNotMatch(security, /new Map|rateBuckets/);
});

test("[REG-DEF-07] privilégio de alerta é derivado no servidor e não do payload ou env pública", () => {
  const route = read("src/app/api/add-alert/route.ts");
  const service = read("src/lib/alerts/AlertApplicationService.ts");
  const component = read("src/app/components/FiiAlert.tsx");
  const publicPrivilegePattern = new RegExp(
    ["NEXT", "PUBLIC", "(?:VIP|ADMIN)", "EMAILS"].join("_"),
  );
  assert.match(route, /walletIdentityService\.require/);
  assert.match(route, /alertApplicationService\.configure/);
  assert.doesNotMatch(route, /\bisPremium\b.*body|const \{[^}]*isPremium/s);
  assert.match(service, /monitoredFundLimit/);
  assert.match(service, /getByTicker/);
  assert.doesNotMatch(component, publicPrivilegePattern);
  assert.doesNotMatch(component, /body:\s*JSON\.stringify\(\{[\s\S]{0,240}\bisPremium\b/);
  assert.match(component, /Authorization/);
});

test("[REG-DEF-06] atualização pública não altera mais a base compartilhada", () => {
  const route = read("src/app/api/update-dividends/route.ts");
  const service = read("src/lib/dividends/DividendUpdateService.ts");
  const repository = read("src/lib/dividends/DividendUpdateRepository.ts");
  assert.match(route, /requireAdminOrCron/);
  assert.match(route, /idempotency-key/);
  assert.match(route, /unknownFields/);
  assert.match(route, /authorization\.identity\.actor/);
  assert.doesNotMatch(route, /cookies\(|anonId|reserveDailyRequest/);
  assert.match(service, /getCompletedRun/);
  assert.match(repository, /DividendUpdateAudit/);
  assert.match(repository, /correlationId/);
  assert.match(repository, /quantityProcessed/);
});

test("lista pública de administradores não usa variável NEXT_PUBLIC", () => {
  const security = read("src/lib/adminSecurity.ts");
  const legacyPublicAllowlist = new RegExp(
    ["NEXT", "PUBLIC", "ADMIN", "EMAILS"].join("_"),
  );
  assert.doesNotMatch(security, legacyPublicAllowlist);
});

test("identificador anônimo permanece HttpOnly e não pode ser escolhido pelo cliente", () => {
  const proxy = read("src/proxy.ts");
  const login = read("src/app/components/Login.tsx");
  const profile = read("src/app/api/user-profile/route.ts");
  const wallet = read("src/server/controllers/WalletController.ts");
  assert.match(proxy, /httpOnly:\s*true/);
  assert.doesNotMatch(login, /Cookies|body:\s*JSON\.stringify\(\{\s*anonId/);
  assert.match(profile, /request\.cookies\.get\(["']anonId["']\)/);
  assert.doesNotMatch(profile, /body\.anonId|request\.json/);
  assert.doesNotMatch(wallet, /\{\s*ok:\s*true,\s*anonId,/);
});

test("[REG-DEF-15] nenhum Route Handler acessa Firestore diretamente", () => {
  const routes = filesBelow("src/app/api").filter((file) => file.endsWith("/route.ts"));
  assert.ok(routes.length >= 70, "inventário de rotas parece incompleto");
  for (const route of routes) {
    const source = read(route);
    assert.doesNotMatch(source, /firebaseAdmin|firebase-admin|adminDb|\.collection\(/, route);
  }
});
