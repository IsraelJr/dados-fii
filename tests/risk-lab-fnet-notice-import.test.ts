import assert from "node:assert/strict";
import test from "node:test";
import { FnetDividendNoticeImportService } from "../src/lib/risk-lab/FnetDividendNoticeImportService";
import type {
  FnetDividendNoticePreview,
  FnetNoticeCandidateRepository,
  FnetNoticeImportResult,
} from "../src/types/riskLabFnetNotice";

function table(rows: Array<[string, string]>) {
  return `<html><body><table>${rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join("")}</table></body></html>`;
}

function noticeHtml(ticker = "MCCI11") {
  return table([
    ["Nome do Fundo:", ticker === "MCCI11" ? "FUNDO MAUÁ CAPITAL RECEBÍVEIS" : "FUNDO RBR RENDIMENTO HIGH GRADE"],
    ["Data da Informação:", "10/07/2026"],
    ["Código de negociação:", ticker],
    ["Data-base (último dia de negociação “com” direito ao provento)", "10/07/2026"],
    ["Valor do provento (R$/unidade)", "1,00"],
    ["Data do pagamento", "17/07/2026"],
    ["Período de referência", "Junho-2026"],
    ["Rendimento isento de IR*", "Sim"],
  ]);
}

function protocolHtml(referenceDate = "10/07/2026") {
  return table([
    ["Identificação do Documento", "Aviso aos Cotistas - Estruturado - Rendimentos e Amortizações"],
    ["Versão", "1"],
    ["Data de Referência", referenceDate],
    ["Data de Entrega", "10/07/2026 18:04"],
  ]);
}

class MemoryRepository implements FnetNoticeCandidateRepository {
  readonly values = new Map<string, FnetDividendNoticePreview>();

  async saveImported(candidate: FnetDividendNoticePreview): Promise<FnetNoticeImportResult> {
    const existing = this.values.get(candidate.candidateId);
    if (existing) return { candidate: existing, created: false };
    this.values.set(candidate.candidateId, candidate);
    return { candidate, created: true };
  }

  async listRecent() {
    return [...this.values.values()];
  }

  async reject(candidateId: string, actor: string, reason: string) {
    const current = this.values.get(candidateId);
    if (!current) throw new Error("Candidato ausente.");
    const rejected = { ...current, reviewStatus: "rejected" as const, reviewedBy: actor, reviewedAt: "2026-07-18T12:00:00.000Z", rejectionReason: reason };
    this.values.set(candidateId, rejected);
    return rejected;
  }
}

function mockFetch(notice: string, protocol: string, calls: string[]) {
  return (async (input: string | URL | Request) => {
    const url = input.toString();
    calls.push(url);
    const body = url.includes("visualizarProtocoloDocumentoCVM") ? protocol : notice;
    return new Response(body, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }) as typeof fetch;
}

test("importa aviso e protocolo, calcula hashes e valida automaticamente", async () => {
  const repository = new MemoryRepository();
  const calls: string[] = [];
  const service = new FnetDividendNoticeImportService({
    repository,
    fetchImpl: mockFetch(noticeHtml(), protocolHtml(), calls),
    now: () => new Date("2026-07-18T15:00:00.000Z"),
  });

  const result = await service.importByDocumentId("1244228", "admin@example.com");

  assert.equal(result.created, true);
  assert.equal(result.candidate.candidateId, "MCCI11_2026-06_1244228");
  assert.equal(result.candidate.amountPerShare, 1);
  assert.equal(result.candidate.announcedAt, "2026-07-10T18:04:00-03:00");
  assert.equal(result.candidate.reviewStatus, "verified_automatic");
  assert.equal(result.candidate.validationVersion, "fnet-notice-validation-v1");
  assert.match(result.candidate.validationHash, /^[a-f0-9]{64}$/);
  assert.match(result.candidate.sourceHash, /^[a-f0-9]{64}$/);
  assert.match(result.candidate.protocolHash, /^[a-f0-9]{64}$/);
  assert.equal(calls.length, 2);
  assert.equal(calls.some((url) => url.includes("exibirDocumento?cvm=true&id=1244228")), true);
  assert.equal(calls.some((url) => url.includes("visualizarProtocoloDocumentoCVM?idDocumento=1244228")), true);
});

test("reimportação do mesmo documento é idempotente", async () => {
  const repository = new MemoryRepository();
  const service = new FnetDividendNoticeImportService({
    repository,
    fetchImpl: mockFetch(noticeHtml(), protocolHtml(), []),
  });

  assert.equal((await service.importByDocumentId("1244228", "admin@example.com")).created, true);
  assert.equal((await service.importByDocumentId("1244228", "admin@example.com")).created, false);
  assert.equal(repository.values.size, 1);
});

test("aceita qualquer ticker FII/FIAGRO válido sem exceção hardcoded de coorte", async () => {
  const repository = new MemoryRepository();
  const service = new FnetDividendNoticeImportService({
    repository,
    fetchImpl: mockFetch(noticeHtml("MXRF11"), protocolHtml(), []),
  });

  const result = await service.importByDocumentId("123", "admin@example.com");
  assert.equal(result.candidate.ticker, "MXRF11");
  assert.equal(result.candidate.reviewStatus, "verified_automatic");
  assert.equal(repository.values.size, 1);
});

test("rejeita protocolo com data divergente", async () => {
  const service = new FnetDividendNoticeImportService({
    repository: new MemoryRepository(),
    fetchImpl: mockFetch(noticeHtml(), protocolHtml("09/07/2026"), []),
  });

  await assert.rejects(
    () => service.importByDocumentId("1244228", "admin@example.com"),
    /Data de referência do protocolo diverge/,
  );
});

test("rejeita ID antes de realizar qualquer consulta externa", async () => {
  const calls: string[] = [];
  const service = new FnetDividendNoticeImportService({
    repository: new MemoryRepository(),
    fetchImpl: mockFetch(noticeHtml(), protocolHtml(), calls),
  });

  await assert.rejects(
    () => service.importByDocumentId("../../etc", "admin@example.com"),
    /ID de documento FNET inválido/,
  );
  assert.equal(calls.length, 0);
});

test("importação concluída não depende de segunda aprovação humana", async () => {
  const repository = new MemoryRepository();
  const service = new FnetDividendNoticeImportService({
    repository,
    fetchImpl: mockFetch(noticeHtml("RBRY11"), protocolHtml(), []),
  });
  const imported = await service.importByDocumentId("617900", "importer@example.com");
  assert.equal(imported.candidate.reviewStatus, "verified_automatic");
  assert.equal(imported.candidate.reviewedBy, "importer@example.com");
  assert.deepEqual(imported.candidate.validationReasons, []);
});
