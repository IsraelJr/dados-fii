import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("IFIX can be synchronized automatically in rebalance months and manually by an admin", () => {
  const config = JSON.parse(read("vercel.json"));
  const cron = config.crons.find((item) => item.path === "/api/cron/ifix-membership");
  const route = read("src/app/api/admin/system/ifix/route.ts");
  const page = read("src/app/admin/sistema/page.tsx");
  const repository = read("src/lib/regulatory/RegulatoryRepository.ts");

  assert.equal(cron?.schedule, "0 9 1-7 1,5,9 *");
  assert.match(route, /export async function GET/);
  assert.match(route, /export async function POST/);
  assert.match(route, /authorizeAdminRequest/);
  assert.match(route, /syncIfixComposition/);
  assert.doesNotMatch(route, /adminDb|firebase-admin/);
  assert.match(page, /Composição do IFIX/);
  assert.match(page, /runIfixSync/);
  assert.match(page, /\/api\/admin\/system\/ifix/);
  assert.match(repository, /compositionHash/);
  assert.match(repository, /changed: false/);
});
