import type { DataQualityAssessment, RegulatoryFund, ValidationIssue } from "@/types/regulatory";
import { normalizeTicker } from "@/lib/regulatory/RegulatoryNormalizer";

const MAX_DATA_AGE_DAYS = 120;
const REQUIRED_FINANCIAL_FIELDS = [
  "price",
  "netWorth",
  "vpCota",
  "numberShares",
  "numberCotistas",
  "dailyLiquidity",
] as const;

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let normalized = value.replace(/R\$|%|\s/g, "");
  if (!normalized || normalized === "-") return null;
  normalized = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized.replace(/\.(?=\d{3}(\D|$))/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function valueAt(data: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = path.split(".").reduce<unknown>((current, key) => {
      if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
      return (current as Record<string, unknown>)[key];
    }, data);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function numberAt(data: Record<string, unknown>, paths: string[]) {
  return finiteNumber(valueAt(data, paths));
}

function parsedDate(value: unknown) {
  if (!value) return null;
  const br = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const date = br
    ? new Date(Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1])))
    : new Date(value as string | number | Date);
  if (
    br
    && (
      date.getUTCFullYear() !== Number(br[3])
      || date.getUTCMonth() !== Number(br[2]) - 1
      || date.getUTCDate() !== Number(br[1])
    )
  ) return null;
  return Number.isNaN(date.getTime()) ? null : date;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeCnpj(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 14 ? digits : "";
}

export function validCnpj(value: unknown) {
  const digits = normalizeCnpj(value);
  if (!digits || /^(\d)\1+$/.test(digits)) return false;
  const calculate = (length: number) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate(12) === Number(digits[12]) && calculate(13) === Number(digits[13]);
}

export function validateRegulatoryFund(fund: RegulatoryFund): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!normalizeTicker(fund.ticker)) issues.push({ code: "invalid_ticker", field: "ticker", message: "Ticker ausente ou inválido.", severity: "error" });
  if (fund.kind === "UNKNOWN") issues.push({ code: "unknown_fund_kind", field: "kind", message: "Tipo FII/FIAGRO não identificado.", severity: "error" });
  if (!fund.name && !fund.corporateName) issues.push({ code: "missing_name", field: "name", message: "Nome do fundo não informado.", severity: "warning" });
  if (!fund.cnpj) issues.push({ code: "missing_cnpj", field: "cnpj", message: "CNPJ não informado.", severity: "warning" });
  else if (!validCnpj(fund.cnpj)) issues.push({ code: "invalid_cnpj", field: "cnpj", message: "CNPJ com formato ou dígitos inválidos.", severity: "error" });
  if (!fund.segment) issues.push({ code: "missing_segment", field: "segment", message: "Segmento não informado.", severity: "warning" });
  if (!fund.sources.length) issues.push({ code: "missing_source", field: "sources", message: "Fonte regulatória não identificada.", severity: "error" });
  return issues;
}

