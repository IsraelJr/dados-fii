import assert from "node:assert/strict";
import test from "node:test";
import {
  parseFnetDividendNoticeHtml,
  parseFnetProtocolHtml,
} from "../src/lib/risk-lab/FnetDividendNoticeParser";

function table(rows: Array<[string, string]>) {
  return `<html><body><table>${rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join("")}</table></body></html>`;
}

function noticeWithPeriod(period: string, informationDate = "31/01/2022") {
  return table([
    ["Nome do Fundo:", "FUNDO DE TESTE"],
    ["Data da Informação:", informationDate],
    ["Código de negociação:", "AAAA11"],
    ["Data-base (último dia de negociação com direito ao provento)", informationDate],
    ["Valor do provento (R$/unidade)", "1,00"],
    ["Data do pagamento", "14/02/2022"],
    ["Período de referência", period],
    ["Rendimento isento de IR*", "Sim"],
  ]);
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

test("normaliza competência legada curta e virada dezembro/janeiro sem informação futura", () => {
  const legacy = table([
    ["Nome do Fundo:", "FUNDO LEGADO"],
    ["Data da Informação:", "07/01/2021"],
    ["Código de negociação:", "AAAA11"],
    ["Data-base (último dia de negociação com direito ao provento)", "07/01/2021"],
    ["Valor do provento (R$/unidade)", "1,00"],
    ["Data do pagamento", "14/01/2021"],
    ["Período de referência", "12-20"],
    ["Rendimento isento de IR*", "Sim"],
  ]);
  assert.equal(parseFnetDividendNoticeHtml(legacy).competenceMonth, "2020-12");

  const rollover = legacy
    .replaceAll("07/01/2021", "12/01/2022")
    .replace("14/01/2021", "19/01/2022")
    .replace("12-20", "12-2022");
  assert.equal(parseFnetDividendNoticeHtml(rollover).competenceMonth, "2021-12");
});

test("aceita código de outra classe para o coletor decidir o isolamento pelo ticker-alvo", () => {
  const secondary = table([
    ["Nome do Fundo:", "FUNDO MULTICLASSE"],
    ["Data da Informação:", "31/01/2022"],
    ["Código de negociação:", "AAAA13"],
    ["Data-base (último dia de negociação com direito ao provento)", "31/01/2022"],
    ["Valor do provento (R$/unidade)", "1,00"],
    ["Data do pagamento", "14/02/2022"],
    ["Período de referência", "01-2022"],
    ["Rendimento isento de IR*", "Sim"],
  ]);
  assert.equal(parseFnetDividendNoticeHtml(secondary).ticker, "AAAA13");
});

test("rejeita competência futura fora da correção estrita de virada anual", () => {
  assert.throws(
    () => parseFnetDividendNoticeHtml(noticeWithPeriod("02-2022")),
    /posterior às datas do aviso/,
  );
});
