import test from "node:test";
import assert from "node:assert/strict";
import {
  isMeaningfulFiagroFieldValue,
  mapFiagroMonthlyRow,
} from "./fiagroFieldMapping.ts";

test("maps the official FIAGRO class fields used by VGIA11", () => {
  const mapped = mapFiagroMonthlyRow({
    CNPJ_Classe: "41081088000109",
    Nome_Classe: "VALORA CRA FUNDO DE I. NAS C. P. A. - FIAGRO R. LIMITADA",
    Data_Referencia: "2026-05-01",
    Numero_Cotistas: "174817",
    Valor_Ativo: "1029752352.13",
    Patrimonio_Liquido: "1027230341.97",
    Cotas_Emitidas: "106008140",
    Valor_Patrimonial_Cotas: "9.69",
    Vencidos: "0.00",
  });

  assert.deepEqual(mapped, {
    referenceDate: "2026-05-01",
    fundName: "VALORA CRA FUNDO DE I. NAS C. P. A. - FIAGRO R. LIMITADA",
    netWorth: 1027230341.97,
    sharesOutstanding: 106008140,
    numberShareholders: 174817,
    vpCota: 9.69,
    totalPortfolioValue: 1029752352.13,
    delinquentCreditValue: 0,
  });
});

test("maps the FIAGRO subclass confirmation fields", () => {
  const mapped = mapFiagroMonthlyRow({
    CNPJ_Classe: "41081088000109",
    Nome_Classe: "VALORA CRA FUNDO DE I. NAS C. P. A. - FIAGRO R. LIMITADA",
    Data_Referencia: "2026-05-01",
    Nome_Subclasse: "Subclasse 1(ou classe única)",
    Numero_Cotas: "106008140",
    Valor_Patrimonial_Cota: "9.69",
  });

  assert.equal(mapped.referenceDate, "2026-05-01");
  assert.equal(mapped.sharesOutstanding, 106008140);
  assert.equal(mapped.vpCota, 9.69);
});

test("parses Brazilian decimal formatting when CVM changes representation", () => {
  const mapped = mapFiagroMonthlyRow({
    Data_Referencia: "01/05/2026",
    Patrimonio_Liquido: "1.027.230.341,97",
    Cotas_Emitidas: "106008140",
    Valor_Patrimonial_Cotas: "9,69",
    Numero_Cotistas: "174817",
  });

  assert.equal(mapped.referenceDate, "2026-05-01");
  assert.equal(mapped.netWorth, 1027230341.97);
  assert.equal(mapped.vpCota, 9.69);
});

test("treats KNCA11 subclass zeros as unavailable, not conflicting values", () => {
  assert.equal(isMeaningfulFiagroFieldValue("sharesOutstanding", 0), false);
  assert.equal(isMeaningfulFiagroFieldValue("vpCota", "0.00"), false);
  assert.equal(isMeaningfulFiagroFieldValue("sharesOutstanding", 21599919), true);
  assert.equal(isMeaningfulFiagroFieldValue("vpCota", 100.77), true);
  assert.equal(isMeaningfulFiagroFieldValue("delinquentCreditValue", 0), true);
});
