import { createHash } from "crypto";
import type { LegacyFundRecord, RegulatoryOverlay } from "@/lib/regulatory/RegulatoryTypes";
import type {
  B3InstrumentRecord,
  CvmMonthlyGeneralRecord,
  CvmRegistrationRecord,
  OfficialCatalogDataset,
} from "@/lib/catalog/OfficialCatalogSources";
import {
  FUND_CATALOG_SCHEMA_VERSION,
  type CanonicalFundCatalogEntry,
  type CatalogDataQuality,
  type CatalogInvestorComposition,
  type CatalogMatchMethod,
  type CatalogPortfolio,
  type FundCatalogAudit,
  type FundCatalogBuildResult,
  type FundCatalogCoverage,
  type FundCatalogPlanItem,
} from "@/types/fund-catalog";

type ExistingOverlayRecord = { id: string; data: RegulatoryOverlay };
type ExistingState = {
  ticker: string;
  cnpj: string | null;
  name: string | null;
  catalog: CanonicalFundCatalogEntry | null;
};
type PreliminaryMatch = {
  instrument: B3InstrumentRecord;
  registration: CvmRegistrationRecord | null;
  cnpj: string | null;
  method: CatalogMatchMethod;
  confidence: number;
  issue: string | null;
};

const BASIC_TARGET = 100 as const;
const ESSENTIAL_TARGET = 95 as const;
// A cobertura cadastral só pode ser aplicada quando todo ticker elegível da
// fotografia B3 foi individualmente conciliado. Percentual alto não substitui
// identidade: um único CNPJ errado contamina relatórios, IA e ciclo de vida.
const SOURCE_MATCH_TARGET = 100 as const;
const LEGAL_STOP_WORDS = new Set([
  "FUNDO", "FUNDOS", "FDO", "FDOS", "INVESTIMENTO", "INVESTIMENTOS", "INV", "DE", "DA", "DO", "DAS", "DOS", "E", "EM",
  "IMOBILIARIO", "IMOBILIARIA", "IMOBILIARIOS", "IMOB", "RESPONSABILIDADE", "RESP", "LIMITADA", "LIMITADO", "LTDA", "FII", "FIAGRO",
  "CLASSE", "COTAS", "FUN", "FI", "INFRA", "INFRAESTRUTURA",
]);

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, stableValue(item)]));
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableValue(value)), "utf8").digest("hex");
}

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulTokens(value: unknown) {
  return new Set(normalizeText(value).split(" ").filter((token) => token.length > 1 && !LEGAL_STOP_WORDS.has(token)));
}

function trigrams(value: unknown) {
  const text = `  ${normalizeText(value)}  `;
  const result = new Set<string>();
  for (let index = 0; index <= text.length - 3; index += 1) result.add(text.slice(index, index + 3));
  return result;
}

function dice(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  let intersection = 0;
  for (const value of left) if (right.has(value)) intersection += 1;
  return (2 * intersection) / (left.size + right.size);
}

export function fundNameSimilarity(left: unknown, right: unknown) {
  const leftTokens = meaningfulTokens(left);
  const rightTokens = meaningfulTokens(right);
  const tokenScore = dice(leftTokens, rightTokens);
  let tokenIntersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) tokenIntersection += 1;
  const overlap = tokenIntersection >= 2 ? tokenIntersection / Math.min(leftTokens.size, rightTokens.size) : 0;
  const containmentScore = overlap === 1 && tokenIntersection >= 3 ? 0.94 : overlap * 0.88;
  const trigramScore = dice(trigrams(left), trigrams(right));
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  const containment = normalizedLeft.length >= 8 && normalizedRight.length >= 8
    && (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) ? 0.96 : 0;
  return Math.max(containment, containmentScore, tokenScore * 0.7 + trigramScore * 0.3);
}

function digits(value: unknown) {
  const result = String(value || "").replace(/\D/g, "");
  return result.length === 14 ? result : null;
}

function text(value: unknown) {
  const result = String(value || "").trim();
  return result && !["name", "n/a", "nao informado", "não informado"].includes(result.toLowerCase()) ? result : null;
}

function numberValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function nonNegative(value: unknown) {
  const number = numberValue(value);
  return number !== null && number >= 0 ? number : 0;
}

function nullableNonNegative(value: unknown) {
  const number = numberValue(value);
  return number !== null && number >= 0 ? number : null;
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 100 : 0;
}

function activeRegistration(registration: CvmRegistrationRecord) {
  return normalizeText(registration.status).includes("EM FUNCIONAMENTO NORMAL");
}

function registrationRank(registration: CvmRegistrationRecord) {
  if (activeRegistration(registration)) return 3;
  if (normalizeText(registration.status).includes("LIQUIDA")) return 2;
  if (normalizeText(registration.status).includes("CANCEL")) return 0;
  return 1;
}

function selectRegistration(records: CvmRegistrationRecord[], kind?: string | null) {
  return [...records]
    .filter((record) => !kind || record.kind === kind)
    .sort((left, right) => {
      const rank = registrationRank(right) - registrationRank(left);
      if (rank) return rank;
      return String(right.registrationDate || "").localeCompare(String(left.registrationDate || ""));
    })[0] || null;
}

function compatiblePublicRegistration(instrument: B3InstrumentRecord, registration: CvmRegistrationRecord) {
  void instrument;
  void registration;
  // A presença no catálogo de negociação da B3 prevalece sobre rótulos de
  // público-alvo/exclusividade da classe; eles não são prova de deslistagem.
  return true;
}

