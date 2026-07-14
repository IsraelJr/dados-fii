import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("public FII APIs delegate persistence and merge to RegulatoryDataService", () => {
  for (const route of ["src/app/api/fii/route.ts", "src/app/api/fii/batch/route.ts"]) {
    const source = read(route);
    assert.match(source, /regulatoryDataService/);
    assert.doesNotMatch(source, /firebase-admin|adminDb|\.collection\(/);
  }
});

test("system admin endpoints are POST-only and have no direct Firestore access", () => {
  for (const endpoint of ["health", "parser-health", "validation-history", "run-validation"]) {
    const source = read(`src/app/api/admin/system/${endpoint}/route.ts`);
    assert.match(source, /export async function POST/);
    assert.doesNotMatch(source, /export async function GET/);
    assert.match(source, /authorizeAdminRequest/);
    assert.match(source, /regulatoryDataService/);
    assert.doesNotMatch(source, /firebase-admin|adminDb|\.collection\(/);
  }
});

test("admin session uses verified Firebase identity and HttpOnly cookie", () => {
  const session = read("src/app/api/admin/session/route.ts");
  const security = read("src/lib/adminSecurity.ts");
  assert.match(session, /verifyIdToken/);
  assert.match(session, /createSessionCookie/);
  assert.match(session, /httpOnly:\s*true/);
  assert.match(session, /sameSite:\s*"strict"/);
  assert.match(security, /verifySessionCookie/);
  assert.match(security, /ADMIN_EMAILS/);
  assert.match(security, /consumeAdminRateLimit/);
});

test("regulatory foundation contains merge, cache, validation, versioning and rollback", () => {
  const service = read("src/lib/regulatoryDataService.ts");
  const types = read("src/types/regulatory.ts");
  assert.match(types, /"FII" \| "FIAGRO" \| "FI_INFRA"/);
  assert.match(service, /fundCache/);
  assert.match(service, /marketPromise/);
  assert.match(service, /async publish/);
  assert.match(service, /async rollback/);
  assert.match(service, /async runValidation/);
  assert.match(service, /RegulatoryFundVersions/);
  assert.match(service, /RegulatoryAuditLogs/);
});

test("legacy observability no longer accepts admin secrets", () => {
  const route = read("src/app/api/admin/observability/route.ts");
  assert.doesNotMatch(route, /ADMIN_UPDATE_SECRET|CRON_SECRET|x-admin-secret|searchParams\.get\("secret"\)/);
  assert.doesNotMatch(route, /export async function GET/);
  assert.match(route, /authorizeAdminRequest/);
});
