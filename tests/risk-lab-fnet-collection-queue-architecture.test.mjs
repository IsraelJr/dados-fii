import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const panel = source("src/app/admin/risk-lab/FnetCollectionQueuePanel.tsx");
const page = source("src/app/admin/risk-lab/collection-queue/page.tsx");
const combined = `${panel}\n${page}`;

test("montar fila é operação local sem POST", () => {
  const createQueue = panel.match(/function createQueue\(\) \{([\s\S]*?)\n  \}/)?.[1] || "";
  assert.match(createQueue, /parseFnetCollectionQueue/);
  assert.match(createQueue, /buildFnetCollectionQueue/);
  assert.doesNotMatch(createQueue, /requestJson/);
  assert.doesNotMatch(createQueue, /fetch\(/);
});

test("carregamento inicial consulta apenas candidatos existentes", () => {
  const effect = panel.match(/useEffect\(\(\) => \{([\s\S]*?)\}, \[\]\)/)?.[1] || "";
  assert.match(effect, /void load\(\)/);
  assert.doesNotMatch(effect, /importOne\(/);
  assert.match(panel, /requestJson<ListResponse>\("\/api\/admin\/system\/risk-lab\/notices"\)/);
});

test("cada importação exige clique individual e usa somente action import", () => {
  assert.match(panel, /onClick=\{\(\) => void importOne\(item\.documentId\)\}/);
  assert.match(panel, /action: "import", documentId/);
  assert.doesNotMatch(panel, /action: "approve"/);
  assert.doesNotMatch(panel, /action: "reject"/);
  assert.doesNotMatch(panel, /action: "execute"/);
});

test("não existe mecanismo de importação em lote", () => {
  assert.doesNotMatch(panel, /Promise\.all/);
  assert.doesNotMatch(panel, /Importar todos/i);
  assert.doesNotMatch(panel, /for \(const .*requestJson/);
  assert.doesNotMatch(panel, /queue\.map\([^)]*requestJson/);
  assert.match(panel, /Boolean\(busyId\)/);
});

test("página declara as limitações e permanece isolada", () => {
  assert.match(page, /Montar a fila não faz chamadas de importação/);
  assert.match(page, /Importar um ID não aprova a observação nem executa o detector/);
  assert.match(page, /href="\/admin\/risk-lab"/);
});

test("fila não acessa Firestore, Premium, detector ou notificadores", () => {
  for (const forbidden of [
    "firebaseAdmin",
    "adminDb",
    "RiskLabVerifiedDividendNotices",
    "DividendStressWindowEngine",
    "stress-runs",
    "PremiumReport",
    "AIInsightsEngine",
    "sendEmail",
    "nodemailer",
    "OneSignal",
    "Twilio",
    "Telegram",
    "notificationService",
    "portfolioNotification",
  ]) {
    assert.equal(combined.includes(forbidden), false, `Integração proibida encontrada: ${forbidden}`);
  }
});
