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
  assert.doesNotMatch(route, /confirmed|action === "approve"/);
});

test("importador constrói URLs FNET internamente e não aceita URL do cliente", () => {
  assert.match(service, /const FNET_ORIGIN = "https:\/\/fnet\.bmfbovespa\.com\.br"/);
  assert.match(service, /exibirDocumento\?cvm=true&id=/);
  assert.match(service, /visualizarProtocoloDocumentoCVM\?idDocumento=/);
  assert.match(service, /assertDocumentId/);
  assert.doesNotMatch(route, /body\?\.sourceUrl|body\?\.url/);
});

test("importador usa contrato estrutural de ticker, sem exceções por fundo", () => {
  assert.match(service, /\/\^\[A-Z\]\{4\}11\$\/\.test/);
  assert.doesNotMatch(service, /SUPPORTED_TICKERS|MCCI11.*RBRY11/);
});

test("aviso e protocolo são tratados como artefatos separados e auditáveis", () => {
  assert.match(service, /const sourceHash = sha256\(noticeHtml\)/);
  assert.match(service, /const protocolHash = sha256\(protocolHtml\)/);
  assert.match(parser, /parseFnetDividendNoticeHtml/);
  assert.match(parser, /parseFnetProtocolHtml/);
  assert.match(store, /RiskLabNoticeAudit/);
});

test("validação automática cria uma única observação por fundo e competência", () => {
  assert.match(store, /RiskLabVerifiedDividendNotices/);
  assert.match(store, /doc\(`\$\{candidate\.ticker\}_\$\{candidate\.competenceMonth\}`\)/);
  assert.match(store, /competence_document_conflict/);
  assert.match(store, /automatic_regulatory_validation/);
  assert.match(store, /runTransaction/);
});

test("painel não transfere validação técnica ao usuário", () => {
  assert.doesNotMatch(panel, /confirmed|Aprovar observação|Conferi ticker/);
  assert.match(panel, /validação automática/i);
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
