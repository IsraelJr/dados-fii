export type GoldMonthlySnapshot = {
  referenceDate: string;
  netWorth: number;
  sharesOutstanding: number;
  numberShareholders: number;
  vpCota: number;
  totalPortfolioValue?: number;
  delinquentCreditValue?: number;
};

export type GoldFundFixture = {
  ticker: string;
  fundType: "FII" | "FIAGRO";
  adapterId: "cvm-fii-v2" | "cvm-fiagro-v2";
  cnpj?: string;
  qaScore: 100;
  conflictCount: 0;
  minimumCoverage: 100;
  monthly: GoldMonthlySnapshot[];
  note?: string;
};

export const FII_GOLD_DATASET: Record<string, GoldFundFixture> = {
  TGAR11: {
    ticker: "TGAR11",
    fundType: "FII",
    adapterId: "cvm-fii-v2",
    qaScore: 100,
    conflictCount: 0,
    minimumCoverage: 100,
    monthly: [],
    note: "Fixture estrutural do primeiro piloto FII. Os valores financeiros históricos permanecem no run aprovado e não foram duplicados sem uma fotografia congelada.",
  },
  VGIA11: {
    ticker: "VGIA11",
    fundType: "FIAGRO",
    adapterId: "cvm-fiagro-v2",
    cnpj: "41081088000109",
    qaScore: 100,
    conflictCount: 0,
    minimumCoverage: 100,
    monthly: [
      { referenceDate: "2026-01-01", netWorth: 841622455.70, sharesOutstanding: 86455117, numberShareholders: 170892, vpCota: 9.73 },
      { referenceDate: "2026-02-01", netWorth: 838704081.51, sharesOutstanding: 86455117, numberShareholders: 170695, vpCota: 9.70 },
      { referenceDate: "2026-03-01", netWorth: 1024520468.78, sharesOutstanding: 106008140, numberShareholders: 173128, vpCota: 9.66 },
      { referenceDate: "2026-04-01", netWorth: 1009857344.56, sharesOutstanding: 106008140, numberShareholders: 174740, vpCota: 9.53 },
      { referenceDate: "2026-05-01", netWorth: 1027230341.97, sharesOutstanding: 106008140, numberShareholders: 174817, vpCota: 9.69 },
    ],
  },
  MXRF11: {
    ticker: "MXRF11",
    fundType: "FII",
    adapterId: "cvm-fii-v2",
    cnpj: "97521225000125",
    qaScore: 100,
    conflictCount: 0,
    minimumCoverage: 100,
    monthly: [
      { referenceDate: "2026-01-01", netWorth: 4356171528.14, sharesOutstanding: 460269531, numberShareholders: 1389786, vpCota: 9.464393 },
      { referenceDate: "2026-02-01", netWorth: 4407416704.26, sharesOutstanding: 460269531, numberShareholders: 1402221, vpCota: 9.57573 },
      { referenceDate: "2026-03-01", netWorth: 4316720449.78, sharesOutstanding: 460269531, numberShareholders: 1423541, vpCota: 9.37868 },
      { referenceDate: "2026-04-01", netWorth: 4316748113.30, sharesOutstanding: 460269531, numberShareholders: 1453148, vpCota: 9.37874 },
      { referenceDate: "2026-05-01", netWorth: 4313692471.65, sharesOutstanding: 460269531, numberShareholders: 1468513, vpCota: 9.372101 },
    ],
  },
  KNCA11: {
    ticker: "KNCA11",
    fundType: "FIAGRO",
    adapterId: "cvm-fiagro-v2",
    cnpj: "41745701000137",
    qaScore: 100,
    conflictCount: 0,
    minimumCoverage: 100,
    monthly: [
      { referenceDate: "2026-01-01", netWorth: 2195303553.45, sharesOutstanding: 21599919, numberShareholders: 83243, vpCota: 101.63, totalPortfolioValue: 2315938895.19, delinquentCreditValue: 0 },
      { referenceDate: "2026-02-01", netWorth: 2174348039.73, sharesOutstanding: 21599919, numberShareholders: 87647, vpCota: 100.66, totalPortfolioValue: 2280341763.51, delinquentCreditValue: 0 },
      { referenceDate: "2026-03-01", netWorth: 2185411394.09, sharesOutstanding: 21599919, numberShareholders: 89783, vpCota: 101.18, totalPortfolioValue: 2291789699.96, delinquentCreditValue: 0 },
      { referenceDate: "2026-04-01", netWorth: 2175957363.17, sharesOutstanding: 21599919, numberShareholders: 91232, vpCota: 100.74, totalPortfolioValue: 2286304944.02, delinquentCreditValue: 0 },
      { referenceDate: "2026-05-01", netWorth: 2176651191.41, sharesOutstanding: 21599919, numberShareholders: 91213, vpCota: 100.77, totalPortfolioValue: 2202685427.62, delinquentCreditValue: 0 },
    ],
  },
};

export const GOLD_DATASET_TICKERS = Object.keys(FII_GOLD_DATASET);
