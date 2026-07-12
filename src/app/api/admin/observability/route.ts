import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { OBSERVABILITY_COLLECTION_NAME } from "@/lib/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminSecrets() {
  return [process.env.ADMIN_UPDATE_SECRET, process.env.CRON_SECRET].filter(Boolean);
}

function canRead(req: NextRequest, body?: any) {
  const secrets = adminSecrets();
  if (!secrets.length) return false;
  const headerSecret = req.headers.get("x-admin-secret") || "";
  const querySecret = req.nextUrl.searchParams.get("secret") || "";
  const bodySecret = body?.secret || "";
  return [headerSecret, querySecret, bodySecret].some((value) => Boolean(value && secrets.includes(value)));
}

function toIso(value: any) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function sampleCollection(name: string) {
  try {
    const snapshot = await adminDb.collection(name).limit(1).get();
    return { ok: true, hasSample: !snapshot.empty, sampleId: snapshot.docs[0]?.id || null };
  } catch (err: any) {
    return { ok: false, hasSample: false, sampleId: null, error: err.message || `Erro ao consultar ${name}` };
  }
}

async function getStats() {
  try {
    const snap = await adminDb.collection("SiteDadosFii").doc("stats").get();
    const data = snap.data() || {};
    return { ok: snap.exists, visits: Number(data.visit || data.visits || 0), searches: Number(data.search || data.searches || 0) };
  } catch (err: any) {
    return { ok: false, visits: 0, searches: 0, error: err.message || "Erro ao consultar estatisticas" };
  }
}

async function getBenchmarks() {
  try {
    const snap = await adminDb.collection("MarketBenchmarks").doc("latest").get();
    const data = snap.data() || {};
    return {
      ok: snap.exists,
      updatedAt: toIso(data.updatedAt),
      date: data.date || null,
      ifix: { ok: Boolean(data?.ifix?.currentReady || data?.ifix?.comparisonReady || data?.ifix?.partialComparisonReady), currentReady: Boolean(data?.ifix?.currentReady), comparisonReady: Boolean(data?.ifix?.comparisonReady), close: data?.ifix?.close ?? null, lastDate: data?.ifix?.lastDate || null, provider: data?.ifix?.provider || null },
      cdi: { ok: Boolean(data?.cdi?.comparisonReady), lastDate: data?.cdi?.lastDate || null },
      ipca: { ok: Boolean(data?.ipca?.comparisonReady), lastDate: data?.ipca?.lastDate || null },
      selic: { ok: Boolean(data?.selic?.comparisonReady), rate: data?.selic?.rate ?? null, date: data?.selic?.date || null },
    };
  } catch (err: any) {
    return { ok: false, error: err.message || "Erro ao consultar benchmarks" };
  }
}

async function getReports() {
  try {
    const snapshot = await adminDb.collection("UserRiskReports").orderBy("updatedAt", "desc").limit(50).get();
    const reports = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) } as any));
    return {
      ok: true,
      totalSample: reports.length,
      done: reports.filter((report) => report.status === "done").length,
      pending: reports.filter((report) => ["pending", "processing", "running"].includes(String(report.status))).length,
      failed: reports.filter((report) => ["error", "failed"].includes(String(report.status))).length,
      latest: reports[0] ? { id: reports[0].id, status: reports[0].status || null, month: reports[0].month || null, updatedAt: toIso(reports[0].updatedAt) || reports[0].generatedAt || null } : null,
    };
  } catch (err: any) {
    return { ok: false, totalSample: 0, done: 0, pending: 0, failed: 0, error: err.message || "Erro ao consultar relatorios" };
  }
}

