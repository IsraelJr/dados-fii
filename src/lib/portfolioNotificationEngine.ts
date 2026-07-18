import { createHash } from "crypto";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { logObservabilityEvent } from "@/lib/observability";
import { regulatoryDataService } from "@/lib/regulatoryDataService";
import { extractUserWallet } from "@/lib/userWallet";
import { paidPlanFromRecord } from "@/lib/productPlans";
import {
  PORTFOLIO_NOTIFICATION_POLICY_VERSION,
  patrimonyThresholdPercent,
  portfolioValueChangeDecision,
} from "@/lib/portfolioNotificationPolicy";

const TIME_ZONE = "America/Sao_Paulo";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DEFAULT_FREE_LIMIT = 3;
const RISK_ENGINE_VERSION = 2;
const RISK_ACTIVATION_BUFFER_PERCENT = 1;
const RISK_RESOLUTION_BUFFER_PERCENT = 1;

type WalletItem = { ticker: string; quotas: number };
type DividendRecord = {
  year: number;
  month: string;
  monthIndex: number;
  sortIndex: number;
  earnings: number;
  paymentDate: string;
  dateWith: string;
};
type PortfolioPosition = {
  ticker: string;
  quotas: number;
  data: any;
  price: number;
  segment: string;
  records: DividendRecord[];
  currentDividend: DividendRecord | null;
  previousDividend: DividendRecord | null;
  latestDividend: DividendRecord | null;
  currentValue: number;
  estimatedIncome: number;
  announcedIncome: number;
};
type NotificationSeverity = "info" | "success" | "warning" | "critical";
type NotificationInput = {
  type: string;
  eventKey: string;
  ticker?: string | null;
  title: string;
  message: string;
  severity: NotificationSeverity;
  actionUrl?: string;
  portfolioImpact?: Record<string, unknown>;
  emailSubject?: string;
  emailText?: string;
  emailHtml?: string;
  emailEligible?: boolean;
};
type RiskFlag = {
  id: string;
  type: "asset" | "income" | "segment";
  key: string;
  title: string;
  message: string;
  weight: number;
  threshold: number;
  severity: NotificationSeverity;
  actionUrl: string;
};
type StoredRisk = {
  type: RiskFlag["type"];
  key: string;
  weight: number;
  threshold: number;
};
type QueuedEmailNotification = {
  ref: any;
  input: NotificationInput;
};
type LocalDateParts = {
  year: number;
  month: number;
  dateKey: string;
};

type UserProcessResult = {
  userId: string;
  email?: string;
  status: "processed" | "skipped" | "error";
  reason?: string;
  isVip?: boolean;
  walletCount?: number;
  notificationsCreated?: number;
  emailsSent?: number;
  digestSent?: boolean;
  digestSchedule?: string;
  error?: string;
};

function envNumber(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBoolean(name: string, fallback = true) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (!value) return fallback;
  return !["0", "false", "no", "off"].includes(value);
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseCurrency(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value || "").replace(/[^\d,.-]/g, "").trim();
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function localDateParts(date = new Date()): LocalDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(map.year);
  const month = Number(map.month);
  return { year, month, dateKey: `${map.year}-${map.month}-${map.day}` };
}

