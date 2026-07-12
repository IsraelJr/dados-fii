import { createHash } from "crypto";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

const TIME_ZONE = "America/Sao_Paulo";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DEFAULT_FREE_LIMIT = 3;

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
type LocalDateParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
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

function tickerOf(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function quotaOf(value: unknown) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
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

function cleanWallet(value: unknown): WalletItem[] {
  const values = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.entries(value as Record<string, any>).map(([key, item]) => ({ ticker: item?.ticker || item?.code || item?.fii || item?.symbol || key, quotas: item?.quotas ?? item?.quantity ?? item?.qtd ?? item?.shares ?? item?.cotas ?? item }))
      : [];

  return values
    .map((item: any) => ({
      ticker: tickerOf(typeof item === "string" ? item : item?.ticker || item?.code || item?.fii || item?.symbol),
      quotas: quotaOf(typeof item === "string" ? 1 : item?.quotas ?? item?.quantity ?? item?.qtd ?? item?.shares ?? item?.cotas),
    }))
    .filter((item) => /^[A-Z0-9]{4,8}11$/.test(item.ticker) && item.quotas > 0)
    .slice(0, 120)
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

function extractWallet(data: any) {
  const candidates = [
    data?.wallet,
    data?.wallet?.items,
    data?.carteira,
    data?.carteira?.items,
    data?.carteira?.fiis,
    data?.fiis,
    data?.portfolio,
    data?.portfolio?.items,
    data?.portfolio?.fiis,
  ];

  for (const candidate of candidates) {
    const wallet = cleanWallet(candidate);
    if (wallet.length) return wallet;
  }

  return [];
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
  const day = Number(map.day);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, weekday, dateKey: `${map.year}-${map.month}-${map.day}` };
}

function parseBrDate(value: string) {
  const [day, month, year] = String(value || "").split("/").map(Number);
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetweenDateKeys(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86400000);
}

function isVipUser(data: any) {
  const plan = String(data?.plan || data?.subscription?.plan || "").toLowerCase();
  return Boolean(data?.isVip || data?.isVIP || data?.isPremium || data?.premium || ["vip", "premium", "pro"].includes(plan));
}

async function loadFiiMap(tickers: string[]) {
  const unique = Array.from(new Set(tickers.map(tickerOf).filter(Boolean)));
  const collection = adminDb.collection("Fiis");
  const map = new Map<string, any>();

  if (!unique.length) return map;

  const directSnapshots = await adminDb.getAll(...unique.map((ticker) => collection.doc(ticker)));
  directSnapshots.forEach((snap) => {
    if (!snap.exists) return;
    const data = snap.data() || {};
    const ticker = tickerOf(data.code || snap.id);
    if (ticker) map.set(ticker, data);
  });

  const missing = unique.filter((ticker) => !map.has(ticker));
  const fallbacks = await Promise.all(missing.map(async (ticker) => {
    const query = await collection.where("code", "==", ticker).limit(1).get();
    return { ticker, doc: query.docs[0] || null };
  }));

  fallbacks.forEach(({ ticker, doc }) => {
    if (doc) map.set(ticker, doc.data() || {});
  });

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

function buildRiskFlags(positions: PortfolioPosition[], isVip: boolean) {
  const flags: RiskFlag[] = [];
  const totalValue = positions.reduce((sum, item) => sum + item.currentValue, 0);
  const totalIncome = positions.reduce((sum, item) => sum + item.estimatedIncome, 0);
  const assetThreshold = isVip ? envNumber("VIP_ASSET_CONCENTRATION_THRESHOLD", 30) : envNumber("FREE_ASSET_CONCENTRATION_THRESHOLD", 40);
  const incomeThreshold = envNumber("VIP_INCOME_CONCENTRATION_THRESHOLD", 45);
  const segmentThreshold = envNumber("VIP_SEGMENT_CONCENTRATION_THRESHOLD", 60);

  const assetCandidates = positions
    .map((item) => ({ item, weight: totalValue > 0 ? (item.currentValue / totalValue) * 100 : 0 }))
    .filter(({ weight }) => weight >= assetThreshold)
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
      .filter(({ weight }) => weight >= incomeThreshold)
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
      .filter(({ weight }) => weight >= segmentThreshold)
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
    const snap = await transaction.get(ref);
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

async function emitNotification(userRef: any, email: string, input: NotificationInput, emailEnabled: boolean) {
  const created = await createNotification(userRef, input);
  if (!created.created) return { created: false, emailSent: false };

  let emailSent = false;
  if (emailEnabled) {
    const subject = input.emailSubject || `[Dados FII] ${input.title}`;
    const text = input.emailText || `${input.title}\n\n${input.message}`;
    const html = input.emailHtml || baseEmailHtml(input.title, input.message, input.actionUrl || "/carteira");
    const delivery = await sendEmail(email, subject, text, html);
    emailSent = delivery.sent;
    await created.ref.set({
      emailAttemptedAt: adminFieldValue.serverTimestamp(),
      emailSentAt: delivery.sent ? adminFieldValue.serverTimestamp() : null,
      emailProvider: delivery.provider,
      emailError: delivery.sent ? null : delivery.error || "Envio não realizado",
    }, { merge: true });
  }

  return { created: true, emailSent };
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

function scheduleIsDue(scheduleValue: string, lastDigestDate: string, now: LocalDateParts) {
  if (lastDigestDate === now.dateKey) return false;
  const schedule = String(scheduleValue || "daily").trim().toLowerCase();
  if (!schedule || schedule === "daily") return true;
  if (schedule === "even_days") return now.day % 2 === 0;
  if (schedule === "odd_days") return now.day % 2 !== 0;
  if (schedule.startsWith("weekly:")) {
    const weekday = Number(schedule.split(":")[1]);
    return Number.isFinite(weekday) && now.weekday === weekday;
  }
  if (schedule.startsWith("weekdays:")) {
    const weekdays = schedule.split(":")[1].split(",").map(Number).filter(Number.isFinite);
    return weekdays.includes(now.weekday);
  }
  if (schedule.startsWith("every:")) {
    const interval = Math.max(Number(schedule.split(":")[1]) || 1, 1);
    return !lastDigestDate || daysBetweenDateKeys(lastDigestDate, now.dateKey) >= interval;
  }
  return true;
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

function resolvedRiskNotification(flagId: string, dateKey: string): NotificationInput {
  const [, key] = flagId.split(":");
  return {
    type: "risk_resolved",
    eventKey: `risk-resolved:${flagId}:${dateKey}`,
    ticker: /^[A-Z0-9]+11$/.test(key || "") ? key : null,
    title: "Concentração voltou ao limite",
    message: `${key || "A concentração monitorada"} deixou de ultrapassar o limite de atenção configurado.`,
    severity: "success",
    actionUrl: "/carteira",
  };
}

async function processUser(doc: any, now: LocalDateParts): Promise<UserProcessResult> {
  try {
    const data = doc.data() || {};
    const email = normalizeEmail(data.email || (String(doc.id).includes("@") ? doc.id : ""));
    const wallet = extractWallet(data);
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

    for (const position of scope) {
      const currentHash = dividendHash(position);
      if (!currentHash) continue;
      const previousHash = previousDividendHashes[position.ticker] || "";
      nextDividendHashes[position.ticker] = currentHash;
      if (!initialized || !previousHash || previousHash === currentHash || !dividendAlertsEnabled) continue;
      const result = await emitNotification(userRef, email, dividendNotification(position, totalEstimatedIncome, isVip), emailEnabled);
      if (result.created) notificationsCreated += 1;
      if (result.emailSent) emailsSent += 1;
    }

    const riskFlags = buildRiskFlags(positions, isVip);
    const previousRiskFlags = Array.isArray(state.riskFlags) ? state.riskFlags.map(String) : [];
    const currentRiskFlags = riskFlags.map((flag) => flag.id);

    if (initialized && riskAlertsEnabled) {
      for (const flag of riskFlags.filter((item) => !previousRiskFlags.includes(item.id))) {
        const result = await emitNotification(userRef, email, {
          type: `risk_${flag.type}`,
          eventKey: `risk:${flag.id}:${now.dateKey}`,
          ticker: /^[A-Z0-9]+11$/.test(flag.key) ? flag.key : null,
          title: flag.title,
          message: flag.message,
          severity: flag.severity,
          actionUrl: flag.actionUrl,
          portfolioImpact: { weightPercent: flag.weight, thresholdPercent: flag.threshold, riskType: flag.type, key: flag.key },
        }, emailEnabled);
        if (result.created) notificationsCreated += 1;
        if (result.emailSent) emailsSent += 1;
      }

      if (isVip) {
        for (const resolved of previousRiskFlags.filter((flagId: string) => !currentRiskFlags.includes(flagId))) {
          const result = await emitNotification(userRef, email, resolvedRiskNotification(resolved, now.dateKey), emailEnabled);
          if (result.created) notificationsCreated += 1;
          if (result.emailSent) emailsSent += 1;
        }
      }
    }

    const schedule = String(preferences.digestSchedule || process.env.PORTFOLIO_DIGEST_SCHEDULE || "daily");
    const digestEnabled = preferences.digestEnabled !== false && envBoolean("PORTFOLIO_DIGEST_ENABLED", true);
    const digestDue = digestEnabled && scheduleIsDue(schedule, String(state.lastDigestDate || ""), now);
    let digestSent = false;
    let nextLastDigestDate = String(state.lastDigestDate || "");

    if (digestDue) {
      const result = await emitNotification(userRef, email, digestNotification(positions, isVip, now.dateKey), emailEnabled);
      if (result.created) notificationsCreated += 1;
      if (result.emailSent) emailsSent += 1;
      digestSent = result.emailSent;
      nextLastDigestDate = now.dateKey;
    }

    await stateRef.set({
      initialized: true,
      plan: isVip ? "vip" : "free",
      walletCount: wallet.length,
      alertScopeCount: scope.length,
      dividendHashes: nextDividendHashes,
      riskFlags: currentRiskFlags,
      lastDigestDate: nextLastDigestDate || null,
      lastProcessedDate: now.dateKey,
      lastProcessedAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
      createdAt: stateSnap.exists ? state.createdAt || adminFieldValue.serverTimestamp() : adminFieldValue.serverTimestamp(),
    }, { merge: true });

    return { userId: doc.id, email, status: "processed", isVip, walletCount: wallet.length, notificationsCreated, emailsSent, digestSent };
  } catch (err: any) {
    return { userId: doc.id, status: "error", error: err.message || "Erro ao processar usuário" };
  }
}

export async function processPortfolioNotifications(options?: { limit?: number }) {
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
    return acc;
  }, {});

  await adminDb.collection("PortfolioNotificationRuns").add({
    dateKey: now.dateKey,
    limit,
    totalUsersRead: snapshot.size,
    summary,
    createdAt: adminFieldValue.serverTimestamp(),
  });

  return { ok: true, dateKey: now.dateKey, limit, totalUsersRead: snapshot.size, summary, results };
}
