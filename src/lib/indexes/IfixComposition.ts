import type { IfixComposition, IndexMembership } from "@/types/indexes";

export const IFIX_SOURCE_URL = "https://sistemaswebb3-listados.b3.com.br/indexPage/day/IFIX?language=pt-br";
const IFIX_API_BASE = "https://sistemaswebb3-listados.b3.com.br/indexProxy/indexCall/GetPortfolioDay/";

type B3Payload = {
  header?: { date?: string };
  page?: { totalRecords?: number };
  results?: Array<{ cod?: string; asset?: string; part?: string }>;
};

function numberPt(value: unknown) {
  const parsed = Number(String(value || "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(value: unknown) {
  const [day, month, rawYear] = String(value || "").split("/").map(Number);
  if (!day || !month || !rawYear) return null;
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function parseIfixComposition(payload: B3Payload, fetchedAt = new Date().toISOString()): IfixComposition {
  const referenceDate = isoDate(payload.header?.date);
  const constituents = (payload.results || []).flatMap((item) => {
    const ticker = String(item.cod || "").trim().toUpperCase();
    if (!/^[A-Z]{4}\d{2}$/.test(ticker)) return [];
    return [{ ticker, asset: String(item.asset || "").trim(), weightPercent: numberPt(item.part) }];
  });
  if (!referenceDate || !constituents.length) throw new Error("A B3 retornou uma composição IFIX inválida.");
  const declaredTotal = Number(payload.page?.totalRecords || constituents.length);
  if (declaredTotal > constituents.length) throw new Error("A composição IFIX retornada pela B3 está incompleta.");
  return { index: "IFIX", referenceDate, fetchedAt, source: IFIX_SOURCE_URL, total: constituents.length, constituents };
}

export async function fetchIfixComposition(fetcher: typeof fetch = fetch) {
  const request = Buffer.from(JSON.stringify({ language: "pt-br", pageNumber: 1, pageSize: 200, index: "IFIX", segment: "1" })).toString("base64");
  const response = await fetcher(`${IFIX_API_BASE}${request}`, { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`B3 IFIX HTTP ${response.status}`);
  return parseIfixComposition(await response.json() as B3Payload);
}

export function ifixMembership(ticker: string, fundKind: string, composition: IfixComposition | null): IndexMembership {
  if (String(fundKind).toUpperCase() !== "FII") return { status: "not_applicable", weightPercent: null, referenceDate: composition?.referenceDate || null, source: composition?.source || null };
  if (!composition) return { status: "unknown", weightPercent: null, referenceDate: null, source: null };
  const item = composition.constituents.find((entry) => entry.ticker === ticker.toUpperCase());
  return { status: item ? "member" : "not_member", weightPercent: item?.weightPercent ?? null, referenceDate: composition.referenceDate, source: composition.source };
}
