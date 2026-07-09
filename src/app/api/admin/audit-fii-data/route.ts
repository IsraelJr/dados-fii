import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION = "Fiis";
const AUDIT_COLLECTION = "FiiDataAudits";
const TIME_ZONE = "America/Sao_Paulo";
const TYPE_SPECIFIC_GROUPS = new Set(["Crédito, agro e infra", "Tijolo e operação imobiliária"]);

type FieldDefinition = {
  label: string;
  paths: string[];
  critical?: boolean;
};

type GroupDefinition = {
  label: string;
  description: string;
  fields: FieldDefinition[];
};

const GROUPS: GroupDefinition[] = [
  {
    label: "Identificação e classificação",
    description: "Dados básicos para classificar o FII e agrupar a carteira.",
    fields: [
      { label: "ticker", paths: ["code", "ticker", "symbol"], critical: true },
      { label: "nome", paths: ["name", "nome", "shortName", "razaoSocial", "razao_social", "socialReason" ] },
      { label: "segmento", paths: ["segment", "segment_new", "segmento"], critical: true },
      { label: "setor", paths: ["sector", "setor"], critical: true },
      { label: "tipo de fundo", paths: ["fundType", "type", "tipo", "tipoFundo"], critical: true },
      { label: "IFIX", paths: ["isIFIX", "ifix", "marketData.isIFIX"] },
    ],
  },
  {
    label: "Mercado e liquidez",
    description: "Base para avaliar risco de saída, institucionalização e capacidade de zerar posição.",
    fields: [
      { label: "preço atual", paths: ["price", "currentPrice", "cotacao", "marketData.price"], critical: true },
      { label: "liquidez diária", paths: ["dailyLiquidity", "liquidity", "averageDailyLiquidity", "avgDailyLiquidity", "volumeMedioDiario", "liquidezDiaria", "marketData.dailyLiquidity", "marketData.liquidity"], critical: true },
      { label: "cotas emitidas", paths: ["numberShares", "sharesOutstanding", "numberOfShares", "quotasIssued", "issuedQuotas", "cotasEmitidas", "numeroCotas", "marketData.numberShares"], critical: true },
      { label: "cotistas", paths: ["numberCotistas", "numberShareholders", "shareholders", "shareholdersCount", "cotistas", "numeroCotistas", "investorsCount", "marketData.numberCotistas", "marketData.numberShareholders"], critical: true },
      { label: "valor de mercado", paths: ["marketCap", "valorMercado", "marketData.marketCap"], critical: true },
      { label: "peso no IFIX", paths: ["ifixWeight", "marketData.ifixWeight"] },
      { label: "spread", paths: ["spread", "bidAskSpread", "marketData.spread"] },
      { label: "volatilidade", paths: ["volatility12m", "volatility", "marketData.volatility12m"] },
      { label: "drawdown", paths: ["maxDrawdown12m", "drawdown12m", "marketData.maxDrawdown12m"] },
    ],
  },
  {
    label: "Valuation",
    description: "Base para avaliar se o risco está sendo remunerado.",
    fields: [
      { label: "P/VP", paths: ["pvp", "p_vp", "pvpa", "priceToBook", "valuation.pvp"], critical: true },
      { label: "valor patrimonial por cota", paths: ["valorPatrimonialPorCota", "vpCota", "vpa", "bookValuePerShare", "valuation.vpCota"], critical: true },
      { label: "patrimônio líquido", paths: ["patrimonioLiquido", "patrimony", "netWorth", "equityValue", "equity", "patrimonio", "valuation.netWorth"], critical: true },
      { label: "DY 12m", paths: ["dividendYield", "dy", "DY", "dy12m", "dividendYield12m", "valuation.dy12m", "valuation.dy12mCalculated", "dy12mCalculated"], critical: true },
      { label: "DY 6m", paths: ["dy6m", "dividendYield6m", "valuation.dy6m", "valuation.dy6mAnnualized"] },
      { label: "DY médio histórico", paths: ["dyAverage12m", "dyMedio12m", "dyAverage24m", "dyMedio24m", "valuation.dyAverage12m"] },
      { label: "mínima 12m", paths: ["priceMin12m", "precoMin12m", "valuation.priceMin12m"] },
      { label: "máxima 12m", paths: ["priceMax12m", "precoMax12m", "valuation.priceMax12m"] },
    ],
  },
  {
    label: "Dividendos",
    description: "Base para estimar renda, recorrência e risco de corte.",
    fields: [
      { label: "histórico anual de dividendos", paths: ["earnings2026", "earnings2025", "earnings2024", "dividends", "dividendHistory", "dividendsLast12Months", "dividends.dividendsLast12Months"], critical: true },
      { label: "último dividendo", paths: ["lastDividend", "ultimoRendimento", "dividends.lastDividend"], critical: true },
      { label: "data do último pagamento", paths: ["lastDividendDate", "ultimaDataPagamento", "dividends.lastDividendDate"], critical: true },
      { label: "média 12m", paths: ["averageDividend12m", "mediaDividendos12m", "dividends.average12m"], critical: true },
      { label: "meses pagos 12m", paths: ["monthsPaidLast12", "mesesPagos12m", "dividends.monthsPaidLast12"] },
      { label: "volatilidade dos dividendos", paths: ["dividendVolatility12m", "volatilidadeDividendos12m", "dividends.volatility12m"] },
      { label: "cortes de dividendos", paths: ["dividendCuts12m", "cortesDividendos12m", "dividends.cuts12m"] },
    ],
  },
  {
    label: "Governança e estrutura",
    description: "Base para avaliar qualidade da gestão, custos e risco operacional.",
    fields: [
      { label: "gestor", paths: ["manager", "gestor", "management"], critical: true },
      { label: "administrador", paths: ["administrator", "administrador"], critical: true },
      { label: "CNPJ", paths: ["fundCnpj", "cnpj", "CNPJ"], critical: true },
      { label: "razão social", paths: ["socialReason", "razaoSocial", "razao_social", "name"] },
      { label: "site", paths: ["site", "website"] },
      { label: "taxa de administração/gestão", paths: ["managementFee", "administrationFee", "taxaGestao", "taxaAdministracao", "fees.management"] },
      { label: "taxa de performance", paths: ["performanceFee", "taxaPerformance", "fees.performance"] },
      { label: "data de início", paths: ["inceptionDate", "dataInicio", "startDate"] },
      { label: "relatório gerencial", paths: ["hrefReport", "lastManagementReportUrl", "managementReportUrl", "reports.management", "lastReportUrl"] },
      { label: "fatos relevantes", paths: ["materialFacts", "fatosRelevantes", "documents.materialFacts"] },
    ],
  },
  {
    label: "Crédito, agro e infra",
    description: "Base para avaliar CRIs, CRAs, Fiagros, FI-Infra e fundos de papel.",
    fields: [
      { label: "indexadores", paths: ["indexersBreakdown", "indexers", "indexador", "indexadores", "credit.indexers"], critical: true },
      { label: "duration", paths: ["duration", "durationYears", "credit.duration"], critical: true },
      { label: "LTV médio", paths: ["averageLTV", "ltv", "ltvMedio", "credit.averageLTV"], critical: true },
      { label: "devedores", paths: ["topDebtors", "devedores", "credit.topDebtors"], critical: true },
      { label: "garantias", paths: ["guarantees", "garantias", "credit.guarantees"], critical: true },
      { label: "inadimplência", paths: ["delinquency", "inadimplencia", "credit.delinquency"], critical: true },
      { label: "ratings", paths: ["ratings", "rating", "credit.ratings"] },
      { label: "cronograma de vencimentos", paths: ["maturitySchedule", "vencimentos", "credit.maturitySchedule"] },
      { label: "subordinação", paths: ["subordination", "subordinacao", "credit.subordination"] },
    ],
  },
  {
    label: "Tijolo e operação imobiliária",
    description: "Base para avaliar vacância, contratos, imóveis, locatários e qualidade operacional.",
    fields: [
      { label: "vacância", paths: ["vacancy", "vacancia", "realEstate.vacancy"], critical: true },
      { label: "vacância física", paths: ["physicalVacancy", "vacanciaFisica", "realEstate.physicalVacancy"] },
      { label: "vacância financeira", paths: ["financialVacancy", "vacanciaFinanceira", "realEstate.financialVacancy"] },
      { label: "ocupação", paths: ["occupancy", "ocupacao", "realEstate.occupancy"] },
      { label: "quantidade de imóveis", paths: ["assetCount", "numeroImoveis", "realEstate.assetCount"], critical: true },
      { label: "principais imóveis", paths: ["mainAssets", "assets", "imoveis", "realEstate.mainAssets"] },
      { label: "principais inquilinos", paths: ["topTenants", "inquilinos", "realEstate.topTenants"], critical: true },
      { label: "concentração de inquilinos", paths: ["topTenantConcentration", "concentracaoInquilinos", "realEstate.topTenantConcentration"] },
      { label: "vencimento dos contratos", paths: ["leaseExpirationSchedule", "vencimentoContratos", "realEstate.leaseExpirationSchedule"] },
      { label: "SSS", paths: ["sameStoreSales", "sss", "realEstate.sameStoreSales"] },
      { label: "SSR", paths: ["sameStoreRent", "ssr", "realEstate.sameStoreRent"] },
      { label: "NOI/FFO", paths: ["noi", "ffo", "realEstate.noi", "realEstate.ffo"] },
    ],
  },
];