async function getPortfolioNotifications() {
  try {
    const snapshot = await adminDb.collection("PortfolioNotificationRuns").orderBy("createdAt", "desc").limit(20).get();
    const runs = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      const summary = data.summary || {};
      return {
        id: doc.id,
        ok: data.ok !== false && Number(summary.error || 0) === 0,
        dateKey: data.dateKey || null,
        totalUsersRead: Number(data.totalUsersRead || 0),
        durationMs: Number(data.durationMs || 0),
        processed: Number(summary.processed || 0),
        skipped: Number(summary.skipped || 0),
        errors: Number(summary.error || 0),
        freeUsers: Number(summary.freeUsers || 0),
        vipUsers: Number(summary.vipUsers || 0),
        notificationsCreated: Number(summary.notificationsCreated || 0),
        emailsSent: Number(summary.emailsSent || 0),
        digestsSent: Number(summary.digestsSent || 0),
        createdAt: toIso(data.createdAt),
      };
    });

    const totals = runs.reduce((acc, run) => {
      acc.totalUsersRead += run.totalUsersRead;
      acc.processed += run.processed;
      acc.skipped += run.skipped;
      acc.errors += run.errors;
      acc.freeUsers += run.freeUsers;
      acc.vipUsers += run.vipUsers;
      acc.notificationsCreated += run.notificationsCreated;
      acc.emailsSent += run.emailsSent;
      acc.digestsSent += run.digestsSent;
      return acc;
    }, { totalUsersRead: 0, processed: 0, skipped: 0, errors: 0, freeUsers: 0, vipUsers: 0, notificationsCreated: 0, emailsSent: 0, digestsSent: 0 });

    return {
      ok: true,
      hasRuns: runs.length > 0,
      totalRuns: runs.length,
      ...totals,
      latest: runs[0] || null,
      recent: runs.slice(0, 10),
    };
  } catch (err: any) {
    return {
      ok: false,
      hasRuns: false,
      totalRuns: 0,
      totalUsersRead: 0,
      processed: 0,
      skipped: 0,
      errors: 0,
      freeUsers: 0,
      vipUsers: 0,
      notificationsCreated: 0,
      emailsSent: 0,
      digestsSent: 0,
      recent: [],
      error: err.message || "Erro ao consultar notificações da carteira",
    };
  }
}

function summarizeLookups(events: any[]) {
  const lookupEvents = events.filter((event) => event.type === "fii_lookup");
  const success = lookupEvents.filter((event) => event.ok === true && Number(event.statusCode) < 400).length;
  const errors = lookupEvents.filter((event) => Number(event.statusCode) >= 400).length;
  const total = lookupEvents.length;
  const byTicker = new Map<string, any>();
  const errorByStatus = new Map<number, { statusCode: number; count: number }>();

  lookupEvents.forEach((event) => {
    const statusCode = Number(event.statusCode || 0);
    const ticker = String(event.ticker || "SEM TICKER").toUpperCase();
    const current = byTicker.get(ticker) || { ticker, total: 0, success: 0, errors: 0, lastStatusCode: statusCode, lastAt: event.createdAt || null };
    current.total += 1;
    if (event.ok && statusCode < 400) current.success += 1;
    else {
      current.errors += 1;
      const currentStatus = errorByStatus.get(statusCode) || { statusCode, count: 0 };
      currentStatus.count += 1;
      errorByStatus.set(statusCode, currentStatus);
    }
    current.lastStatusCode = statusCode || current.lastStatusCode || 0;
    current.lastAt = current.lastAt || event.createdAt || null;
    byTicker.set(ticker, current);
  });

  const errorBreakdown = Array.from(errorByStatus.values()).sort((a, b) => b.count - a.count || a.statusCode - b.statusCode);
  const errorSummary = errorBreakdown.length ? errorBreakdown.map((item) => `${item.count} erro(s) ${item.statusCode}`).join(" · ") : "Nenhum erro nas consultas recentes";

  return {
    total,
    success,
    errors,
    errorBreakdown,
    errorSummary,
    successRate: total ? Math.round((success / total) * 100) : 0,
    recent: lookupEvents.slice(0, 10),
    byTicker: Array.from(byTicker.values()).sort((a, b) => b.total - a.total).slice(0, 12),
  };
}

