import assert from "node:assert/strict";
import test from "node:test";
import {
  parseFnetDividendNoticeHtml,
  parseFnetProtocolHtml,
} from "../src/lib/risk-lab/FnetDividendNoticeParser";

function table(rows: Array<[string, string]>) {
  return `<html><body><table>${rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join("")}</table></body></html>`;
}

const currentNotice = table([
  ["Nome do Fundo:", "FUNDO DE INVESTIMENTO IMOBILIÁRIO MAUÁ CAPITAL RECEBÍVEIS IMOBILIÁRIOS"],
  ["Data da Informação:", "10/07/2026"],
  ["Código de negociação:", "MCCI11"],
  ["Data-base (último dia de negociação “com” direito ao provento)", "10/07/2026"],
  ["Valor do provento (R$/unidade)", "1,00"],
  ["Data do pagamento", "17/07/2026"],
  ["Período de referência", "Junho-2026"],
  ["Rendimento isento de IR*", "Sim"],
]);

const legacyNotice = table([
  ["Nome do Fundo:", "FUNDO DE INVESTIMENTO IMOBILIÁRIO MAUÁ CAPITAL RECEBÍVEIS IMOBILIÁRIOS - FII"],
  ["Data da informação", "12/08/2020"],
  ["Código de negociação da cota:", "MCCI11"],
  ["Data-base (último dia de negociação com direito ao provento)", "12/08/2020"],
  ["Valor do provento por cota (R$)", "0,60"],
  ["Data do pagamento", "19/08/2020"],
  ["Período de referência", "Julho"],
  ["Rendimento isento de IR*", "Sim"],
]);

const protocol = table([
  ["Identificação do Documento", "Aviso aos Cotistas - Estruturado - Rendimentos e Amortizações"],
  ["Versão", "1"],
  ["Data de Referência", "10/07/2026"],
  ["Data de Entrega", "10/07/2026 18:04"],
]);

test("interpreta aviso estruturado atual", () => {
  const parsed = parseFnetDividendNoticeHtml(currentNotice);
  assert.equal(parsed.ticker, "MCCI11");
  assert.equal(parsed.amountPerShare, 1);
  assert.equal(parsed.competenceMonth, "2026-06");
  assert.equal(parsed.informationDate, "2026-07-10");
  assert.equal(parsed.baseDate, "2026-07-10");
  assert.equal(parsed.paymentDate, "2026-07-17");
  assert.equal(parsed.incomeTaxExempt, true);
});

test("interpreta formato legado sem inventar ano fora da data da informação", () => {
  const parsed = parseFnetDividendNoticeHtml(legacyNotice);
  assert.equal(parsed.amountPerShare, 0.6);
  assert.equal(parsed.competenceMonth, "2020-07");
});

test("protocolo fornece horário exato da primeira entrega pública", () => {
  const parsed = parseFnetProtocolHtml(protocol);
  assert.equal(parsed.referenceDate, "2026-07-10");
  assert.equal(parsed.deliveredAt, "2026-07-10T18:04:00-03:00");
  assert.equal(parsed.version, 1);
});

test("rejeita documento que não é aviso estruturado de rendimentos", () => {
  const invalid = table([
    ["Identificação do Documento", "Relatório Gerencial"],
    ["Versão", "1"],
    ["Data de Referência", "10/07/2026"],
    ["Data de Entrega", "10/07/2026 18:04"],
  ]);
  assert.throws(() => parseFnetProtocolHtml(invalid), /não é aviso estruturado de rendimentos/);
});

test("rejeita valor de provento inválido", () => {
  const invalid = currentNotice.replace("1,00", "não informado");
  assert.throws(() => parseFnetDividendNoticeHtml(invalid), /Valor de provento FNET inválido/);
});

test("rejeita HTML incompleto", () => {
  assert.throws(() => parseFnetDividendNoticeHtml("<html></html>"), /vazio ou incompleto/);
});