function parseBrDate(value: string) {
  const [day, month, year] = String(value || "").split("/").map(Number);
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isVipUser(data: any) {
  return paidPlanFromRecord(data || {}) !== null;
}

function walletFingerprint(wallet: WalletItem[]) {
  return hash(JSON.stringify([...wallet]
    .sort((left, right) => left.ticker.localeCompare(right.ticker))
    .map((item) => ({ ticker: item.ticker, quotas: item.quotas }))));
}

async function loadFiiMap(tickers: string[]) {
  const unique = Array.from(new Set(tickers.map((ticker) => String(ticker || "").trim().toUpperCase()).filter(Boolean)));
  const map = new Map<string, any>();
  if (!unique.length) return map;

  const result = await regulatoryDataService.getMany(unique, 120);
  Object.entries(result.items).forEach(([ticker, data]) => map.set(ticker, data));
  return map;
}
function collectDividendRecords(data: any, currentYear: number) {
  const records: DividendRecord[] = [];

  for (const year of [currentYear - 1, currentYear, currentYear + 1]) {
    const yearData = data?.[`earnings${year}`] || {};
    Object.entries(yearData).forEach(([month, rawInfo]: [string, any]) => {
      const monthIndex = MONTHS.indexOf(month);
      if (monthIndex < 0) return;
      const earnings = parseCurrency(rawInfo?.earnings);
      if (earnings <= 0) return;
      records.push({
        year,
        month,
        monthIndex,
        sortIndex: year * 12 + monthIndex,
        earnings,
        paymentDate: String(rawInfo?.payment_date || ""),
        dateWith: String(rawInfo?.date_with || ""),
      });
    });
  }

  return records.sort((a, b) => a.sortIndex - b.sortIndex);
}

function buildPositions(wallet: WalletItem[], fiiMap: Map<string, any>, now: LocalDateParts) {
  const currentSortIndex = now.year * 12 + (now.month - 1);

  return wallet.reduce<PortfolioPosition[]>((acc, item) => {
    const data = fiiMap.get(item.ticker);
    if (!data) return acc;

    const records = collectDividendRecords(data, now.year);
    const currentDividend = records.find((record) => record.year === now.year && record.monthIndex === now.month - 1) || null;
    const previousDividend = currentDividend
      ? [...records].reverse().find((record) => record.sortIndex < currentDividend.sortIndex) || null
      : null;
    const latestDividend = [...records].reverse().find((record) => record.sortIndex <= currentSortIndex) || null;
    const price = parseCurrency(data?.price);
    const currentValue = price * item.quotas;
    const estimatedIncome = (latestDividend?.earnings || 0) * item.quotas;
    const announcedIncome = (currentDividend?.earnings || 0) * item.quotas;

    acc.push({
      ticker: item.ticker,
      quotas: item.quotas,
      data,
      price,
      segment: String(data?.segment_new || data?.segment || "Sem segmento").trim() || "Sem segmento",
      records,
      currentDividend,
      previousDividend,
      latestDividend,
      currentValue,
      estimatedIncome,
      announcedIncome,
    });
    return acc;
  }, []);
}

function severityForWeight(weight: number): NotificationSeverity {
  if (weight >= 60) return "critical";
  if (weight >= 40) return "warning";
  return "info";
}

function riskThresholds(isVip: boolean) {
  return {
    asset: isVip ? envNumber("VIP_ASSET_CONCENTRATION_THRESHOLD", 30) : envNumber("FREE_ASSET_CONCENTRATION_THRESHOLD", 40),
    income: envNumber("VIP_INCOME_CONCENTRATION_THRESHOLD", 45),
    segment: envNumber("VIP_SEGMENT_CONCENTRATION_THRESHOLD", 60),
  };
}

function riskStableKey(type: RiskFlag["type"], key: string) {
  return `${type}:${key}`;
}

function riskConfigurationFingerprint(isVip: boolean) {
  const thresholds = riskThresholds(isVip);
  return hash(JSON.stringify({ version: RISK_ENGINE_VERSION, plan: isVip ? "vip" : "free", thresholds }));
}

function parseLegacyRiskState(ids: unknown[]): Record<string, StoredRisk> {
  return ids.reduce<Record<string, StoredRisk>>((acc, rawId) => {
    const id = String(rawId || "");
    const firstSeparator = id.indexOf(":");
    const lastSeparator = id.lastIndexOf(":");
    if (firstSeparator <= 0 || lastSeparator <= firstSeparator) return acc;
    const type = id.slice(0, firstSeparator) as RiskFlag["type"];
    const key = id.slice(firstSeparator + 1, lastSeparator);
    const threshold = Number(id.slice(lastSeparator + 1));
    if (!(["asset", "income", "segment"] as string[]).includes(type) || !key || !Number.isFinite(threshold)) return acc;
    acc[riskStableKey(type, key)] = { type, key, threshold, weight: threshold };
    return acc;
  }, {});
}

function storedRiskState(state: any): Record<string, StoredRisk> {
  if (state?.riskState && typeof state.riskState === "object" && !Array.isArray(state.riskState)) {
    return Object.fromEntries(Object.entries(state.riskState).flatMap(([stableKey, raw]) => {
      const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
      const type = String(item.type || "") as RiskFlag["type"];
      const key = String(item.key || "");
      const weight = Number(item.weight);
      const threshold = Number(item.threshold);
      if (!(["asset", "income", "segment"] as string[]).includes(type) || !key || !Number.isFinite(weight) || !Number.isFinite(threshold)) return [];
      return [[stableKey, { type, key, weight, threshold } satisfies StoredRisk]];
    }));
  }
  return parseLegacyRiskState(Array.isArray(state?.riskFlags) ? state.riskFlags : []);
}

function buildRiskWeights(positions: PortfolioPosition[], isVip: boolean) {
  const weights: Record<string, number> = {};
  const totalValue = positions.reduce((sum, item) => sum + item.currentValue, 0);
  const totalIncome = positions.reduce((sum, item) => sum + item.estimatedIncome, 0);

  positions.forEach((item) => {
    weights[riskStableKey("asset", item.ticker)] = totalValue > 0 ? (item.currentValue / totalValue) * 100 : 0;
    if (isVip && totalIncome > 0) weights[riskStableKey("income", item.ticker)] = (item.estimatedIncome / totalIncome) * 100;
  });

  if (isVip && totalValue > 0) {
    const bySegment = new Map<string, number>();
    positions.forEach((item) => bySegment.set(item.segment, (bySegment.get(item.segment) || 0) + item.currentValue));
    bySegment.forEach((value, segment) => {
      weights[riskStableKey("segment", segment)] = (value / totalValue) * 100;
    });
  }

  return weights;
}

function buildRiskFlags(positions: PortfolioPosition[], isVip: boolean) {
  const flags: RiskFlag[] = [];
  const totalValue = positions.reduce((sum, item) => sum + item.currentValue, 0);
  const totalIncome = positions.reduce((sum, item) => sum + item.estimatedIncome, 0);
  const { asset: assetThreshold, income: incomeThreshold, segment: segmentThreshold } = riskThresholds(isVip);

  const assetCandidates = positions
    .map((item) => ({ item, weight: totalValue > 0 ? (item.currentValue / totalValue) * 100 : 0 }))
    .filter(({ weight }) => weight >= assetThreshold + RISK_ACTIVATION_BUFFER_PERCENT)
    .sort((a, b) => b.weight - a.weight);

  (isVip ? assetCandidates.slice(0, 3) : assetCandidates.slice(0, 1)).forEach(({ item, weight }) => {
    flags.push({
      id: `asset:${item.ticker}:${assetThreshold}`,
      type: "asset",
      key: item.ticker,
      title: `Concentração elevada em ${item.ticker}`,
      message: `${item.ticker} representa ${formatPercent(weight)} do patrimônio estimado da carteira. O limite de atenção configurado é ${formatPercent(assetThreshold)}.`,
      weight,
      threshold: assetThreshold,
      severity: severityForWeight(weight),
      actionUrl: "/carteira",
    });
  });

  if (isVip && totalIncome > 0) {
    positions
      .map((item) => ({ item, weight: (item.estimatedIncome / totalIncome) * 100 }))
      .filter(({ weight }) => weight >= incomeThreshold + RISK_ACTIVATION_BUFFER_PERCENT)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .forEach(({ item, weight }) => {
        flags.push({
          id: `income:${item.ticker}:${incomeThreshold}`,
          type: "income",
          key: item.ticker,
          title: `Renda concentrada em ${item.ticker}`,
          message: `${item.ticker} responde por ${formatPercent(weight)} da renda mensal estimada da carteira. O limite de atenção configurado é ${formatPercent(incomeThreshold)}.`,
          weight,
          threshold: incomeThreshold,
          severity: severityForWeight(weight),
          actionUrl: "/carteira",
        });
      });
  }

  if (isVip && totalValue > 0) {
    const bySegment = new Map<string, number>();
    positions.forEach((item) => bySegment.set(item.segment, (bySegment.get(item.segment) || 0) + item.currentValue));
    Array.from(bySegment.entries())
      .map(([segment, value]) => ({ segment, weight: (value / totalValue) * 100 }))
      .filter(({ weight }) => weight >= segmentThreshold + RISK_ACTIVATION_BUFFER_PERCENT)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .forEach(({ segment, weight }) => {
        flags.push({
          id: `segment:${segment}:${segmentThreshold}`,
          type: "segment",
          key: segment,
          title: `Concentração elevada em ${segment}`,
          message: `O segmento ${segment} representa ${formatPercent(weight)} do patrimônio estimado da carteira. O limite de atenção configurado é ${formatPercent(segmentThreshold)}.`,
          weight,
          threshold: segmentThreshold,
          severity: severityForWeight(weight),
          actionUrl: "/carteira",
        });
      });
  }

  return flags;
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function baseEmailHtml(title: string, message: string, actionUrl: string, extraHtml = "") {
  const siteUrl = String(process.env.NEXT_PUBLIC_BASE_URL || process.env.SITE_URL || "https://www.dadosfii.com.br").replace(/\/$/, "");
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:640px;margin:0 auto;padding:24px"><div style="background:#111827;color:#fff;border-radius:18px;padding:24px"><p style="margin:0 0 8px;color:#c7d2fe;font-size:12px;font-weight:700;text-transform:uppercase">Dados FII</p><h1 style="margin:0 0 14px;font-size:24px">${escapeHtml(title)}</h1><p style="margin:0;color:#d1d5db;line-height:1.6">${escapeHtml(message).replace(/\n/g, "<br>")}</p></div>${extraHtml}<p style="margin:20px 0 0"><a href="${siteUrl}${actionUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;border-radius:12px;padding:12px 18px">Abrir no Dados FII</a></p><p style="margin:24px 0 0;color:#64748b;font-size:12px;line-height:1.5">Este é um aviso transacional relacionado à carteira salva no Dados FII.</p></div></body></html>`;
}

async function sendEmail(to: string, subject: string, text: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.WALLET_EMAIL_FROM || "Dados FII <no-reply@dadosfii.com.br>";
  if (!apiKey) return { sent: false, provider: "disabled", error: "RESEND_API_KEY não configurada" };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text, html }),
    });
    if (!response.ok) {
      const error = await response.text().catch(() => "");
      return { sent: false, provider: "resend", error: `HTTP ${response.status} ${error}`.trim() };
    }
    return { sent: true, provider: "resend" };
  } catch (err: any) {
    return { sent: false, provider: "resend", error: err.message || "Falha ao enviar e-mail" };
  }
}

