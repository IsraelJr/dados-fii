// Controlador de aplicação; o Route Handler permanece sem acesso à persistência.
import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { deriveFiiRiskData } from "@/lib/fiiDerivedData";
import { internalAuthError, requireAdminOrCron } from "@/lib/security/InternalRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION = "Fiis";
const AUDIT_COLLECTION = "FiiDataAudits";
const TIME_ZONE = "America/Sao_Paulo";

const GROUPS = [
  {
    label: "Identificação e classificação",
    fields: [
      { label: "ticker", paths: ["code", "ticker", "symbol"], critical: true },
      { label: "nome", paths: ["name", "nome", "shortName", "razaoSocial", "razao_social", "socialReason"] },
      { label: "segmento", paths: ["segment", "segment_new", "segmento"], critical: true },
      { label: "setor", paths: ["sector", "setor"], critical: true },
      { label: "tipo de fundo", paths: ["fundType", "type", "tipo", "tipoFundo"], critical: true },
      { label: "IFIX", paths: ["isIFIX", "ifix", "marketData.isIFIX"] },
    ],
  },
  {
    label: "Mercado e liquidez",
    fields: [
      { label: "preço atual", paths: ["price", "currentPrice", "cotacao", "marketData.price"], critical: true },
      { label: "liquidez diária", paths: ["dailyLiquidity", "liquidity", "averageDailyLiquidity", "avgDailyLiquidity", "volumeMedioDiario", "liquidezDiaria", "marketData.dailyLiquidity", "marketData.liquidity"], critical: true },
      { label: "cotas emitidas", paths: ["numberShares", "sharesOutstanding", "numberOfShares", "quotasIssued", "issuedQuotas", "cotasEmitidas", "numeroCotas", "marketData.numberShares"], critical: true },
      { label: "cotistas", paths: ["numberCotistas", "numberShareholders", "shareholders", "shareholdersCount", "cotistas", "numeroCotistas", "investorsCount", "marketData.numberCotistas", "marketData.numberShareholders"], critical: true },
      { label: "valor de mercado", paths: ["marketCap", "valorMercado", "marketData.marketCap"], critical: true },
    ],
  },
  {
    label: "Valuation",
    fields: [
      { label: "P/VP", paths: ["pvp", "p_vp", "pvpa", "priceToBook", "valuation.pvp"], critical: true },
      { label: "valor patrimonial por cota", paths: ["valorPatrimonialPorCota", "vpCota", "vpa", "bookValuePerShare", "valuation.vpCota"], critical: true },
      { label: "patrimônio líquido", paths: ["patrimonioLiquido", "patrimony", "netWorth", "equityValue", "equity", "patrimonio", "valuation.netWorth"], critical: true },
      { label: "DY 12m", paths: ["dividendYield", "dy", "DY", "dy12m", "dividendYield12m", "valuation.dy12m", "valuation.dy12mCalculated", "dy12mCalculated"], critical: true },
      { label: "DY 6m", paths: ["dy6m", "dividendYield6m", "valuation.dy6m", "valuation.dy6mAnnualized"] },
    ],
  },
  {
    label: "Dividendos",
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
    fields: [
      { label: "gestor", paths: ["manager", "gestor", "management"], critical: true },
      { label: "administrador", paths: ["administrator", "administrador"], critical: true },
      { label: "CNPJ", paths: ["fundCnpj", "cnpj", "CNPJ"], critical: true },
      { label: "relatório gerencial", paths: ["hrefReport", "lastManagementReportUrl", "managementReportUrl", "reports.management", "lastReportUrl"] },
    ],
  },
];

function currentDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
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

function percent(value: number, total: number) {
  return total ? Number(((value / total) * 100).toFixed(1)) : 0;
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

function sortedFieldPaths(paths: Map<string, number>, total: number) {
  return Array.from(paths.entries())
    .map(([path, count]) => ({ path, count, coverage: percent(count, total) }))
    .sort((a, b) => b.count - a.count || a.path.localeCompare(b.path))
    .slice(0, 250);
}

function parseLimit(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function wantsTextDownload(req: NextRequest, body?: any) {
  const format = String(req.nextUrl.searchParams.get("format") || body?.format || "").toLowerCase();
  const download = String(req.nextUrl.searchParams.get("download") || body?.download || "").toLowerCase();
  return format === "txt" || format === "text" || download === "true" || download === "1";
}

function textDownloadResponse(filename: string, payload: unknown) {
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

async function getFiisSnapshot(limit?: number): Promise<{ docs: any[] }> {
  let query: any = adminDb.collection(COLLECTION);
  if (limit) query = query.limit(limit);
  return query.get();
}

function auditDocs(docs: Array<{ id: string; data: any }>, calculationAsOf: Date) {
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
    return {
      label: group.label,
      coverage: criticalFields.length ? Number((criticalFields.reduce((sum, field) => sum + field.coverage, 0) / criticalFields.length).toFixed(1)) : 0,
      fields,
    };
  });

  const criticalChecks = groups.flatMap((group) => group.fields.filter((field) => field.critical));
  const coreCriticalCoverage = criticalChecks.length
    ? Number((criticalChecks.reduce((sum, field) => sum + field.coverage, 0) / criticalChecks.length).toFixed(1))
    : 0;
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

  return {
    generatedAt: calculationAsOf.toISOString(),
    date: currentDateKey(calculationAsOf),
    mode: "derived-preview",
    note: "Auditoria simulando os campos derivados sem depender de já estarem gravados na coleção Fiis.",
    totalFiis: total,
    coreCriticalCoverage,
    groups,
    missingPriority,
    fieldPaths: sortedFieldPaths(allFieldPaths, total),
  };
}

async function runAudit(limit?: number) {
  const calculationAsOf = new Date();
  const snapshot = await getFiisSnapshot(limit);
  const docs = snapshot.docs.map((doc: any) => {
    const raw = doc.data() || {};
    return { id: doc.id, data: { ...raw, ...deriveFiiRiskData(raw, { asOf: calculationAsOf }) } };
  });
  const audit = {
    ...auditDocs(docs, calculationAsOf),
    limitApplied: limit || null,
  };

  await adminDb.collection(AUDIT_COLLECTION).doc("latestDerivedPreview").set({
    ...audit,
    updatedAt: adminFieldValue.serverTimestamp(),
  }, { merge: true });

  return audit;
}

export async function GET(req: NextRequest) {
  try {
    const authorization = await requireAdminOrCron(req, { scope: "audit-fii-data-derived" });
    if (!authorization.ok) return internalAuthError(authorization);

    const limit = parseLimit(req.nextUrl.searchParams.get("limit"));
    const audit = await runAudit(limit);
    const payload = { ok: true, audit };

    if (wantsTextDownload(req)) return textDownloadResponse(`audit-fii-data-derived-${audit.date}.txt`, payload);
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Erro ao auditar dados derivados dos FIIs." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authorization = await requireAdminOrCron(req, { scope: "audit-fii-data-derived" });
    if (!authorization.ok) return internalAuthError(authorization);
    const body = await req.json().catch(() => ({}));

    const limit = parseLimit(body?.limit);
    const audit = await runAudit(limit);
    const payload = { ok: true, audit };

    if (wantsTextDownload(req, body)) return textDownloadResponse(`audit-fii-data-derived-${audit.date}.txt`, payload);
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: "Erro ao auditar dados derivados dos FIIs." }, { status: 500 });
  }
}
