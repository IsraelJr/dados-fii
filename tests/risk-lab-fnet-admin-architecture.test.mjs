import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const route = source("src/app/api/admin/system/risk-lab/notices/route.ts");
const service = source("src/lib/risk-lab/FnetDividendNoticeImportService.ts");
const parser = source("src/lib/risk-lab/FnetDividendNoticeParser.ts");
const store = source("src/lib/risk-lab/FnetNoticeCandidateStore.ts");
const panel = source("src/app/admin/risk-lab/FnetNoticeImportPanel.tsx");
const page = source("src/app/admin/risk-lab/page.tsx");

const productionSurface = [route, service, store, panel].join("\n");

test("rota FNET reutiliza autenticação Admin, mesma origem e rate limit", () => {
  assert.match(route, /authorizeAdminRequest/);
  assert.match(route, /risk-lab-fnet-list/);
  assert.match(route, /risk-lab-fnet-write/);
  assert.match(route, /ENABLE_RISK_LAB_FNET_IMPORT/);
  assert.match(route, /confirmed !== true/);
});

test("importador constrói URLs FNET internamente e não aceita URL do cliente", () => {
  assert.match(service, /const FNET_ORIGIN = "https:\/\/fnet\.bmfbovespa\.com\.br"/);
  assert.match(service, /exibirDocumento\?cvm=true&id=/);
  assert.match(service, /visualizarProtocoloDocumentoCVM\?idDocumento=/);
  assert.match(service, /assertDocumentId/);
  assert.doesNotMatch(route, /body\?\.sourceUrl|body\?\.url/);
});

test("escopo do importador permanece restrito a MCCI11 e RBRY11", () => {
  assert.match(service, /new Set\(\["MCCI11", "RBRY11"\]\)/);
  assert.match(service, /não pertence à coorte MCCI11\/RBRY11/);
});

test("aviso e protocolo são tratados como artefatos separados e auditáveis", () => {
  assert.match(service, /sourceHash: sha256\(noticeHtml\)/);
  assert.match(service, /protocolHash: sha256\(protocolHtml\)/);
  assert.match(parser, /parseFnetDividendNoticeHtml/);
  assert.match(parser, /parseFnetProtocolHtml/);
  assert.match(store, /RiskLabNoticeAudit/);
});

test("aprovação cria uma única observação verificada por fundo e competência", () => {
  assert.match(store, /RiskLabVerifiedDividendNotices/);
  assert.match(store, /doc\(`\$\{current\.ticker\}_\$\{current\.competenceMonth\}`\)/);
  assert.match(store, /Conflito:/);
  assert.match(store, /manual_document_review/);
});

test("painel exige confirmação humana e informa que não executa detector", () => {
  assert.match(panel, /Conferi ticker, competência, valor por cota/);
  assert.match(panel, /confirmed: true/);
  assert.match(panel, /não executa o detector/i);
  assert.match(page, /<FnetNoticeImportPanel \/>/);
});

test("fluxo FNET permanece isolado de Premium, IA e notificações", () => {
  for (const forbidden of [
    "AIInsightsEngine",
    "PremiumReport",
    "reportMarkdown",
    "RiskLabService.generate",
    "sendEmail",
    "nodemailer",
    "Telegram",
    "notification",
    "OneSignal",
    "Twilio",
  ]) {
    assert.equal(productionSurface.includes(forbidden), false, `Integração proibida encontrada: ${forbidden}`);
  }
});