async function createNotification(userRef: any, input: NotificationInput) {
  const id = hash(`${input.type}|${input.eventKey}`).slice(0, 48);
  const ref = userRef.collection("Notifications").doc(id);
  let created = false;

  await adminDb.runTransaction(async (transaction) => {
    const snap: any = await transaction.get(ref);
    if (snap.exists) return;
    transaction.set(ref, {
      id,
      type: input.type,
      eventKey: input.eventKey,
      ticker: input.ticker || null,
      title: input.title,
      message: input.message,
      severity: input.severity,
      actionUrl: input.actionUrl || "/carteira",
      portfolioImpact: input.portfolioImpact || null,
      createdAt: adminFieldValue.serverTimestamp(),
      readAt: null,
      dismissedAt: null,
      emailAttemptedAt: null,
      emailSentAt: null,
    });
    created = true;
  });

  return { id, ref, created };
}

function consolidatedEmailContent(items: QueuedEmailNotification[]) {
  const digest = items.find(({ input }) => input.type === "portfolio_digest")?.input;
  const updates = items.filter(({ input }) => input.type !== "portfolio_digest").map(({ input }) => input);
  const title = digest ? "Resumo da sua carteira" : "Atualizações da sua carteira";
  const message = digest?.message || `Sua carteira teve ${updates.length} atualização(ões) nesta execução.`;
  const subject = digest
    ? `[Dados FII] Resumo da sua carteira${updates.length ? ` · ${updates.length} alerta(s)` : ""}`
    : `[Dados FII] ${updates.length} atualização(ões) da sua carteira`;
  const text = [
    digest ? `Resumo\n${digest.message}` : "",
    ...updates.map((input) => `${input.title}\n${input.message}`),
  ].filter(Boolean).join("\n\n");
  const impact = digest?.portfolioImpact || {};
  const summaryRows = digest ? [
    ["Patrimônio estimado", formatCurrency(Number(impact.totalValue || 0))],
    ["Renda mensal estimada", formatCurrency(Number(impact.estimatedIncome || 0))],
    ["Renda anunciada", formatCurrency(Number(impact.announcedIncome || 0))],
    ["Maior posição", impact.topTicker ? `${String(impact.topTicker)} · ${formatPercent(Number(impact.topWeightPercent || 0))}` : "-"],
  ].map(([label, value]) => `<tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#64748b">${escapeHtml(String(label))}</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:700;text-align:right">${escapeHtml(String(value))}</td></tr>`).join("") : "";
  const summaryHtml = summaryRows ? `<div style="margin-top:14px;background:#fff;border-radius:16px;padding:14px;border:1px solid #e2e8f0"><table style="width:100%;border-collapse:collapse">${summaryRows}</table></div>` : "";
  const updatesHtml = updates.length ? `<div style="margin-top:14px;background:#fff;border-radius:16px;padding:18px;border:1px solid #e2e8f0"><p style="margin:0 0 12px;font-weight:700">Atualizações desta execução</p>${updates.map((input) => `<div style="margin-top:10px;border-left:4px solid ${input.severity === "critical" ? "#dc2626" : input.severity === "warning" ? "#d97706" : input.severity === "success" ? "#059669" : "#4f46e5"};padding:10px 12px;background:#f8fafc"><p style="margin:0;font-weight:700">${escapeHtml(input.title)}</p><p style="margin:6px 0 0;color:#475569;line-height:1.5">${escapeHtml(input.message)}</p></div>`).join("")}</div>` : "";
  const extraHtml = `${summaryHtml}${updatesHtml}`;
  return { subject, text, html: baseEmailHtml(title, message, "/carteira", extraHtml) };
}

