import {
  REGULATORY_SCHEMA_VERSION,
  type FundKind,
  type MarketQuote,
  type PublicFundData,
  type RegulatoryFund,
  type RegulatorySource,
} from "@/types/regulatory";
import type { CacheState } from "@/lib/regulatory/RegulatoryTypes";
import type { CanonicalFundCatalogEntry } from "@/types/fund-catalog";

const PARSER_VERSION = "regulatory-v1";

// These values are owned by the legacy ingestion/publication pipeline. An
// overlay may add regulatory metadata, but it cannot silently replace them.
export const PROTECTED_LEGACY_FIELDS = new Set([
  "code",
  "ticker",
  "createdAt",
  "created_at",
  "modified_in",
  "updatedAt",
  "price",
  "opening",
  "variation",
  "minimum",
  "maximum",
]);

export function nowIso() {
  return new Date().toISOString();
}

export function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeTicker(value: unknown) {
  const ticker = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(ticker) ? ticker : "";
}

function stringValue(value: unknown): string | null {
  const result = String(value ?? "").trim();
  return result || null;
}

function firstString(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = stringValue(data[key]);
    if (value) return value;
  }
  return null;
}

export function inferFundKind(data: Record<string, unknown>): FundKind {
  const haystack = [data.kind, data.fundKind, data.type, data.tipo, data.segment, data.segmento, data.sector]
    .map((value) => String(value || "").toUpperCase())
    .join(" ");
  if (/FIAGRO|AGRO|CRA/.test(haystack)) return "FIAGRO";
  if (/FI.?INFRA|INFRAESTRUTURA/.test(haystack)) return "FI_INFRA";
  if (/FII|IMOBILI|RECEBÍVEIS|RECEBIVEIS|SHOPPING|LOGÍSTIC|LOGISTIC|LAJE|HÍBRID|HIBRID/.test(haystack)) return "FII";
  return normalizeTicker(data.ticker || data.code).endsWith("11") ? "FII" : "UNKNOWN";
}

export function source(provider: string, kind: RegulatorySource["kind"], fetchedAt?: string | null): RegulatorySource {
  return { provider, kind, fetchedAt: fetchedAt || null, parserVersion: PARSER_VERSION };
}

function isProtectedLegacyField(key: string) {
  return PROTECTED_LEGACY_FIELDS.has(key) || /^earnings\d{4}$/.test(key);
}

export function safeRegulatoryOverlay(overlay?: Record<string, unknown> | null) {
  if (!overlay) return {};
  return Object.fromEntries(Object.entries(overlay).filter(([key]) => !isProtectedLegacyField(key) && !["raw", "catalog", "catalogRunId"].includes(key)));
}

function formattedCnpj(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 14 ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : value;
}

function catalogFrom(overlay?: Record<string, unknown> | null) {
  const value = overlay?.catalog;
  return value && typeof value === "object" && !Array.isArray(value) ? value as CanonicalFundCatalogEntry : null;
}

export function catalogPublicProjection(overlay?: Record<string, unknown> | null): Record<string, unknown> {
  const catalog = catalogFrom(overlay);
  if (!catalog) return {};
  const capital = catalog.capital;
  const calculatedNav = capital?.netWorth && capital.issuedShares ? capital.netWorth / capital.issuedShares : null;
  const navPerShare = capital?.reportedNavPerShare || calculatedNav;
  const investors = catalog.investors;
  const legalEntityAccounts = investors?.legalEntityAccounts ?? null;
  const managers = catalog.serviceProviders.managers;
  const managerName = managers.map((manager) => manager.name).join("; ")
    || (catalog.serviceProviders.managementModel === "administrator-managed" ? `${catalog.serviceProviders.administrator.name} (sem gestor separado informado pela CVM)` : null);
  const managerCnpj = managers[0]?.cnpj
    || (catalog.serviceProviders.managementModel === "administrator-managed" ? catalog.serviceProviders.administrator.cnpj : null);
  return {
    cnpj: formattedCnpj(catalog.identity.cnpj),
    name: catalog.identity.tradeName || catalog.identity.legalName,
    socialReason: catalog.identity.legalName,
    corporateName: catalog.identity.legalName,
    isin: catalog.identity.isin,
    cvmCode: catalog.identity.cvmCode,
    fundKind: catalog.identity.kind,
    fundType: catalog.identity.kind,
    type: catalog.identity.kind,
    administrator: catalog.serviceProviders.administrator.name || null,
    administratorCnpj: catalog.serviceProviders.administrator.cnpj ? formattedCnpj(catalog.serviceProviders.administrator.cnpj) : null,
    manager: managerName,
    managerCnpj: managerCnpj ? formattedCnpj(managerCnpj) : null,
    managers: managers.map((manager) => ({ ...manager, cnpj: manager.cnpj ? formattedCnpj(manager.cnpj) : null })),
    sector: catalog.classification.sector,
    segment: catalog.classification.segment,
    strategy: catalog.classification.strategy,
    declaredSegment: catalog.classification.declaredSegment,
    regulatoryClassification: catalog.classification.regulatoryClassification,
    managementType: catalog.classification.managementType,
    targetAudience: catalog.classification.targetAudience,
    condominiumForm: catalog.classification.condominiumForm,
    exclusive: catalog.classification.exclusive,
    isFundOfFunds: catalog.classification.isFundOfFunds,
    active: catalog.lifecycle.status === "active",
    status: catalog.lifecycle.status,
    lifecycle: catalog.lifecycle,
    numberShares: capital?.issuedShares || null,
    netWorth: capital?.netWorth || null,
    vpCota: navPerShare,
    valorPatrimonialPorCota: navPerShare,
    valuationReferenceDate: capital?.referenceDate || null,
    numberCotistas: investors?.totalAccounts || null,
    numberShareholders: investors?.totalAccounts || null,
    investorComposition: investors ? {
      referenceDate: investors.referenceDate,
      totalAccounts: investors.totalAccounts,
      individualAccounts: investors.individualAccounts,
      individualPercent: investors.totalAccounts && investors.individualAccounts !== null
        ? Math.round((investors.individualAccounts / investors.totalAccounts) * 10_000) / 100 : null,
      legalEntityAccounts,
      legalEntityPercent: investors.totalAccounts && legalEntityAccounts !== null ? Math.round((legalEntityAccounts / investors.totalAccounts) * 10_000) / 100 : null,
      legalEntityCategories: investors.legalEntityCategories,
      largestLegalEntityHolder: investors.largestLegalEntityHolder,
    } : null,
    catalogDataQuality: catalog.dataQuality,
    catalogUpdatedAt: catalog.provenance.generatedAt,
  };
}

