import assert from "node:assert/strict";
import test from "node:test";
import { AutomaticDividendSeriesService } from "../src/lib/risk-lab/AutomaticDividendSeriesService";
import type { AutomaticDocumentEvidence } from "../src/types/riskLabAutomatic";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro"];

function noticeHtml(month: number, amount: number, ticker = "MCCI11") {
  const day = String(Math.min(28, month + 1)).padStart(2, "0");
  const date = `${day}/${String(month).padStart(2, "0")}/2025`;
  return `<html><body><table>
    <tr><td>Data da Informação:</td><td>${date}</td></tr>
    <tr><td>Período de referência</td><td>${MONTHS[month - 1]} de 2025</td></tr>
    <tr><td>Rendimento isento de IR*</td><td>Sim</td></tr>
    <tr><td>Código de negociação:</td><td>${ticker}</td></tr>
    <tr><td>Nome do Fundo:</td><td>FUNDO TESTE</td></tr>
    <tr><td>Data-base (último dia de negociação com direito ao provento)</td><td>${date}</td></tr>
    <tr><td>Data do pagamento</td><td>${date}</td></tr>
    <tr><td>Valor do provento por cota (R$)</td><td>${amount.toFixed(2).replace(".", ",")}</td></tr>
  </table></body></html>`;
}

function protocolHtml(month: number, version = 1) {
  const day = String(Math.min(28, month + 1)).padStart(2, "0");
  const date = `${day}/${String(month).padStart(2, "0")}/2025`;
  return `<html><body><table>
    <tr><td>Identificação do Documento</td><td>Rendimentos e Amortizações</td></tr>
    <tr><td>Versão</td><td>${version}</td></tr>
    <tr><td>Data de Referência</td><td>${date}</td></tr>
    <tr><td>Data de Entrega</td><td>${date} 18:00</td></tr>
  </table></body></html>`;
}

function document(id: number, month: number): AutomaticDocumentEvidence {
  const day = String(Math.min(28, month + 1)).padStart(2, "0");
  return {
    documentId: String(id),
    documentType: "Rendimentos e Amortizações",
    fileName: `rendimento-${month}.html`,
    competenceDate: `2025-${String(month).padStart(2, "0")}-${day}`,
    receivedAt: `2025-${String(month).padStart(2, "0")}-${day}T18:00:00-03:00`,
    link: `https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id=${id}`,
    sourceYear: 2025,
    auditResult: "OK",
    confidence: 99,
  };
}

function response(html: string) {
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

function fetchFor(amounts: Record<number, number>, versions: Record<number, number> = {}) {
  return async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    const id = Number(url.searchParams.get("id") || url.searchParams.get("idDocumento"));
    const month = id > 100 ? id - 100 : id;
    return url.pathname.includes("visualizarProtocolo")
      ? response(protocolHtml(month, versions[id] || 1))
      : response(noticeHtml(month, amounts[id] ?? amounts[month] ?? 1));
  };
}

test("automatic series validates nine official months and runs the detector", async () => {
  const amounts = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 0.75, 8: 0.75, 9: 0.75 };
  const service = new AutomaticDividendSeriesService({
    fetchImpl: fetchFor(amounts) as typeof fetch,
    now: () => new Date("2026-07-18T20:00:00-03:00"),
  });
  const result = await service.build("MCCI11", Array.from({ length: 9 }, (_, index) => document(index + 1, index + 1)));
  assert.equal(result.status, "ready");
  assert.equal(result.observations.length, 9);
  assert.equal(result.longestContiguousSequence, 9);
  assert.equal(result.detectorExecuted, true);
  assert.equal(result.detectorResult?.status, "stress_without_recovery");
  assert.equal(result.detectorResult?.stressDropPercent, 25);
  assert.equal(result.classificationFinal, false);
});

test("automatic series blocks conflicting values in the same latest version", async () => {
  const service = new AutomaticDividendSeriesService({
    fetchImpl: fetchFor({ 1: 1, 101: 0.8 }, { 1: 2, 101: 2 }) as typeof fetch,
    now: () => new Date("2026-07-18T20:00:00-03:00"),
  });
  const first = document(1, 1);
  const second = { ...document(101, 1), receivedAt: first.receivedAt };
  const result = await service.build("MCCI11", [first, second]);
  assert.equal(result.status, "blocked");
  assert.equal(result.detectorExecuted, false);
  assert.equal(result.conflicts.some((item) => item.includes("Valores conflitantes")), true);
});

test("retries transient aborts and limits simultaneous Fundos.NET requests", async () => {
  let active = 0;
  let maximumActive = 0;
  let firstNoticeAttempts = 0;
  const fetchImpl = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    const id = Number(url.searchParams.get("id") || url.searchParams.get("idDocumento"));
    const protocol = url.pathname.includes("visualizarProtocolo");
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    try {
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (!protocol && id === 1) {
        firstNoticeAttempts += 1;
        if (firstNoticeAttempts < 3) {
          const error = new Error("This operation was aborted");
          error.name = "AbortError";
          throw error;
        }
      }
      return protocol ? response(protocolHtml(id)) : response(noticeHtml(id, 1));
    } finally {
      active -= 1;
    }
  }) as typeof fetch;
  const service = new AutomaticDividendSeriesService({
    fetchImpl,
    now: () => new Date("2026-07-18T20:00:00-03:00"),
  });
  const result = await service.build("MCCI11", [document(1, 1), document(2, 2), document(3, 3), document(4, 4)]);

  assert.equal(firstNoticeAttempts, 3);
  assert.ok(maximumActive <= 2);
  assert.equal(result.observations.length, 4);
  assert.deepEqual(result.conflicts, []);
});

test("automatic series ignores documents that are not dividend notices", async () => {
  let calls = 0;
  const service = new AutomaticDividendSeriesService({
    fetchImpl: (async () => { calls += 1; return response(""); }) as typeof fetch,
  });
  const unrelated = { ...document(1, 1), documentType: "Fato Relevante", fileName: "fato.pdf" };
  const result = await service.build("MCCI11", [unrelated]);
  assert.equal(result.status, "incomplete");
  assert.equal(result.observations.length, 0);
  assert.equal(calls, 0);
});