async function deliverEmailBatch(email: string, items: QueuedEmailNotification[]) {
  if (!items.length) return { sent: false, provider: "not-needed" };
  const content = consolidatedEmailContent(items);
  const delivery = await sendEmail(email, content.subject, content.text, content.html);
  const batchId = hash(items.map(({ input }) => `${input.type}|${input.eventKey}`).sort().join("|"));
  await Promise.all(items.map(({ ref }) => ref.set({
    emailBatchId: batchId,
    emailAttemptedAt: adminFieldValue.serverTimestamp(),
    emailSentAt: delivery.sent ? adminFieldValue.serverTimestamp() : null,
    emailProvider: delivery.provider,
    emailError: delivery.sent ? null : delivery.error || "Envio não realizado",
  }, { merge: true })));
  return delivery;
}

function dividendHash(position: PortfolioPosition) {
  const dividend = position.currentDividend;
  if (!dividend) return "";
  return hash(`${position.ticker}|${dividend.year}|${dividend.month}|${dividend.earnings}|${dividend.paymentDate}|${dividend.dateWith}`);
}

function dividendNotification(position: PortfolioPosition, totalEstimatedIncome: number, isVip: boolean): NotificationInput {
  const current = position.currentDividend!;
  const previous = position.previousDividend;
  const amount = current.earnings * position.quotas;
  const changePct = previous?.earnings ? ((current.earnings - previous.earnings) / previous.earnings) * 100 : null;
  const incomeShare = totalEstimatedIncome > 0 ? (amount / totalEstimatedIncome) * 100 : 0;
  const severity: NotificationSeverity = changePct !== null && changePct <= -10 ? "warning" : changePct !== null && changePct >= 10 ? "success" : "info";
  const comparison = changePct === null ? "Sem comparação disponível com o pagamento anterior." : `${changePct >= 0 ? "Alta" : "Queda"} de ${formatPercent(Math.abs(changePct))} em relação ao pagamento anterior.`;
  const basicMessage = `${position.ticker} anunciou ${formatCurrency(current.earnings)} por cota. Para ${position.quotas} cota(s), o valor estimado é ${formatCurrency(amount)}${current.paymentDate ? `, com pagamento em ${current.paymentDate}` : ""}.`;
  const message = isVip ? `${basicMessage} ${comparison} Este pagamento representa aproximadamente ${formatPercent(incomeShare)} da renda mensal estimada da carteira.` : basicMessage;
  const extraHtml = `<div style="margin-top:14px;background:#fff;border-radius:16px;padding:18px;border:1px solid #e2e8f0"><p style="margin:0 0 8px;font-weight:700">Impacto na sua posição</p><p style="margin:0;color:#475569;line-height:1.6">Cotas: ${position.quotas}<br>Valor por cota: ${formatCurrency(current.earnings)}<br>Total estimado: ${formatCurrency(amount)}${previous ? `<br>Pagamento anterior: ${formatCurrency(previous.earnings)}` : ""}</p></div>`;

  return {
    type: "dividend_announcement",
    eventKey: `dividend:${position.ticker}:${dividendHash(position)}`,
    ticker: position.ticker,
    title: `${position.ticker} anunciou rendimento`,
    message,
    severity,
    actionUrl: `/fii/${position.ticker}`,
    portfolioImpact: {
      quotas: position.quotas,
      earningsPerShare: current.earnings,
      estimatedAmount: amount,
      previousEarningsPerShare: previous?.earnings || null,
      changePercent: changePct,
      incomeSharePercent: incomeShare,
      paymentDate: current.paymentDate || null,
    },
    emailSubject: `[Dados FII] Novo rendimento de ${position.ticker}`,
    emailText: `${message}\n\nConsulte sua carteira no Dados FII.`,
    emailHtml: baseEmailHtml(`${position.ticker} anunciou rendimento`, message, `/fii/${position.ticker}`, extraHtml),
  };
}

