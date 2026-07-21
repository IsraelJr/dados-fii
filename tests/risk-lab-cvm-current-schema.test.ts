import assert from "node:assert/strict";
import test from "node:test";
import { parseCvmEventualCsv } from "../src/lib/risk-lab/CvmEventualCsvParser";

const CURRENT_HEADER = "TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;DENOM_SOCIAL;ID_SUBCLASSE;DT_COMPTC;DT_RECEB;TP_DOC;NM_ARQ;ID_DOC;LINK_ARQ;RESULTADO_AUDITORIA";
const CNPJ = "12.345.678/0001-90";

function source(rows: string[]) {
  return [CURRENT_HEADER, ...rows].join("\n");
}

test("schema RCVM 175 aceita registro de Classe identificado pelo CNPJ", () => {
  const csv = source([
    `Classe;${CNPJ};FUNDO TESTE;;2025-01-31;2025-02-10 18:30:00;Rendimentos e Amortizações;rendimento.html;12345;https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id=12345;OK`,
  ]);
  const result = parseCvmEventualCsv(csv, CNPJ, 2025);
  assert.equal(result.matchingRows, 1);
  assert.equal(result.documents.length, 1);
  assert.equal(result.rejectedRows, 0);
  assert.equal(result.documents[0].documentId, "12345");
});

test("parser normaliza ID decimal, timestamp ISO e link oficial histórico HTTP", () => {
  const csv = source([
    `Fundo;${CNPJ};FUNDO TESTE;;2025-01-31;2025-02-10T18:30:00.123-0300;Fato Relevante;;12345.0;http://dados.cvm.gov.br/documento?id=12345;OK`,
  ]);
  const result = parseCvmEventualCsv(csv, CNPJ, 2025);
  assert.equal(result.documents.length, 1);
  assert.equal(result.documents[0].documentId, "12345");
  assert.match(result.documents[0].receivedAt, /2025-02-10T18:30:00\.123-03:00/);
  assert.equal(result.documents[0].link.startsWith("https://dados.cvm.gov.br/"), true);
  assert.equal(result.documents[0].fileName, "documento-12345");
});

test("ID ausente pode ser recuperado do link oficial sem criar dado sintético", () => {
  const csv = source([
    `Classe;${CNPJ};FUNDO TESTE;;2025-01-31;10/02/2025 18:30:00;Relatório Gerencial;relatorio.pdf;;https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id=998877;OK`,
  ]);
  const result = parseCvmEventualCsv(csv, CNPJ, 2025);
  assert.equal(result.documents.length, 1);
  assert.equal(result.documents[0].documentId, "998877");
});

test("rejeições registram causa objetiva em vez de descartar silenciosamente", () => {
  const csv = source([
    `Classe;${CNPJ};FUNDO TESTE;;2025-01-31;data-invalida;Fato Relevante;fato.pdf;123;https://dados.cvm.gov.br/fato.pdf;OK`,
    `Classe;${CNPJ};FUNDO TESTE;;2025-01-31;2025-02-10 18:30:00;Fato Relevante;fato.pdf;456;https://example.com/fato.pdf;OK`,
  ]);
  const result = parseCvmEventualCsv(csv, CNPJ, 2025);
  assert.equal(result.matchingRows, 2);
  assert.equal(result.documents.length, 0);
  assert.equal(result.rejectedRows, 2);
  assert.ok(result.issues.some((issue) => issue.code === "rejected_invalid_received_at"));
  assert.ok(result.issues.some((issue) => issue.code === "rejected_invalid_official_link"));
  assert.match(result.issues.find((issue) => issue.code === "all_rows_rejected")?.message || "", /invalid_received_at=1/);
});

test("tipo do registro não substitui a identidade já resolvida por CNPJ", () => {
  const csv = source([
    `Subclasse;${CNPJ};FUNDO TESTE;A;2025-01-31;2025-02-10 18:30:00;Aviso ao Mercado;aviso.pdf;789;https://dados.cvm.gov.br/aviso.pdf;OK`,
  ]);
  const result = parseCvmEventualCsv(csv, CNPJ, 2025);
  assert.equal(result.documents.length, 1);
  assert.equal(result.matchingRows, 1);
});
