import assert from "node:assert/strict";
import test from "node:test";
import {
  parseFnetDividendNoticeHtml,
  parseFnetProtocolHtml,
} from "../src/lib/risk-lab/FnetDividendNoticeParser";

function table(rows: Array<[string, string]>) {
  return `<html><body><table>${rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join("")}</table></body></html>`;
}

test("decodifica entidades nomeadas, numéricas, acentos e aspas tipográficas reais", () => {
  const notice = table([
    ["Nome do Fundo:", "FUNDO DE RECEB&Iacute;VEIS A&Ccedil;&Atilde;O"],
    ["Data da Informa&ccedil;&atilde;o:", "31/01/2022"],
    ["C&oacute;digo de negocia&ccedil;&atilde;o:", "AAAA11"],
    ["Data-base (&#250;ltimo dia de negocia&ccedil;&atilde;o &#8220;com&#8221; direito ao provento)", "31/01/2022"],
    ["Valor do provento (R$/unidade)", "0,95"],
    ["Data do pagamento", "14/02/2022"],
    ["Per&iacute;odo de refer&ecirc;ncia", "janeiro de 2022"],
    ["Rendimento isento de IR*", "N&atilde;o"],
  ]);
  const parsed = parseFnetDividendNoticeHtml(notice);
  assert.equal(parsed.fundName, "FUNDO DE RECEBÍVEIS AÇÃO");
  assert.equal(parsed.ticker, "AAAA11");
  assert.equal(parsed.competenceMonth, "2022-01");
  assert.equal(parsed.incomeTaxExempt, false);

  const protocol = table([
    ["Identifica&ccedil;&atilde;o do Documento", "Aviso aos Cotistas - Estruturado - Rendimentos e Amortiza&ccedil;&otilde;es"],
    ["Vers&atilde;o", "3"],
    ["Data de Refer&ecirc;ncia", "31/01/2022"],
    ["Data de Entrega", "31/01/2022 18:02:59"],
  ]);
  const parsedProtocol = parseFnetProtocolHtml(protocol);
  assert.equal(parsedProtocol.version, 3);
  assert.equal(parsedProtocol.deliveredAt, "2022-01-31T18:02:59-03:00");
});