export function assessFundDataQuality(
  fund: RegulatoryFund,
  data: Record<string, unknown>,
  now = new Date(),
  maxAgeDays = MAX_DATA_AGE_DAYS,
): DataQualityAssessment {
  const issues = validateRegulatoryFund(fund);
  const missingFields: string[] = [];
  const invalidFields: string[] = issues
    .filter((issue) => issue.severity === "error" && issue.field)
    .map((issue) => issue.field!);
  const reasons = issues.map((issue) => issue.message);

  const values = {
    price: valueAt(data, ["price", "currentPrice", "marketData.price"]),
    netWorth: valueAt(data, ["netWorth", "valuation.netWorth", "patrimonioLiquido"]),
    vpCota: valueAt(data, ["vpCota", "valuation.vpCota", "valorPatrimonialPorCota"]),
    numberShares: valueAt(data, ["numberShares", "valuation.numberShares", "issuedShares"]),
    numberCotistas: valueAt(data, ["numberCotistas", "numberShareholders", "investorComposition.totalAccounts"]),
    dailyLiquidity: valueAt(data, ["averageDailyLiquidity", "dailyLiquidity", "liquidity"]),
  };

  for (const field of REQUIRED_FINANCIAL_FIELDS) {
    if (values[field] === undefined || finiteNumber(values[field]) === null) missingFields.push(field);
  }

  const price = finiteNumber(values.price);
  const netWorth = finiteNumber(values.netWorth);
  const vpCota = finiteNumber(values.vpCota);
  const numberShares = finiteNumber(values.numberShares);
  const numberCotistas = finiteNumber(values.numberCotistas);
  const dailyLiquidity = finiteNumber(values.dailyLiquidity);
  const pvp = numberAt(data, ["pvp", "valuation.pvp"]);
  const premiumDiscount = numberAt(data, ["premiumDiscountPercent", "valuation.premiumDiscountPercent"]);

  if (price !== null && price <= 0) invalidFields.push("price");
  if (netWorth !== null && netWorth < 0) invalidFields.push("netWorth");
  if (numberShares !== null && numberShares <= 0 && fund.status !== "inactive") invalidFields.push("numberShares");
  if (numberCotistas !== null && numberCotistas < 0) invalidFields.push("numberCotistas");
  if (dailyLiquidity !== null && dailyLiquidity < 0) invalidFields.push("dailyLiquidity");
  if (vpCota !== null && vpCota <= 0) invalidFields.push("vpCota");
  if (pvp !== null && (pvp <= 0 || pvp < 0.1 || pvp > 10)) invalidFields.push("pvp");
  if (pvp !== null && price && vpCota) {
    const calculated = price / vpCota;
    if (Math.abs(calculated - pvp) / Math.max(calculated, pvp) > 0.15) invalidFields.push("pvp");
  }
  if (pvp !== null && premiumDiscount !== null && Math.abs(premiumDiscount - ((pvp - 1) * 100)) > 0.1) {
    invalidFields.push("premiumDiscountPercent");
  }

  const composition = valueAt(data, ["investorComposition"]);
  if (composition && typeof composition === "object" && !Array.isArray(composition)) {
    const record = composition as Record<string, unknown>;
    const total = finiteNumber(record.totalAccounts);
    const individuals = finiteNumber(record.individualAccounts);
    const legalEntities = finiteNumber(record.legalEntityAccounts);
    if (total !== null && individuals !== null && legalEntities !== null) {
      const tolerance = Math.max(1, total * 0.01);
      if (Math.abs(individuals + legalEntities - total) > tolerance) invalidFields.push("investorComposition");
    }
    for (const field of ["individualPercent", "legalEntityPercent"]) {
      const percentage = finiteNumber(record[field]);
      if (percentage !== null && (percentage < 0 || percentage > 100)) invalidFields.push(`investorComposition.${field}`);
    }
  }

  const dateCandidates = [
    valueAt(data, ["marketDataUpdatedAt"]),
    valueAt(data, ["valuationReferenceDate"]),
    valueAt(data, ["catalogUpdatedAt"]),
    ...fund.sources.map((item) => item.fetchedAt),
  ].map(parsedDate).filter((date): date is Date => Boolean(date));
  const asOfDate = dateCandidates.sort((left, right) => right.getTime() - left.getTime())[0] || null;
  const ageDays = asOfDate ? Math.floor((now.getTime() - asOfDate.getTime()) / 86_400_000) : null;
  if (ageDays !== null && ageDays < -1) invalidFields.push("referenceDate");
  const freshnessStatus = ageDays === null ? "unknown" : ageDays > maxAgeDays ? "stale" : "current";

  const deduplicatedMissing = unique(missingFields);
  const deduplicatedInvalid = unique(invalidFields);
  if (deduplicatedMissing.length) reasons.push(`Campos financeiros ausentes: ${deduplicatedMissing.join(", ")}.`);
  if (deduplicatedInvalid.length) reasons.push(`Campos inválidos: ${deduplicatedInvalid.join(", ")}.`);
  if (freshnessStatus === "stale") reasons.push(`Dados com ${ageDays} dias, acima do limite de ${maxAgeDays} dias.`);

  const noIdentity = !fund.name && !fund.corporateName && !fund.cnpj;
  const status = noIdentity && deduplicatedMissing.length === REQUIRED_FINANCIAL_FIELDS.length
    ? "unavailable"
    : deduplicatedInvalid.length
      ? "invalid"
      : freshnessStatus === "stale"
        ? "stale"
        : deduplicatedMissing.length || issues.some((issue) => issue.severity === "warning")
          ? "partial"
          : "valid";
  const completeness = 1 - (deduplicatedMissing.length / REQUIRED_FINANCIAL_FIELDS.length);
  const confidence = Math.max(0, Math.min(100, Math.round(
    completeness * 70
      + Math.min(fund.sources.length, 3) / 3 * 20
      + (freshnessStatus === "current" ? 10 : freshnessStatus === "unknown" ? 3 : 0),
  )));

  return {
    status,
    valid: status === "valid",
    confidence,
    reasons: unique(reasons),
    missingFields: deduplicatedMissing,
    invalidFields: deduplicatedInvalid,
    freshness: {
      status: freshnessStatus,
      asOf: asOfDate?.toISOString() || null,
      ageDays,
      maxAgeDays,
    },
  };
}