function notificationPreferences(data: any) {
  return data?.notificationPreferences && typeof data.notificationPreferences === "object" ? data.notificationPreferences : {};
}

function findNextPayment(positions: PortfolioPosition[]) {
  const now = new Date();
  const candidates = positions.flatMap((position) => position.records.map((record) => ({
    ticker: position.ticker,
    date: parseBrDate(record.paymentDate),
    paymentDate: record.paymentDate,
    amount: record.earnings * position.quotas,
  }))).filter((item) => item.date && item.date.getTime() >= now.getTime() - 43200000) as Array<{ ticker: string; date: Date; paymentDate: string; amount: number }>;
  return candidates.sort((a, b) => a.date.getTime() - b.date.getTime())[0] || null;
}

function digestNotification(positions: PortfolioPosition[], isVip: boolean, dateKey: string): NotificationInput {
  const totalValue = positions.reduce((sum, item) => sum + item.currentValue, 0);
  const estimatedIncome = positions.reduce((sum, item) => sum + item.estimatedIncome, 0);
  const announcedIncome = positions.reduce((sum, item) => sum + item.announcedIncome, 0);
  const pending = positions.filter((item) => !item.currentDividend).map((item) => item.ticker);
  const top = [...positions].sort((a, b) => b.currentValue - a.currentValue)[0] || null;
  const topWeight = top && totalValue > 0 ? (top.currentValue / totalValue) * 100 : 0;
  const nextPayment = findNextPayment(positions);
  const messageParts = [
    `Patrimônio estimado: ${formatCurrency(totalValue)}.`,
    `Renda mensal estimada: ${formatCurrency(estimatedIncome)}.`,
    `Renda anunciada no mês: ${formatCurrency(announcedIncome)}.`,
    pending.length ? `Aguardando comunicado de ${pending.slice(0, isVip ? 8 : 3).join(", ")}${pending.length > (isVip ? 8 : 3) ? " e outros" : ""}.` : "Todos os FIIs acompanhados já possuem rendimento no mês.",
    nextPayment ? `Próximo pagamento: ${nextPayment.ticker} em ${nextPayment.paymentDate}, estimado em ${formatCurrency(nextPayment.amount)}.` : "Nenhum pagamento futuro identificado na base.",
  ];
  if (top) messageParts.push(`Maior posição: ${top.ticker}, com ${formatPercent(topWeight)} do patrimônio estimado.`);
  const message = messageParts.join(" ");
  const rows = [
    ["Patrimônio estimado", formatCurrency(totalValue)],
    ["Renda mensal estimada", formatCurrency(estimatedIncome)],
    ["Renda anunciada", formatCurrency(announcedIncome)],
    ["Pendências", pending.length ? String(pending.length) : "0"],
    ["Maior posição", top ? `${top.ticker} · ${formatPercent(topWeight)}` : "-"],
  ].map(([label, value]) => `<tr><td style="padding:10px;border-bottom:1px solid #e2e8f0;color:#64748b">${escapeHtml(label)}</td><td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:700;text-align:right">${escapeHtml(value)}</td></tr>`).join("");
  const extraHtml = `<div style="margin-top:14px;background:#fff;border-radius:16px;padding:14px;border:1px solid #e2e8f0"><table style="width:100%;border-collapse:collapse">${rows}</table></div>`;

  return {
    type: "portfolio_digest",
    eventKey: `digest:${dateKey}`,
    title: "Resumo da sua carteira",
    message,
    severity: "info",
    actionUrl: "/carteira",
    portfolioImpact: { totalValue, estimatedIncome, announcedIncome, pendingCount: pending.length, topTicker: top?.ticker || null, topWeightPercent: topWeight },
    emailSubject: "[Dados FII] Resumo da sua carteira",
    emailText: message,
    emailHtml: baseEmailHtml("Resumo da sua carteira", message, "/carteira", extraHtml),
  };
}