const SIGNATURE_STOP_WORDS = new Set([
  "FUNDO", "FUNDOS", "FDO", "FDOS", "INVESTIMENTO", "INVESTIMENTOS", "INV", "FINANCEIRO", "FINANCEIRA",
  "DE", "DA", "DO", "DAS", "DOS", "E", "EM", "NA", "NO", "NAS", "NOS", "RESP", "RESPONSABILIDADE",
  "LIMITADA", "LIMITADO", "LTDA", "CLASSE", "CLASSES", "COTAS", "FUN",
]);
const PRODUCT_SIGNATURE_TOKENS = new Set([
  "FII", "FIAGRO", "FI", "FIC", "FIF", "CIC", "INFRA", "AGRO", "CADEIAS", "CAD", "PROD", "PRODUTIVAS",
  "RENDA", "FIXA", "RF", "DEB", "DEBENTURES", "INC", "INCENTIVADAS", "IMOB", "IMOBILIARIO", "ATIVOS",
  "RECEBIVEIS", "PATRIMONIAL", "FUND",
]);
const SERIES_SIGNATURE_TOKENS = new Set(["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]);

function signatureTokens(value: unknown) {
  return Array.from(new Set(normalizeText(value).split(" ").filter((token) => (token.length >= 2 || /^\d+$/.test(token)) && !SIGNATURE_STOP_WORDS.has(token))));
}

function compatibleToken(left: string, right: string) {
  if (left === right) return true;
  const minimum = Math.min(left.length, right.length);
  return minimum >= 3 && (left.startsWith(right) || right.startsWith(left));
}

export function fundSignatureEvidence(instrument: B3InstrumentRecord, registration: CvmRegistrationRecord) {
  const listed = signatureTokens(`${instrument.legalName} ${instrument.tradeName || ""}`);
  const registered = signatureTokens(registration.legalName);
  const matches = listed.filter((token) => registered.some((candidate) => compatibleToken(token, candidate))).length;
  let adjacentMatches = 0;
  for (let index = 0; index < listed.length - 1; index += 1) {
    for (let candidate = 0; candidate < registered.length - 1; candidate += 1) {
      if (compatibleToken(listed[index], registered[candidate]) && compatibleToken(listed[index + 1], registered[candidate + 1])) {
        adjacentMatches += 1;
        break;
      }
    }
  }
  const distinctiveMatches = listed.filter((token) => token.length >= 5
    && registered.some((candidate) => compatibleToken(token, candidate))).length;
  const brandMatches = listed.filter((token) => token.length >= 3
    && !PRODUCT_SIGNATURE_TOKENS.has(token)
    && registered.some((candidate) => compatibleToken(token, candidate))).length;
  const listedText = normalizeText(`${instrument.legalName} ${instrument.tradeName || ""}`);
  const explicitFundOfFunds = /(?:^| )(?:FIC|CIC)(?: |$)|COTAS/.test(listedText);
  const fundOfFundsBonus = explicitFundOfFunds && registration.isFundOfFunds === true ? 2 : 0;
  const masterPenalty = !/(?:^| )MASTER(?: |$)/.test(listedText) && /(?:^| )MASTER(?: |$)/.test(normalizeText(registration.legalName)) ? 2 : 0;
  const listedNumbers = listed.filter((token) => /^\d{1,4}$/.test(token));
  const registeredNumbers = registered.filter((token) => /^\d{1,4}$/.test(token));
  const numericMismatchPenalty = registeredNumbers.length && (!listedNumbers.length
    || !listedNumbers.some((token) => registeredNumbers.includes(token))) ? 8 : 0;
  const listedSeries = listed.filter((token) => SERIES_SIGNATURE_TOKENS.has(token));
  const registeredSeries = registered.filter((token) => SERIES_SIGNATURE_TOKENS.has(token));
  const seriesMismatchPenalty = registeredSeries.length && (!listedSeries.length
    || !listedSeries.some((token) => registeredSeries.includes(token))) ? 6 : 0;
  const coverage = listed.length ? matches / listed.length : 0;
  return {
    matches,
    adjacentMatches,
    distinctiveMatches,
    brandMatches,
    fundOfFundsBonus,
    masterPenalty,
    numericMismatchPenalty,
    seriesMismatchPenalty,
    coverage,
    // Ordem contígua é evidência mais forte que palavras soltas. Isso evita,
    // por exemplo, que um produto antigo com vários termos genéricos supere a
    // classe vigente cujo nome contém "SPARTA INFRA ESTRATÉGICO" em sequência.
    rank: matches + adjacentMatches * 2.5 + distinctiveMatches * 0.25 + brandMatches * 3 + fundOfFundsBonus
      - masterPenalty - numericMismatchPenalty - seriesMismatchPenalty,
  };
}

function normalizedRowValue(row: Record<string, string> | undefined, wanted: string) {
  if (!row) return "";
  const normalizedWanted = normalizeText(wanted).replace(/ /g, "_");
  for (const [key, value] of Object.entries(row)) {
    if (normalizeText(key).replace(/ /g, "_") === normalizedWanted) return value;
  }
  return "";
}

function investorComposition(row: Record<string, string> | undefined): CatalogInvestorComposition | null {
  if (!row) return null;
  const referenceDate = row.Data_Referencia_Composicao_Cotistas || row.Data_Informacao_Numero_Cotistas || row.Data_Referencia;
  const totalAccounts = nullableNonNegative(row.Total_Numero_Cotistas);
  const individualAccounts = nullableNonNegative(row.Numero_Cotistas_Pessoa_Fisica);
  if (!referenceDate || totalAccounts === null) return null;
  return {
    referenceDate,
    totalAccounts,
    individualAccounts,
    legalEntityAccounts: individualAccounts === null ? null : Math.max(totalAccounts - individualAccounts, 0),
    legalEntityCategories: {
      nonFinancial: nullableNonNegative(row.Numero_Cotistas_Pessoa_Juridica_Nao_Financeira),
      commercialBanks: nullableNonNegative(row.Numero_Cotistas_Banco_Comercial),
      brokersAndDistributors: nullableNonNegative(row.Numero_Cotistas_Corretora_Distribuidora),
      otherFinancial: nullableNonNegative(row.Numero_Cotistas_Outras_Pessoas_Juridicas_Financeira),
      nonResidents: nullableNonNegative(row.Numero_Cotistas_Investidores_Nao_Residentes),
      openPension: nullableNonNegative(row.Numero_Cotistas_Entidade_Aberta_Previdencia_Complementar),
      closedPension: nullableNonNegative(normalizedRowValue(row, "Numero_Cotistas_Entidade_Fechada_Previdencia_Complementar")),
      publicPension: nullableNonNegative(row.Numero_Cotistas_Regime_Proprio_Previdencia_Servidores_Publicos),
      insurersAndReinsurers: nullableNonNegative(row.Numero_Cotistas_Sociedade_Seguradora_Resseguradora),
      capitalizationAndLeasing: nullableNonNegative(row.Numero_Cotistas_Sociedade_Capitalizacao_Arrendamento_Mercantil),
      realEstateFunds: nullableNonNegative(row.Numero_Cotistas_FII),
      otherFunds: nullableNonNegative(row.Numero_Cotistas_Outros_Fundos),
      distributors: nullableNonNegative(row.Numero_Cotistas_Distribuidores_Fundo),
      other: nullableNonNegative(row.Numero_Cotistas_Outros_Tipos),
    },
    // The CVM monthly dataset contains account categories, not the identity of
    // the largest legal-entity holder. Keeping this explicitly nullable avoids
    // presenting a category as if it were an identified investor.
    largestLegalEntityHolder: null,
  };
}

function dailyInvestorComposition(row: Record<string, string> | undefined): CatalogInvestorComposition | null {
  if (!row) return null;
  const referenceDate = normalizedRowValue(row, "NR_COTST_REFERENCE_DATE")
    || normalizedRowValue(row, "DT_COMPTC") || normalizedRowValue(row, "Data_Referencia");
  const totalAccounts = numberValue(normalizedRowValue(row, "NR_COTST"));
  if (!referenceDate || totalAccounts === null || totalAccounts < 0) return null;
  return {
    referenceDate,
    totalAccounts,
    individualAccounts: null,
    legalEntityAccounts: null,
    legalEntityCategories: {
      nonFinancial: null,
      commercialBanks: null,
      brokersAndDistributors: null,
      otherFinancial: null,
      nonResidents: null,
      openPension: null,
      closedPension: null,
      publicPension: null,
      insurersAndReinsurers: null,
      capitalizationAndLeasing: null,
      realEstateFunds: null,
      otherFunds: null,
      distributors: null,
      other: null,
    },
    largestLegalEntityHolder: null,
  };
}

function portfolio(row: Record<string, string> | undefined): CatalogPortfolio | null {
  if (!row?.Data_Referencia) return null;
  const totalInvested = numberValue(row.Total_Investido);
  const directRealEstate = nonNegative(row.Direitos_Bens_Imoveis);
  const creditReceivables = nonNegative(row.CRI_CRA || row.CRI);
  const equityHoldings = nonNegative(row.Participacoes_Societarias || row.Acoes);
  const fundShares = nonNegative(row.FII) + nonNegative(row.FIDC);
  const fixedIncomeAndCash = nonNegative(row.Total_Necessidades_Liquidez)
    || nonNegative(row.Fundos_Renda_Fixa) + nonNegative(row.LCI_LCA || row.LCI) + nonNegative(row.LIG) + nonNegative(row.Letras_Hipotecarias);
  const accounted = directRealEstate + creditReceivables + equityHoldings + fundShares + fixedIncomeAndCash;
  return {
    referenceDate: row.Data_Referencia,
    totalInvested,
    directRealEstate,
    creditReceivables,
    equityHoldings,
    fundShares,
    fixedIncomeAndCash,
    otherAssets: Math.max(0, (totalInvested || accounted) - accounted),
  };
}

function classification(registration: CvmRegistrationRecord, general: CvmMonthlyGeneralRecord | undefined, assets: CatalogPortfolio | null) {
  const { kind } = registration;
  const declaredSegment = text(general?.Segmento_Atuacao);
  const total = assets?.totalInvested || 0;
  const directShare = total ? (assets?.directRealEstate || 0) / total : 0;
  const creditShare = total ? (assets?.creditReceivables || 0) / total : 0;
  const fundsShare = total ? (assets?.fundShares || 0) / total : 0;
  let strategy = kind === "FI_INFRA" ? "Crédito de infraestrutura" : kind === "FIAGRO" ? "Multiestratégia agro" : declaredSegment || "Híbrido";
  const method: "portfolio-composition" | "fund-kind" | "declared" = total > 0 ? "portfolio-composition" : declaredSegment ? "declared" : "fund-kind";
  const confidence: "high" | "medium" | "low" = total > 0 ? "high" : declaredSegment ? "medium" : "low";
  if (total > 0) {
    if (creditShare >= 0.55) strategy = kind === "FIAGRO" ? "Crédito do agronegócio" : "Papel / Crédito";
    else if (directShare >= 0.55) strategy = kind === "FIAGRO" ? "Terras e ativos reais" : declaredSegment || "Tijolo";
    else if (fundsShare >= 0.55) strategy = "Fundo de Fundos";
    else strategy = kind === "FIAGRO" ? "Multiestratégia agro" : "Híbrido";
  }
  return {
    sector: kind === "FI_INFRA" ? "Infraestrutura" : kind === "FIAGRO" ? "Agronegócio" : "Imobiliário",
    segment: strategy,
    strategy,
    declaredSegment,
    regulatoryClassification: text(registration.regulatoryClassification),
    mandate: text(general?.Mandato),
    managementType: text(general?.Tipo_Gestao),
    targetAudience: text(general?.Publico_Alvo) || text(registration.targetAudience),
    condominiumForm: text(registration.condominiumForm),
    exclusive: registration.exclusive ?? null,
    isFundOfFunds: fundsShare >= 0.55 ? true : registration.isFundOfFunds ?? null,
    confidence,
    method,
  } as const;
}

function capital(
  registration: CvmRegistrationRecord,
  general: CvmMonthlyGeneralRecord | undefined,
  complement: Record<string, string> | undefined,
  daily: Record<string, string> | undefined,
) {
  const dailyReference = normalizedRowValue(daily, "DT_COMPTC") || normalizedRowValue(daily, "Data_Referencia");
  const referenceDate = complement?.Data_Referencia || general?.Data_Referencia || dailyReference || registration.netWorthDate;
  if (!referenceDate) return null;
  const dailyNetWorth = numberValue(normalizedRowValue(daily, "VL_PATRIM_LIQ"));
  const dailyNavPerShare = numberValue(normalizedRowValue(daily, "VL_QUOTA"));
  const netWorth = numberValue(complement?.Patrimonio_Liquido) ?? dailyNetWorth ?? registration.netWorth;
  const reportedNavPerShare = numberValue(complement?.Valor_Patrimonial_Cotas) ?? dailyNavPerShare;
  const reportedShares = numberValue(complement?.Cotas_Emitidas) ?? numberValue(general?.Quantidade_Cotas_Emitidas);
  const issuedShares = reportedShares ?? (dailyNetWorth && dailyNavPerShare && dailyNavPerShare > 0
    ? Math.round(dailyNetWorth / dailyNavPerShare) : null);
  if (netWorth === null && issuedShares === null && reportedNavPerShare === null) return null;
  return { referenceDate, netWorth, issuedShares, reportedNavPerShare };
}

function quality(entry: Omit<CanonicalFundCatalogEntry, "dataQuality" | "contentHash">, now: string): CatalogDataQuality {
  const missingBasic: string[] = [];
  if (!entry.identity.cnpj) missingBasic.push("CNPJ");
  if (!entry.identity.legalName) missingBasic.push("nome legal");
  if (!entry.identity.kind || entry.identity.kind === "UNKNOWN") missingBasic.push("tipo do fundo");
  if (!entry.serviceProviders.administrator.name) missingBasic.push("administrador");
  if (!entry.serviceProviders.managers.length && entry.serviceProviders.managementModel === "not-reported") missingBasic.push("responsável pela gestão");
  if (!entry.classification.sector) missingBasic.push("setor");
  if (!entry.classification.segment) missingBasic.push("segmento");
  const missingEssential: string[] = [];
  if (!entry.capital?.issuedShares || entry.capital.issuedShares <= 0) missingEssential.push("cotas emitidas");
  if (entry.capital?.netWorth === null || entry.capital?.netWorth === undefined || !Number.isFinite(entry.capital.netWorth)) missingEssential.push("patrimônio líquido");
  if (!entry.investors?.totalAccounts || entry.investors.totalAccounts <= 0) missingEssential.push("total de cotistas");
  // A decomposição PF/PJ é estruturada no informe mensal FII. No informe diário
  // usado por FIAGRO/FI-Infra a CVM divulga apenas o total de cotistas; a ausência
  // dessa abertura não pode reprovar nem ser inventada pelo produto.
  if (entry.identity.kind === "FII" && entry.investors?.individualAccounts == null) missingEssential.push("cotistas pessoa física");
  if (!entry.classification.segment) missingEssential.push("segmento");
  const warnings: string[] = [];
  if (!entry.identity.isin && entry.lifecycle.b3Listed) warnings.push("ISIN não conciliado com segurança.");
  if (entry.serviceProviders.managementModel === "administrator-managed") warnings.push("A CVM não informa gestor separado; a responsabilidade cadastral de gestão permanece com o administrador.");
  if (!entry.investors?.largestLegalEntityHolder) warnings.push("A identidade do maior cotista PJ não é disponibilizada nas fontes estruturadas utilizadas.");
  if ((entry.identity.kind === "FIAGRO" || entry.identity.kind === "FI_INFRA") && entry.investors?.individualAccounts === null) warnings.push("O informe diário de fundos da CVM divulga o total de cotistas, mas não separa PF e PJ para esta categoria.");
  if (entry.investors?.referenceDate) {
    const investorReference = new Date(entry.investors.referenceDate).getTime();
    const investorAgeDays = Number.isFinite(investorReference) ? (new Date(now).getTime() - investorReference) / 86_400_000 : 0;
    if (investorAgeDays > 548) warnings.push(`A última composição PF/PJ estruturada disponível é histórica (${entry.investors.referenceDate}); a data permanece visível e o dado não deve ser interpretado como composição atual.`);
  }
  if (entry.capital?.netWorth !== null && entry.capital?.netWorth !== undefined && entry.capital.netWorth <= 0) warnings.push("Patrimônio líquido regulatório não positivo; o valor foi preservado e deve ser interpretado como situação excepcional, não como dado ausente.");
  if (entry.investors) {
    const legalByDifference = entry.investors.legalEntityAccounts;
    const categoryValues = Object.values(entry.investors.legalEntityCategories).filter((value): value is number => value !== null);
    const legalByCategories = categoryValues.reduce((sum, value) => sum + value, 0);
    if (legalByDifference !== null && categoryValues.length && Math.abs(legalByDifference - legalByCategories) > Math.max(2, entry.investors.totalAccounts * 0.005)) warnings.push("A soma das categorias de cotistas difere do total não-PF informado.");
  }
  if (entry.capital?.netWorth && entry.capital.issuedShares && entry.capital.reportedNavPerShare) {
    const calculated = entry.capital.netWorth / entry.capital.issuedShares;
    if (Math.abs(calculated / entry.capital.reportedNavPerShare - 1) > 0.02) warnings.push("Valor patrimonial por cota diverge dos totais regulatórios em mais de 2%.");
  }
  const started = entry.lifecycle.operatingSince ? new Date(entry.lifecycle.operatingSince).getTime() : 0;
  const ageDays = started ? (new Date(now).getTime() - started) / 86_400_000 : Number.POSITIVE_INFINITY;
  const applicableToEssentialTarget = entry.lifecycle.status === "active" && ageDays >= 90;
  return {
    basicComplete: missingBasic.length === 0,
    essentialComplete: missingEssential.length === 0,
    applicableToEssentialTarget,
    missingBasic,
    missingEssential,
    warnings,
  };
}

function materialHash(entry: Omit<CanonicalFundCatalogEntry, "dataQuality" | "contentHash">, dataQuality: CatalogDataQuality) {
  return hash({
    schemaVersion: entry.schemaVersion,
    ticker: entry.ticker,
    identity: entry.identity,
    serviceProviders: entry.serviceProviders,
    classification: entry.classification,
    capital: entry.capital,
    investors: entry.investors,
    portfolio: entry.portfolio,
    lifecycle: { ...entry.lifecycle, lastSeenOnB3: entry.lifecycle.b3Listed ? "present" : null },
    dataQuality,
  });
}

function existingStates(legacy: LegacyFundRecord[], overlays: ExistingOverlayRecord[]) {
  const result = new Map<string, ExistingState>();
  for (const record of legacy) {
    const ticker = String(record.data.code || record.id).trim().toUpperCase();
    if (!ticker) continue;
    result.set(ticker, { ticker, cnpj: digits(record.data.cnpj || record.data.CNPJ), name: text(record.data.name || record.data.socialReason), catalog: null });
  }
  for (const record of overlays) {
    const ticker = String(record.data.ticker || record.id).trim().toUpperCase();
    if (!ticker) continue;
    const catalog = record.data.catalog && typeof record.data.catalog === "object" ? record.data.catalog as CanonicalFundCatalogEntry : null;
    const current = result.get(ticker);
    result.set(ticker, {
      ticker,
      cnpj: digits(catalog?.identity?.cnpj || record.data.cnpj) || current?.cnpj || null,
      name: text(catalog?.identity?.legalName || record.data.corporateName || record.data.socialReason || record.data.name) || current?.name || null,
      catalog,
    });
  }
  return result;
}

function registrationMaps(registrations: CvmRegistrationRecord[]) {
  const byCnpj = new Map<string, CvmRegistrationRecord[]>();
  for (const registration of registrations) {
    const values = byCnpj.get(registration.cnpj) || [];
    values.push(registration);
    byCnpj.set(registration.cnpj, values);
  }
  return { byCnpj, active: registrations.filter(activeRegistration) };
}

function matchInstrument(
  instrument: B3InstrumentRecord,
  dataset: OfficialCatalogDataset,
  existing: Map<string, ExistingState>,
  byCnpj: Map<string, CvmRegistrationRecord[]>,
  active: CvmRegistrationRecord[],
  monthlyByIsin: Map<string, CvmMonthlyGeneralRecord>,
): PreliminaryMatch {
  const monthly = instrument.isin ? monthlyByIsin.get(instrument.isin) : undefined;
  const monthlyCnpj = digits(monthly?.CNPJ_Fundo_Classe);
  if (monthlyCnpj) {
    const registration = selectRegistration(byCnpj.get(monthlyCnpj) || [], instrument.kindHint);
    const knownCnpj = existing.get(instrument.ticker)?.cnpj;
    const knownRegistration = knownCnpj ? selectRegistration(byCnpj.get(knownCnpj) || [], instrument.kindHint) : null;
    if (registration && knownRegistration && knownCnpj !== monthlyCnpj) {
      const monthlyNameScore = Math.max(fundNameSimilarity(instrument.legalName, registration.legalName), fundNameSimilarity(instrument.tradeName, registration.legalName));
      const knownNameScore = Math.max(fundNameSimilarity(instrument.legalName, knownRegistration.legalName), fundNameSimilarity(instrument.tradeName, knownRegistration.legalName));
      if (monthlyNameScore < 0.5 && knownNameScore >= 0.7) {
        return {
          instrument,
          registration: knownRegistration,
          cnpj: knownCnpj!,
          method: "existing-cnpj",
          confidence: 0.97,
          issue: `ISIN do informe mensal conflita com nome/CNPJ já conciliados para ${instrument.ticker}; preservado o CNPJ compatível e sinalizada revisão.`,
        };
      }
    }
    return { instrument, registration, cnpj: monthlyCnpj, method: "isin", confidence: registration ? 1 : 0.96, issue: registration ? null : "ISIN conciliado, mas cadastro CVM não localizado." };
  }
  const knownCnpj = existing.get(instrument.ticker)?.cnpj;
  if (knownCnpj) {
    const registration = selectRegistration(byCnpj.get(knownCnpj) || [], instrument.kindHint);
    if (registration) {
      const nameScore = Math.max(fundNameSimilarity(instrument.legalName, registration.legalName), fundNameSimilarity(instrument.tradeName, registration.legalName));
      const signature = fundSignatureEvidence(instrument, registration);
      if (nameScore >= 0.5 || signature.brandMatches >= 1 || signature.distinctiveMatches >= 2) {
        return { instrument, registration, cnpj: knownCnpj, method: "existing-cnpj", confidence: 0.99, issue: null };
      }
    }
  }
  const publicDirectoryCnpj = dataset.publicCnpjByTicker.get(instrument.ticker);
  if (publicDirectoryCnpj) {
    const registration = selectRegistration(byCnpj.get(publicDirectoryCnpj) || [], instrument.kindHint);
    if (registration) {
      return { instrument, registration, cnpj: publicDirectoryCnpj, method: "public-directory-cnpj", confidence: 0.98, issue: null };
    }
  }
  const candidates = active
    .filter((registration) => registration.kind === instrument.kindHint && compatiblePublicRegistration(instrument, registration))
    .map((registration) => ({
      registration,
      score: Math.max(fundNameSimilarity(instrument.legalName, registration.legalName), fundNameSimilarity(instrument.tradeName, registration.legalName)),
      signature: fundSignatureEvidence(instrument, registration),
    }))
    .sort((left, right) => right.score - left.score);
  const best = candidates[0];
  const second = candidates[1];
  const margin = (best?.score || 0) - (second?.score || 0);
  const distinctiveTokens = meaningfulTokens(instrument.legalName).size;
  const signatureCandidates = [...candidates].sort((left, right) => right.signature.rank - left.signature.rank || right.score - left.score);
  const signatureBest = signatureCandidates[0];
  const signatureSecond = signatureCandidates[1];
  const signatureMargin = (signatureBest?.signature.rank || 0) - (signatureSecond?.signature.rank || 0);
  const signatureAccepted = signatureBest
    && ((signatureBest.signature.matches >= 3
      && signatureBest.signature.coverage >= 0.5
      && (signatureMargin >= 1 || (signatureBest.signature.adjacentMatches >= 2 && signatureMargin >= 0.5)))
      || (signatureBest.score >= 0.8
        && signatureBest.signature.matches >= 2
        && signatureBest.signature.brandMatches >= 2
        && signatureMargin >= 2)
      || (signatureBest.score >= 0.65
        && signatureBest.signature.matches >= 4
        && signatureBest.signature.brandMatches >= 1
        && signatureBest.signature.adjacentMatches >= 1
        && signatureMargin >= 2));
  const unambiguousRawName = Boolean(best && best.score >= 0.95 && margin >= 0.2);
  const signatureDisagrees = Boolean(best && signatureBest
    && best.registration.cnpj !== signatureBest.registration.cnpj
    && signatureMargin >= 1
    && !unambiguousRawName);
  if (signatureAccepted) {
    const confidence = Math.min(0.97, 0.82 + signatureMargin * 0.03 + signatureBest.signature.coverage * 0.1);
    return { instrument, registration: signatureBest.registration, cnpj: signatureBest.registration.cnpj, method: "name", confidence: Math.round(confidence * 1_000) / 1_000, issue: null };
  }
  const accepted = best && !signatureDisagrees && (best.signature.coverage >= 0.5 || best.score >= 0.95) && ((best.score >= 0.95 && margin >= 0.01)
    || (best.score >= 0.84 && margin >= 0.05 && best.signature.brandMatches >= 1)
    || (best.score >= 0.74 && margin >= 0.08 && distinctiveTokens >= 2)
    || (best.score >= 0.65 && margin >= 0.15 && distinctiveTokens >= 2));
  if (accepted) return { instrument, registration: best.registration, cnpj: best.registration.cnpj, method: "name", confidence: Math.round(best.score * 1_000) / 1_000, issue: null };
  return {
    instrument,
    registration: null,
    cnpj: null,
    method: "unmatched",
    confidence: Math.round((best?.score || 0) * 1_000) / 1_000,
    issue: best ? `Conciliação ambígua; melhor similaridade ${(best.score * 100).toFixed(1)}%.` : "Cadastro CVM não localizado.",
  };
}

function buildEntry(input: {
  ticker: string;
  registration: CvmRegistrationRecord;
  instrument: B3InstrumentRecord | null;
  dataset: OfficialCatalogDataset;
  runId: string;
  method: CatalogMatchMethod;
  confidence: number;
  lifecycle: CanonicalFundCatalogEntry["lifecycle"];
}) {
  const { ticker, registration, instrument, dataset, runId, method, confidence, lifecycle } = input;
  const general = dataset.monthlyGeneral.get(registration.cnpj);
  const complement = dataset.monthlyComplement.get(registration.cnpj);
  const daily = dataset.dailyFunds.get(registration.cnpj);
  const assets = portfolio(dataset.monthlyAssets.get(registration.cnpj));
  const hasFiagroMonthly = dataset.monthlyFiagro.has(registration.cnpj);
  const managers = registration.managers
    .filter((manager) => manager.name)
    .map((manager) => ({ name: manager.name, cnpj: manager.cnpj }))
    .sort((left, right) => left.name.localeCompare(right.name));
  const withoutQuality = {
    schemaVersion: FUND_CATALOG_SCHEMA_VERSION,
    ticker,
    identity: {
      cnpj: registration.cnpj,
      isin: instrument?.isin || text(general?.Codigo_ISIN),
      cvmCode: registration.cvmCode,
      legalName: registration.legalName || general?.Nome_Fundo_Classe || instrument?.legalName || ticker,
      tradeName: instrument?.tradeName || null,
      kind: registration.kind,
    },
    serviceProviders: {
      administrator: {
        name: registration.administrator.name || general?.Nome_Administrador || "",
        cnpj: registration.administrator.cnpj || digits(general?.CNPJ_Administrador),
      },
      managers,
      managementModel: managers.length ? "external-manager" : registration.administrator.name ? "administrator-managed" : "not-reported",
    },
    classification: classification(registration, general, assets),
    capital: capital(registration, general, complement, daily),
    investors: investorComposition(complement) || dailyInvestorComposition(daily),
    portfolio: assets,
    lifecycle,
    provenance: {
      catalogRunId: runId,
      matchMethod: method,
      matchConfidence: confidence,
      sourceIds: [
        "b3-instruments" as const,
        "cvm-registration" as const,
        ...(general || complement ? [hasFiagroMonthly ? "cvm-fiagro-monthly" as const : "cvm-monthly" as const] : []),
        ...(daily ? ["cvm-daily" as const] : []),
        ...(method === "public-directory-cnpj" ? ["public-fund-directory" as const] : []),
      ],
      referenceDate: complement?.Data_Referencia || general?.Data_Referencia
        || normalizedRowValue(daily, "DT_COMPTC") || registration.netWorthDate,
      generatedAt: dataset.fetchedAt,
    },
  } satisfies Omit<CanonicalFundCatalogEntry, "dataQuality" | "contentHash">;
  const dataQuality = quality(withoutQuality, dataset.fetchedAt);
  return { ...withoutQuality, dataQuality, contentHash: materialHash(withoutQuality, dataQuality) } satisfies CanonicalFundCatalogEntry;
}

function coverage(entries: CanonicalFundCatalogEntry[], b3Candidates: number, matchedCandidates: number, duplicateCnpjGroups: number): FundCatalogCoverage {
  const active = entries.filter((entry) => entry.lifecycle.status === "active");
  const applicable = active.filter((entry) => entry.dataQuality.applicableToEssentialTarget);
  const basicComplete = active.filter((entry) => entry.dataQuality.basicComplete).length;
  const essentialComplete = applicable.filter((entry) => entry.dataQuality.essentialComplete).length;
  return {
    b3Candidates,
    matchedCandidates,
    unmatchedCandidates: b3Candidates - matchedCandidates,
    sourceMatchPercent: percent(matchedCandidates, b3Candidates),
    activeFunds: active.length,
    inactiveFunds: entries.filter((entry) => entry.lifecycle.status === "inactive").length,
    underReviewFunds: entries.filter((entry) => entry.lifecycle.status === "under_review").length,
    basicComplete,
    basicCoveragePercent: percent(basicComplete, active.length),
    essentialApplicable: applicable.length,
    essentialComplete,
    essentialCoveragePercent: percent(essentialComplete, applicable.length),
    duplicateCnpjGroups,
  };
}

function planItem(entry: CanonicalFundCatalogEntry, existing: ExistingState | undefined): FundCatalogPlanItem | null {
  if (existing?.catalog?.contentHash === entry.contentHash) return null;
  let action: FundCatalogPlanItem["action"] = existing?.catalog ? "update" : "add";
  if (entry.lifecycle.status === "inactive" && existing?.catalog?.lifecycle.status !== "inactive") action = "inactivate";
  if (entry.lifecycle.status === "active" && existing?.catalog?.lifecycle.status === "inactive") action = "reactivate";
  return {
    ticker: entry.ticker,
    action,
    reasons: existing?.catalog ? ["Dados oficiais ou qualidade do catálogo foram atualizados."] : ["Fundo ainda não possuía cadastro canônico normalizado."],
    previousContentHash: existing?.catalog?.contentHash || null,
    catalog: entry,
  };
}

export class FundCatalogEngine {
  build(dataset: OfficialCatalogDataset, legacy: LegacyFundRecord[], overlays: ExistingOverlayRecord[], actor: string): FundCatalogBuildResult {
    const existing = existingStates(legacy, overlays);
    const { byCnpj, active } = registrationMaps(dataset.registrations);
    const monthlyByIsin = new Map<string, CvmMonthlyGeneralRecord>();
    for (const row of dataset.monthlyGeneral.values()) {
      const isin = text(row.Codigo_ISIN)?.toUpperCase();
      if (isin) monthlyByIsin.set(isin, row);
    }
    const preliminary = dataset.b3.map((instrument) => matchInstrument(instrument, dataset, existing, byCnpj, active, monthlyByIsin));
    const matched = preliminary.filter((match) => match.cnpj && match.registration);
    const groups = new Map<string, PreliminaryMatch[]>();
    for (const match of matched) {
      const values = groups.get(match.cnpj!) || [];
      values.push(match);
      groups.set(match.cnpj!, values);
    }
    const duplicateGroups = Array.from(groups.values()).filter((values) => values.length > 1);
    const preferredTickerByCnpj = new Map<string, string>();
    for (const [cnpj, values] of groups) {
      if (values.length === 1) preferredTickerByCnpj.set(cnpj, values[0].instrument.ticker);
      else {
        const direct = values.filter((value) => value.method === "isin");
        if (direct.length === 1) preferredTickerByCnpj.set(cnpj, direct[0].instrument.ticker);
      }
    }

    const sourceHash = hash(dataset.sources.map((source) => [source.id, source.sha256]));
    const runId = `catalog-${dataset.fetchedAt.replace(/\D/g, "").slice(0, 17)}-${sourceHash.slice(0, 8)}`;
    const entries = new Map<string, CanonicalFundCatalogEntry>();
    const reviewSamples: Array<{ ticker: string; issue: string }> = preliminary
      .filter((match) => !match.registration || match.issue)
      .map((match) => ({ ticker: match.instrument.ticker, issue: match.issue || "Não conciliado." }));

    for (const match of matched) {
      const collision = (groups.get(match.cnpj!)?.length || 0) > 1;
      const preferredTicker = preferredTickerByCnpj.get(match.cnpj!);
      const collisionNeedsReview = collision && preferredTicker !== match.instrument.ticker;
      const status = activeRegistration(match.registration!) && !collisionNeedsReview && (!collision || preferredTicker === match.instrument.ticker)
        ? "active" : "under_review";
      if (collisionNeedsReview || (collision && !preferredTicker)) reviewSamples.push({
        ticker: match.instrument.ticker,
        issue: `CNPJ conciliado também a ${groups.get(match.cnpj!)!.map((value) => value.instrument.ticker).filter((ticker) => ticker !== match.instrument.ticker).join(", ")}; requer confirmação individual por CNPJ.`,
      });
      const entry = buildEntry({
        ticker: match.instrument.ticker,
        registration: match.registration!,
        instrument: match.instrument,
        dataset,
        runId,
        method: match.method,
        confidence: match.confidence,
        lifecycle: {
          status,
          cvmStatus: match.registration!.status,
          b3Listed: true,
          operatingSince: match.registration!.operatingSince,
          canceledAt: match.registration!.canceledAt,
          lastSeenOnB3: dataset.fetchedAt.slice(0, 10),
          missingB3Observations: 0,
          replacedByTicker: null,
          previousTickers: [],
          reason: status === "active" ? "Presente no catálogo B3 e com cadastro CVM ativo."
            : "Ticker presente na B3, mas a conciliação individual de CNPJ ou o status CVM requer revisão; nenhuma inativação automática foi autorizada.",
        },
      });
      entries.set(entry.ticker, entry);
    }

    for (const state of existing.values()) {
      if (entries.has(state.ticker) || !state.cnpj) continue;
      const registration = selectRegistration(byCnpj.get(state.cnpj) || []);
      if (!registration) {
        reviewSamples.push({ ticker: state.ticker, issue: "Fundo existente sem conciliação cadastral na CVM." });
        continue;
      }
      const directSuccessors = (groups.get(state.cnpj) || []).filter((match) => match.method === "isin");
      const replacement = directSuccessors.length === 1 ? directSuccessors[0].instrument.ticker : null;
      const canceled = normalizeText(registration.status).includes("CANCEL");
      const liquidating = normalizeText(registration.status).includes("LIQUIDA");
      // Ausência na fotografia B3 completa + liquidação no cadastro CVM são
      // duas evidências oficiais independentes de que o ticker não está mais
      // negociável. Uma simples ausência com CVM normal continua em revisão.
      const inactive = canceled || liquidating || Boolean(replacement && replacement !== state.ticker);
      const previousObservations = state.catalog?.lifecycle.missingB3Observations || 0;
      const entry = buildEntry({
        ticker: state.ticker,
        registration,
        instrument: null,
        dataset,
        runId,
        method: "registration-cnpj",
        confidence: 1,
        lifecycle: {
          status: inactive ? "inactive" : "under_review",
          cvmStatus: registration.status,
          b3Listed: false,
          operatingSince: registration.operatingSince,
          canceledAt: registration.canceledAt,
          lastSeenOnB3: state.catalog?.lifecycle.lastSeenOnB3 || null,
          missingB3Observations: previousObservations + 1,
          replacedByTicker: replacement !== state.ticker ? replacement : null,
          previousTickers: state.catalog?.lifecycle.previousTickers || [],
          reason: canceled ? "Cadastro CVM cancelado e ticker ausente do catálogo B3." : liquidating
            ? "Ticker ausente do catálogo B3 e cadastro CVM em liquidação; inativado no produto sem apagar o histórico." : replacement && replacement !== state.ticker
            ? `Ticker ausente da B3; o ISIN oficial conciliou o mesmo CNPJ ao ticker vigente ${replacement}.` : "Ticker ausente da B3; mantido em revisão, sem inativação automática.",
        },
      });
      entries.set(entry.ticker, entry);
    }

    const catalogEntries = Array.from(entries.values()).sort((left, right) => left.ticker.localeCompare(right.ticker));
    const metrics = coverage(catalogEntries, dataset.b3.length, matched.length, duplicateGroups.length);
    const sentinelsPresent = ["MXRF11", "VGIA11", "TGAR11", "KNCA11"].every((ticker) => dataset.b3.some((instrument) => instrument.ticker === ticker));
    const safetyBlockers: string[] = [];
    if (dataset.b3.length < 300) safetyBlockers.push("Catálogo B3 incompleto: menos de 300 candidatos.");
    if (!sentinelsPresent) safetyBlockers.push("Fundos sentinela ausentes da fonte B3.");
    if (metrics.sourceMatchPercent < SOURCE_MATCH_TARGET) safetyBlockers.push(`Conciliação B3/CVM abaixo da meta de publicação de ${SOURCE_MATCH_TARGET}%.`);
    if (metrics.basicCoveragePercent < BASIC_TARGET) safetyBlockers.push(`Cobertura cadastral básica abaixo da meta de publicação de ${BASIC_TARGET}%.`);
    if (metrics.essentialCoveragePercent < ESSENTIAL_TARGET) safetyBlockers.push(`Cobertura de indicadores essenciais abaixo da meta de publicação de ${ESSENTIAL_TARGET}%.`);
    const destructiveChangesAllowed = sentinelsPresent
      && metrics.sourceMatchPercent >= SOURCE_MATCH_TARGET
      && metrics.basicCoveragePercent === BASIC_TARGET
      && metrics.essentialCoveragePercent >= ESSENTIAL_TARGET;
    let items = catalogEntries.map((entry) => planItem(entry, existing.get(entry.ticker))).filter((item): item is FundCatalogPlanItem => Boolean(item));
    if (!destructiveChangesAllowed) {
      items = items.filter((item) => item.action !== "inactivate");
      if (catalogEntries.some((entry) => entry.lifecycle.status === "inactive")) reviewSamples.push({ ticker: "SISTEMA", issue: "Inativações foram retiradas da prévia porque os critérios destrutivos ainda não foram atingidos." });
    }
    const acceptanceGaps: string[] = [];
    if (metrics.sourceMatchPercent < SOURCE_MATCH_TARGET) acceptanceGaps.push(`Conciliação oficial em ${metrics.sourceMatchPercent.toFixed(2)}%; meta ${SOURCE_MATCH_TARGET}%.`);
    if (metrics.basicCoveragePercent < BASIC_TARGET) acceptanceGaps.push(`Dados básicos em ${metrics.basicCoveragePercent.toFixed(2)}%; meta ${BASIC_TARGET}%.`);
    if (metrics.essentialCoveragePercent < ESSENTIAL_TARGET) acceptanceGaps.push(`Indicadores essenciais em ${metrics.essentialCoveragePercent.toFixed(2)}%; meta ${ESSENTIAL_TARGET}%.`);
    const planHash = hash(items.map((item) => ({ ticker: item.ticker, action: item.action, contentHash: item.catalog.contentHash })));
    const approvalHash = hash([runId, planHash, actor]);
    const actionCount = (action: FundCatalogPlanItem["action"]) => items.filter((item) => item.action === action).length;
    const run = {
      id: runId,
      status: "preview" as const,
      mode: "official-backfill" as const,
      actor,
      createdAt: dataset.fetchedAt,
      appliedAt: null,
      failedAt: null,
      error: null,
      sourceHash,
      planHash,
      approvalHash,
      sources: dataset.sources,
      coverage: metrics,
      acceptance: {
        basicTargetPercent: BASIC_TARGET,
        essentialTargetPercent: ESSENTIAL_TARGET,
        sourceMatchTargetPercent: SOURCE_MATCH_TARGET,
        meetsTargets: acceptanceGaps.length === 0,
        gaps: acceptanceGaps,
      },
      safety: {
        safeToApply: safetyBlockers.length === 0,
        destructiveChangesAllowed,
        blockers: safetyBlockers,
        sentinelsPresent,
      },
      totals: {
        planned: items.length,
        added: actionCount("add"),
        updated: actionCount("update"),
        inactivated: actionCount("inactivate"),
        reactivated: actionCount("reactivate"),
        unchanged: catalogEntries.length - items.length,
      },
      reviewSamples: reviewSamples.slice(0, 100),
      chunks: Math.ceil(items.length / 40),
      appliedItems: 0,
      verifiedAt: null,
    };
    return { run, items };
  }

  audit(entries: CanonicalFundCatalogEntry[], runId: string | null, generatedAt: string): FundCatalogAudit {
    const metrics = coverage(entries, entries.filter((entry) => entry.lifecycle.b3Listed).length, entries.filter((entry) => entry.lifecycle.b3Listed).length, this.duplicateCnpjGroups(entries));
    const missingBasic = entries.filter((entry) => entry.lifecycle.status === "active" && !entry.dataQuality.basicComplete)
      .map((entry) => ({ ticker: entry.ticker, fields: entry.dataQuality.missingBasic }));
    const missingEssential = entries.filter((entry) => entry.dataQuality.applicableToEssentialTarget && !entry.dataQuality.essentialComplete)
      .map((entry) => ({ ticker: entry.ticker, fields: entry.dataQuality.missingEssential }));
    return {
      generatedAt,
      runId,
      totalCatalogDocuments: entries.length,
      activeDocuments: metrics.activeFunds,
      basicCoveragePercent: metrics.basicCoveragePercent,
      essentialCoveragePercent: metrics.essentialCoveragePercent,
      duplicateCnpjGroups: metrics.duplicateCnpjGroups,
      missingBasic: missingBasic.slice(0, 250),
      missingEssential: missingEssential.slice(0, 250),
      staleOrInactive: entries.filter((entry) => entry.lifecycle.status !== "active")
        .map((entry) => ({ ticker: entry.ticker, status: entry.lifecycle.status, reason: entry.lifecycle.reason })).slice(0, 250),
      acceptanceMet: metrics.basicCoveragePercent === BASIC_TARGET && metrics.essentialCoveragePercent >= ESSENTIAL_TARGET,
    };
  }

  private duplicateCnpjGroups(entries: CanonicalFundCatalogEntry[]) {
    const groups = new Map<string, number>();
    for (const entry of entries.filter((item) => item.lifecycle.status === "active")) groups.set(entry.identity.cnpj, (groups.get(entry.identity.cnpj) || 0) + 1);
    return Array.from(groups.values()).filter((count) => count > 1).length;
  }
}

export const fundCatalogEngine = new FundCatalogEngine();