export function canonicalFrom(ticker: string, legacy: Record<string, unknown>, overlay?: Record<string, unknown> | null): RegulatoryFund {
  const safeOverlay = safeRegulatoryOverlay(overlay);
  const catalogProjection = catalogPublicProjection(overlay);
  const merged: Record<string, unknown> = { ...legacy, ...safeOverlay, ...catalogProjection, ticker, code: ticker };
  const overlaySources = Array.isArray(overlay?.sources) ? overlay.sources as RegulatorySource[] : [];
  const catalog = catalogFrom(overlay);
  const catalogProviderNames: Record<CanonicalFundCatalogEntry["provenance"]["sourceIds"][number], string> = {
    "b3-instruments": "B3 — Títulos Negociáveis",
    "cvm-registration": "CVM — Cadastro de Fundos e Classes",
    "cvm-monthly": "CVM — Informe Mensal FII",
    "cvm-fiagro-monthly": "CVM — Informe Mensal FIAGRO",
    "cvm-daily": "CVM — Informe Diário de Fundos",
    "public-fund-directory": "Diretório público — ponte de identidade ticker/CNPJ",
  };
  const catalogSources = catalog?.provenance.sourceIds.map((id) => source(
    catalogProviderNames[id],
    "regulatory",
    catalog.provenance.referenceDate,
  )) || [];
  const sources = [
    ...(Object.keys(legacy).length ? [source("Base interna Dados FII", "legacy", toIso(legacy.modified_in || legacy.updatedAt))] : []),
    ...overlaySources,
    ...catalogSources,
  ]
    .filter((item) => item && typeof item.provider === "string" && typeof item.kind === "string")
    .filter((item, index, list) => list.findIndex((candidate) => candidate.provider === item.provider && candidate.kind === item.kind) === index);
  return {
    schemaVersion: REGULATORY_SCHEMA_VERSION,
    ticker,
    kind: inferFundKind(merged),
    name: firstString(merged, ["name", "fundName", "fantasyName", "nome"]),
    corporateName: firstString(merged, ["corporateName", "company_name", "razaoSocial", "razãoSocial"]),
    cnpj: firstString(merged, ["cnpj", "CNPJ"]),
    segment: firstString(merged, ["segment", "segmento", "sector"]),
    manager: firstString(merged, ["manager", "gestor", "management"]),
    administrator: firstString(merged, ["administrator", "administrador", "admin"]),
    status: ["active", "inactive"].includes(String(merged.status)) ? merged.status as "active" | "inactive" : "unknown",
    currentVersion: Number(overlay?.currentVersion || 0),
    publishedAt: toIso(overlay?.publishedAt),
    publishedBy: stringValue(overlay?.publishedBy),
    sources,
    raw: merged,
  };
}

export function normalizeDividendFields(data: Record<string, unknown>) {
  const normalized = { ...data };
  for (const key of Object.keys(normalized)) {
    const year = normalized[key];
    if (!/^earnings\d{4}$/.test(key) || !year || typeof year !== "object" || Array.isArray(year)) continue;
    normalized[key] = Object.fromEntries(Object.entries(year).map(([month, item]) => {
      const info = item && typeof item === "object" ? item as Record<string, unknown> : {};
      const number = Number(String(info.earnings || "0").replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
      return [month, { ...info, earnings: number ? `R$ ${number.toFixed(3).replace(".", ",")}` : info.earnings || "" }];
    }));
  }
  return normalized;
}

export function marketFallback(ticker: string): MarketQuote {
  return { code: ticker, price: "-", opening: "-", variation: "-", minimum: "-", maximum: "-" };
}

export function withMarketQuote(value: PublicFundData, quote: MarketQuote | null, cache: CacheState): PublicFundData {
  const fundSource = value.fundDataSource || null;
  return {
    ...value,
    ...(quote || marketFallback(value.ticker)),
    code: value.ticker,
    ticker: value.ticker,
    dataSources: {
      price: quote ? "Planilha de cotações Dados FII" : "Preço indisponível",
      fund: fundSource || "Dados cadastrais/dividendos indisponíveis",
      regulatory: value.regulatoryMeta.currentVersion ? "Base regulatória versionada Dados FII" : "Sem overlay regulatório publicado",
    },
    marketDataSource: quote ? "Planilha de cotações Dados FII" : null,
    marketDataUpdatedAt: quote ? nowIso() : null,
    regulatoryMeta: { ...value.regulatoryMeta, cache },
  };
}