function patrimonyChangeNotification(decision: ReturnType<typeof portfolioValueChangeDecision>, referenceDate: string, dateKey: string): NotificationInput {
  const changePercent = Number(decision.changePercent || 0);
  const referenceValue = Number(decision.referenceValue || 0);
  const rose = decision.direction === "up";
  const directionLabel = rose ? "subiu" : "caiu";
  const message = `O patrimônio estimado da carteira ${directionLabel} ${formatPercent(Math.abs(changePercent))}, de ${formatCurrency(referenceValue)} para ${formatCurrency(decision.currentValue)}. O aviso foi gerado ao atingir o limite de ${formatPercent(decision.thresholdPercent)} configurado para sua conta. A comparação mantém as mesmas quantidades de cotas e usa as cotações disponíveis em cada leitura.`;
  return {
    type: "portfolio_value_change",
    eventKey: `patrimony:${referenceDate || "baseline"}:${dateKey}:${decision.direction}:${Math.round(decision.currentValue * 100)}`,
    title: `Patrimônio da carteira ${directionLabel} ${formatPercent(Math.abs(changePercent))}`,
    message,
    severity: rose ? "success" : "warning",
    actionUrl: "/carteira",
    portfolioImpact: {
      previousValue: referenceValue,
      currentValue: decision.currentValue,
      changePercent,
      thresholdPercent: decision.thresholdPercent,
      referenceDate: referenceDate || null,
    },
    emailEligible: false,
  };
}

function resolvedRiskNotification(previous: StoredRisk, currentWeight: number, threshold: number, dateKey: string): NotificationInput {
  const stableKey = riskStableKey(previous.type, previous.key);
  return {
    type: "risk_resolved",
    eventKey: `risk-resolved:${stableKey}:${dateKey}`,
    ticker: /^[A-Z0-9]+11$/.test(previous.key) ? previous.key : null,
    title: `${previous.key} voltou ao limite de concentração`,
    message: `${previous.key} passou de ${formatPercent(previous.weight)} na leitura anterior para ${formatPercent(currentWeight)} agora, abaixo do limite de ${formatPercent(threshold)}. Os pesos podem mudar com as cotações mesmo sem alteração na quantidade de cotas.`,
    severity: "success",
    actionUrl: "/carteira",
    portfolioImpact: { previousWeightPercent: previous.weight, weightPercent: currentWeight, thresholdPercent: threshold, riskType: previous.type, key: previous.key },
  };
}