async function getEvents() {
  try {
    const snapshot = await adminDb.collection(OBSERVABILITY_COLLECTION_NAME).orderBy("createdAt", "desc").limit(100).get();
    return snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      return { id: doc.id, type: data.type || "unknown", ok: Boolean(data.ok), statusCode: Number(data.statusCode || 0), ticker: data.ticker || null, tickers: Array.isArray(data.tickers) ? data.tickers : [], message: data.message || null, error: data.error || null, source: data.source || null, createdAt: toIso(data.createdAt) || data.createdAtIso || null };
    });
  } catch (err: any) {
    return [{ id: "observability-error", type: "system", ok: false, statusCode: 500, ticker: null, tickers: [], message: null, error: err.message || "Erro ao consultar eventos", source: "observability", createdAt: new Date().toISOString() }];
  }
}

async function payload() {
  const [fiis, userReports, walletSessions, benchmarks, traffic, reports, portfolioNotifications, events] = await Promise.all([sampleCollection("Fiis"), sampleCollection("UserRiskReports"), sampleCollection("WalletSessions"), getBenchmarks(), getStats(), getReports(), getPortfolioNotifications(), getEvents()]);
  const lookups = summarizeLookups(events);
  const services = [
    { key: "fiis", label: "Base de FIIs", ok: fiis.ok && fiis.hasSample, detail: fiis.hasSample ? `Amostra: ${fiis.sampleId}` : "Sem amostra" },
    { key: "reports", label: "Relatorios", ok: userReports.ok && userReports.hasSample, detail: userReports.hasSample ? "Relatorios encontrados" : "Nenhum relatorio" },
    { key: "sessions", label: "Sessoes de carteira", ok: walletSessions.ok && walletSessions.hasSample, detail: walletSessions.hasSample ? "Sessoes encontradas" : "Nenhuma sessao" },
    { key: "portfolioNotifications", label: "Notificações da carteira", ok: Boolean(portfolioNotifications.ok), detail: portfolioNotifications.hasRuns ? `${portfolioNotifications.totalRuns} execução(ões) recente(s) · ${portfolioNotifications.emailsSent} e-mail(s)` : "Aguardando primeira execução" },
    { key: "ifix", label: "IFIX", ok: Boolean(benchmarks?.ifix?.ok), detail: benchmarks?.ifix?.currentReady ? `Fechamento ${benchmarks.ifix.close} em ${benchmarks.ifix.lastDate}` : "Indisponivel" },
    { key: "cdi", label: "CDI", ok: Boolean(benchmarks?.cdi?.ok), detail: benchmarks?.cdi?.lastDate ? `Atualizado em ${benchmarks.cdi.lastDate}` : "Indisponivel" },
    { key: "ipca", label: "IPCA", ok: Boolean(benchmarks?.ipca?.ok), detail: benchmarks?.ipca?.lastDate ? `Ultimo dado ${benchmarks.ipca.lastDate}` : "Indisponivel" },
    { key: "selic", label: "Selic", ok: Boolean(benchmarks?.selic?.ok), detail: benchmarks?.selic?.rate ? `${benchmarks.selic.rate}% em ${benchmarks.selic.date}` : "Indisponivel" },
  ];
  const healthy = services.filter((service) => service.ok).length;
  return { ok: services.every((service) => service.ok), generatedAt: new Date().toISOString(), health: { score: Math.round((healthy / services.length) * 100), healthyServices: healthy, totalServices: services.length, services }, traffic, lookups, reports, portfolioNotifications, benchmarks, collections: { fiis, userReports, walletSessions }, recentEvents: events.slice(0, 20) };
}

function json(data: unknown, status = 200) {
  return new NextResponse(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function GET(req: NextRequest) {
  if (!canRead(req)) return json({ ok: false, error: "Nao autorizado." }, 401);
  return json(await payload());
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!canRead(req, body)) return json({ ok: false, error: "Nao autorizado." }, 401);
  return json(await payload());
}