function allowedSecrets() {
  return [process.env.ADMIN_UPDATE_SECRET, process.env.CRON_SECRET].filter(Boolean);
}

function isAuthorized(req: NextRequest, body?: any) {
  const secrets = allowedSecrets();
  if (!secrets.length) return false;

  const authHeader = req.headers.get("authorization") || "";
  const headerSecret = req.headers.get("x-admin-secret") || authHeader.replace(/^Bearer\s+/i, "");
  const querySecret = req.nextUrl.searchParams.get("secret");
  const bodySecret = body?.secret;

  return [headerSecret, querySecret, bodySecret].some((value) => Boolean(value && secrets.includes(value)));
}

function currentDateKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function tickerOf(id: string, data: any) {
  return String(data?.code || data?.ticker || data?.symbol || id || "").trim().toUpperCase();
}

function valueAtPath(data: any, path: string) {
  return path.split(".").reduce((current, key) => current?.[key], data);
}

function hasValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return Boolean(value);
}

function hasAnyPath(data: any, paths: string[]) {
  return paths.some((path) => hasValue(valueAtPath(data, path)));
}

function collectPaths(value: any, prefix = "", output = new Map<string, number>(), depth = 0) {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 4) return output;

  Object.entries(value).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    output.set(path, (output.get(path) || 0) + 1);
    collectPaths(child, path, output, depth + 1);
  });

  return output;
}