async function processUser(doc: any, now: LocalDateParts): Promise<UserProcessResult> {
  try {
    const data = doc.data() || {};
    const email = normalizeEmail(data.email || (String(doc.id).includes("@") ? doc.id : ""));
    const wallet = extractUserWallet(data);
    if (!isEmail(email)) return { userId: doc.id, status: "skipped", reason: "sem_email_valido" };
    if (!wallet.length) return { userId: doc.id, email, status: "skipped", reason: "carteira_vazia" };

    const isVip = isVipUser(data);
    const preferences = notificationPreferences(data);
    if (preferences.enabled === false) return { userId: doc.id, email, status: "skipped", reason: "notificacoes_desativadas", isVip, walletCount: wallet.length };

    const fiiMap = await loadFiiMap(wallet.map((item) => item.ticker));
    const positions = buildPositions(wallet, fiiMap, now);
    if (!positions.length) return { userId: doc.id, email, status: "skipped", reason: "sem_dados_fiis", isVip, walletCount: wallet.length };

    const userRef = doc.ref;
    const stateRef = userRef.collection("NotificationState").doc("main");
    const stateSnap = await stateRef.get();
    const state = stateSnap.data() || {};
    const initialized = Boolean(state.initialized);
    const previousDividendHashes: Record<string, string> = state.dividendHashes && typeof state.dividendHashes === "object" ? state.dividendHashes : {};
    const nextDividendHashes = { ...previousDividendHashes };
    const freeLimit = Math.max(envNumber("FREE_PORTFOLIO_ALERT_LIMIT", DEFAULT_FREE_LIMIT), 1);
    const scope = isVip ? positions : [...positions].sort((a, b) => b.currentValue - a.currentValue || b.estimatedIncome - a.estimatedIncome).slice(0, freeLimit);
    const totalEstimatedIncome = positions.reduce((sum, item) => sum + item.estimatedIncome, 0);
    const emailEnabled = preferences.emailEnabled !== false && envBoolean("PORTFOLIO_EMAIL_ALERTS_ENABLED", true);
    const dividendAlertsEnabled = preferences.dividendAlerts !== false;
    const riskAlertsEnabled = preferences.riskAlerts !== false;
    let notificationsCreated = 0;
    let emailsSent = 0;
    const queuedEmails: QueuedEmailNotification[] = [];

    const queueNotification = async (input: NotificationInput) => {
      const created = await createNotification(userRef, input);
      if (!created.created) return false;
      notificationsCreated += 1;
      if (emailEnabled && input.emailEligible !== false) queuedEmails.push({ ref: created.ref, input });
      return true;
    };

    const changedDividendTickers = new Set<string>();
    for (const position of positions) {
      const currentHash = dividendHash(position);
      if (!currentHash) continue;
      const previousHash = previousDividendHashes[position.ticker] || "";
      nextDividendHashes[position.ticker] = currentHash;
      if (initialized && previousHash && previousHash !== currentHash) changedDividendTickers.add(position.ticker);
    }

    const dividendChangesInScope = dividendAlertsEnabled
      ? scope.filter((position) => changedDividendTickers.has(position.ticker))
      : [];
    for (const position of dividendChangesInScope) {
      await queueNotification(dividendNotification(position, totalEstimatedIncome, isVip));
    }

    const riskFlags = buildRiskFlags(positions, isVip);
    const thresholds = riskThresholds(isVip);
    const riskConfiguration = riskConfigurationFingerprint(isVip);
    const previousRiskState = storedRiskState(state);
    const previousRiskWeights: Record<string, number> = state.riskWeights && typeof state.riskWeights === "object" ? state.riskWeights : {};
    const currentRiskWeights = buildRiskWeights(positions, isVip);
    const completeRiskData = positions.length === wallet.length && positions.every((position) => position.price > 0);
    const shouldRebaselineRisk = !initialized || Number(state.riskEngineVersion || 0) !== RISK_ENGINE_VERSION || String(state.riskConfigurationFingerprint || "") !== riskConfiguration;
    const nextRiskState: Record<string, StoredRisk> = completeRiskData ? {} : { ...previousRiskState };

    if (completeRiskData) {
      for (const flag of riskFlags) {
        const stableKey = riskStableKey(flag.type, flag.key);
        const previous = previousRiskState[stableKey];
        const previousWeight = Number(previousRiskWeights[stableKey]);
        nextRiskState[stableKey] = { type: flag.type, key: flag.key, weight: flag.weight, threshold: flag.threshold };

        if (!shouldRebaselineRisk && riskAlertsEnabled && !previous && Number.isFinite(previousWeight) && previousWeight < flag.threshold) {
          await queueNotification({
          type: `risk_${flag.type}`,
          eventKey: `risk:${stableKey}:${now.dateKey}`,
          ticker: /^[A-Z0-9]+11$/.test(flag.key) ? flag.key : null,
          title: flag.title,
          message: `${flag.message} Na leitura anterior, o peso era ${formatPercent(previousWeight)}. A comparação usa as mesmas quantidades de cotas com as cotações disponíveis em cada execução.`,
          severity: flag.severity,
          actionUrl: flag.actionUrl,
          portfolioImpact: { previousWeightPercent: previousWeight, weightPercent: flag.weight, thresholdPercent: flag.threshold, riskType: flag.type, key: flag.key },
          });
        }
      }

      for (const [stableKey, previous] of Object.entries(previousRiskState)) {
        if (nextRiskState[stableKey]) continue;
        const currentWeight = Number(currentRiskWeights[stableKey]);
        const threshold = thresholds[previous.type];
        if (!Number.isFinite(currentWeight)) {
          nextRiskState[stableKey] = previous;
          continue;
        }
        if (currentWeight > threshold - RISK_RESOLUTION_BUFFER_PERCENT) {
          nextRiskState[stableKey] = { ...previous, weight: currentWeight, threshold };
          continue;
        }
        if (!shouldRebaselineRisk && riskAlertsEnabled && isVip) {
          await queueNotification(resolvedRiskNotification(previous, currentWeight, threshold, now.dateKey));
        }
      }
    }

    const schedule = "event-driven";
    const digestEnabled = preferences.digestEnabled !== false && envBoolean("PORTFOLIO_DIGEST_ENABLED", true);
    const patrimonyAlertsEnabled = preferences.patrimonyAlerts !== false;
    const thresholdPercent = patrimonyThresholdPercent(isVip, preferences.patrimonyChangeThresholdPercent);
    const currentWalletFingerprint = walletFingerprint(wallet);
    const currentPortfolioValue = positions.reduce((sum, position) => sum + position.currentValue, 0);
    const dividendEventDetected = dividendAlertsEnabled && changedDividendTickers.size > 0;
    const patrimonyConfigurationChanged = !initialized
      || Number(state.patrimonyPolicyVersion || 0) !== PORTFOLIO_NOTIFICATION_POLICY_VERSION
      || String(state.walletFingerprint || "") !== currentWalletFingerprint
      || Number(state.patrimonyChangeThresholdPercent || 0) !== thresholdPercent;
    const patrimonyDecision = portfolioValueChangeDecision({
      currentValue: currentPortfolioValue,
      referenceValue: state.patrimonyReferenceValue,
      thresholdPercent,
      dataComplete: completeRiskData,
      dividendChanged: dividendEventDetected,
      configurationChanged: patrimonyConfigurationChanged,
    });
    let digestSent = false;
    let nextLastDigestDate = String(state.lastDigestDate || "");
    let nextPatrimonyReferenceValue = Number(state.patrimonyReferenceValue || 0) || null;
    let nextPatrimonyReferenceDate = String(state.patrimonyReferenceDate || "");

    if (dividendEventDetected && digestEnabled && dividendChangesInScope.length === 0) {
      await queueNotification(digestNotification(positions, isVip, now.dateKey));
      nextLastDigestDate = now.dateKey;
    } else if (!dividendEventDetected && patrimonyAlertsEnabled && patrimonyDecision.shouldNotify) {
      await queueNotification(patrimonyChangeNotification(patrimonyDecision, nextPatrimonyReferenceDate, now.dateKey));
    }

    if (patrimonyDecision.shouldRebaseline) {
      nextPatrimonyReferenceValue = patrimonyDecision.currentValue;
      nextPatrimonyReferenceDate = now.dateKey;
    }

    if (emailEnabled && queuedEmails.length) {
      const delivery = await deliverEmailBatch(email, queuedEmails);
      emailsSent = delivery.sent ? 1 : 0;
      digestSent = Boolean(delivery.sent && queuedEmails.some(({ input }) => input.type === "portfolio_digest"));
    }

    await stateRef.set({
      initialized: true,
      plan: isVip ? "vip" : "free",
      walletCount: wallet.length,
      alertScopeCount: scope.length,
      dividendHashes: nextDividendHashes,
      riskEngineVersion: RISK_ENGINE_VERSION,
      riskConfigurationFingerprint: riskConfiguration,
      riskDataComplete: completeRiskData,
      riskState: nextRiskState,
      riskWeights: completeRiskData ? currentRiskWeights : previousRiskWeights,
      riskFlags: Object.values(nextRiskState).map((item) => `${item.type}:${item.key}:${item.threshold}`),
      lastDigestDate: nextLastDigestDate || null,
      digestSchedule: schedule,
      patrimonyPolicyVersion: PORTFOLIO_NOTIFICATION_POLICY_VERSION,
      patrimonyChangeThresholdPercent: thresholdPercent,
      patrimonyReferenceValue: nextPatrimonyReferenceValue,
      patrimonyReferenceDate: nextPatrimonyReferenceDate || null,
      patrimonyLastEvaluatedValue: completeRiskData ? currentPortfolioValue : null,
      patrimonyLastEvaluatedChangePercent: patrimonyDecision.changePercent,
      patrimonyLastDecision: patrimonyDecision.reason,
      walletFingerprint: currentWalletFingerprint,
      lastProcessedDate: now.dateKey,
      lastProcessedAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
      createdAt: stateSnap.exists ? state.createdAt || adminFieldValue.serverTimestamp() : adminFieldValue.serverTimestamp(),
    }, { merge: true });

    return { userId: doc.id, email, status: "processed", isVip, walletCount: wallet.length, notificationsCreated, emailsSent, digestSent, digestSchedule: schedule };
  } catch (err: any) {
    return { userId: doc.id, status: "error", error: err.message || "Erro ao processar usuário" };
  }
}

export async function processPortfolioNotifications(options?: { limit?: number }) {
  const startedAt = Date.now();
  if (!envBoolean("PORTFOLIO_NOTIFICATIONS_ENABLED", true)) {
    return { ok: true, disabled: true, message: "PORTFOLIO_NOTIFICATIONS_ENABLED=false" };
  }

  const limit = Math.min(Math.max(Number(options?.limit || process.env.PORTFOLIO_NOTIFICATION_USER_LIMIT || 100), 1), 300);
  const snapshot = await adminDb.collection("User").limit(limit).get();
  const now = localDateParts();
  const results: UserProcessResult[] = [];
  const concurrency = Math.min(Math.max(envNumber("PORTFOLIO_NOTIFICATION_CONCURRENCY", 5), 1), 10);

  for (let index = 0; index < snapshot.docs.length; index += concurrency) {
    const chunk = snapshot.docs.slice(index, index + concurrency);
    results.push(...await Promise.all(chunk.map((doc) => processUser(doc, now))));
  }

  const summary = results.reduce((acc: Record<string, number>, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    acc.notificationsCreated = (acc.notificationsCreated || 0) + Number(item.notificationsCreated || 0);
    acc.emailsSent = (acc.emailsSent || 0) + Number(item.emailsSent || 0);
    acc.digestsSent = (acc.digestsSent || 0) + Number(item.digestSent ? 1 : 0);
    acc.freeUsers = (acc.freeUsers || 0) + Number(item.isVip === false);
    acc.vipUsers = (acc.vipUsers || 0) + Number(item.isVip === true);
    return acc;
  }, {});

  const durationMs = Date.now() - startedAt;
  const runPayload = {
    ok: Number(summary.error || 0) === 0,
    dateKey: now.dateKey,
    limit,
    totalUsersRead: snapshot.size,
    durationMs,
    summary,
    createdAt: adminFieldValue.serverTimestamp(),
  };

  await adminDb.collection("PortfolioNotificationRuns").add(runPayload);
  await logObservabilityEvent({
    type: "portfolio_notifications",
    ok: runPayload.ok,
    statusCode: runPayload.ok ? 200 : 207,
    source: "vercel-cron",
    message: `Processamento de notificações: ${summary.processed || 0} processado(s), ${summary.emailsSent || 0} e-mail(s), ${summary.error || 0} erro(s).`,
    metadata: {
      dateKey: now.dateKey,
      totalUsersRead: snapshot.size,
      durationMs,
      summary,
    },
  });

  return { ok: runPayload.ok, dateKey: now.dateKey, limit, totalUsersRead: snapshot.size, durationMs, summary, results };
}