function percent(value: number, total: number) {
  return total ? Number(((value / total) * 100).toFixed(1)) : 0;
}

function toSortedFieldList(paths: Map<string, number>, total: number) {
  return Array.from(paths.entries())
    .map(([path, count]) => ({ path, count, coverage: percent(count, total) }))
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
}

function calculateTickerScores(docs: Array<{ id: string; data: any }>, onlyCore = false) {
  return docs.map((doc) => {
    const ticker = tickerOf(doc.id, doc.data);
    let checks = 0;
    let present = 0;
    const criticalMissing: string[] = [];

    GROUPS.forEach((group) => {
      if (onlyCore && TYPE_SPECIFIC_GROUPS.has(group.label)) return;

      group.fields.filter((field) => field.critical).forEach((field) => {
        checks += 1;
        if (hasAnyPath(doc.data, field.paths)) present += 1;
        else criticalMissing.push(`${group.label}: ${field.label}`);
      });
    });

    return {
      ticker,
      score: percent(present, checks),
      criticalMissing: criticalMissing.slice(0, 20),
    };
  });
}

function auditDocs(docs: Array<{ id: string; data: any }>) {
  const total = docs.length;
  const allFieldPaths = new Map<string, number>();

  docs.forEach((doc) => collectPaths(doc.data, "", allFieldPaths));

  const groups = GROUPS.map((group) => {
    const fields = group.fields.map((field) => {
      const presentTickers: string[] = [];
      const missingTickers: string[] = [];

      docs.forEach((doc) => {
        const ticker = tickerOf(doc.id, doc.data);
        if (hasAnyPath(doc.data, field.paths)) presentTickers.push(ticker);
        else missingTickers.push(ticker);
      });

      return {
        label: field.label,
        critical: Boolean(field.critical),
        paths: field.paths,
        present: presentTickers.length,
        missing: missingTickers.length,
        coverage: percent(presentTickers.length, total),
        missingSample: missingTickers.slice(0, 30),
      };
    });

    const criticalFields = fields.filter((field) => field.critical);
    const requiredFields = criticalFields.length ? criticalFields : fields;
    const groupCoverage = requiredFields.length
      ? Number((requiredFields.reduce((sum, field) => sum + field.coverage, 0) / requiredFields.length).toFixed(1))
      : 0;

    return {
      label: group.label,
      description: group.description,
      typeSpecific: TYPE_SPECIFIC_GROUPS.has(group.label),
      coverage: groupCoverage,
      fields,
    };
  });

  const tickerScores = calculateTickerScores(docs, false);
  const coreTickerScores = calculateTickerScores(docs, true);
  const worstTickers = [...tickerScores]
    .sort((a, b) => a.score - b.score || a.ticker.localeCompare(b.ticker))
    .slice(0, 50);
  const bestTickers = [...tickerScores]
    .sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker))
    .slice(0, 30);

  const missingPriority = groups.flatMap((group) => group.fields
    .filter((field) => field.critical && field.coverage < 90)
    .map((field) => ({
      group: group.label,
      field: field.label,
      coverage: field.coverage,
      missing: field.missing,
      missingSample: field.missingSample,
    })))
    .sort((a, b) => a.coverage - b.coverage || b.missing - a.missing);

  const coreMissingPriority = missingPriority.filter((item) => !TYPE_SPECIFIC_GROUPS.has(item.group));

  return {
    generatedAt: new Date().toISOString(),
    date: currentDateKey(),
    totalFiis: total,
    overallCriticalCoverage: Number((tickerScores.reduce((sum, item) => sum + item.score, 0) / Math.max(tickerScores.length, 1)).toFixed(1)),
    coreCriticalCoverage: Number((coreTickerScores.reduce((sum, item) => sum + item.score, 0) / Math.max(coreTickerScores.length, 1)).toFixed(1)),
    groups,
    missingPriority,
    coreMissingPriority,
    bestTickers,
    worstTickers,
    fieldPaths: toSortedFieldList(allFieldPaths, total).slice(0, 350),
  };
}

async function runAudit(limit: number) {
  const snapshot = await adminDb.collection(COLLECTION).limit(limit).get();
  const docs = snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() || {} }));
  const audit = auditDocs(docs);

  await adminDb.collection(AUDIT_COLLECTION).doc("latest").set({
    ...audit,
    updatedAt: adminFieldValue.serverTimestamp(),
  }, { merge: true });

  await adminDb.collection(AUDIT_COLLECTION).doc(audit.date).set({
    ...audit,
    updatedAt: adminFieldValue.serverTimestamp(),
  }, { merge: true });

  return audit;
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });

    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 1000), 3000);
    const audit = await runAudit(limit);
    return NextResponse.json({ ok: true, audit });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao auditar base de FIIs." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    if (!isAuthorized(req, body)) return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });

    const limit = Math.min(Number(body?.limit || 1000), 3000);
    const audit = await runAudit(limit);
    return NextResponse.json({ ok: true, audit });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao auditar base de FIIs." }, { status: 500 });
  }
}
