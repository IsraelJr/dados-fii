import { createHash } from "node:crypto";
import type { PublicFundData } from "@/types/regulatory";
import type { RegulatoryTimelineResponse } from "@/types/timeline";
import type { FundRadarObservation, FundRadarUpdate } from "./FundRadar";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const compact = value.replace(/R\$|%|\s/g, "").trim();
  if (!compact || compact === "-") return null;
  const normalized = compact.includes(",") ? compact.replace(/\./g, "").replace(",", ".") : compact;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export type FundRadarDividend = Readonly<{
  competence: string;
  amount: number;
  paymentDate: string | null;
  source: string;
}>;

export function latestFundRadarDividend(fund: Readonly<Record<string, unknown>>): FundRadarDividend | null {
  const dividends = Object.entries(fund).flatMap(([key, value]) => {
    if (!/^earnings\d{4}$/.test(key) || !value || typeof value !== "object" || Array.isArray(value)) return [];
    const year = Number(key.slice(-4));
    return Object.entries(value as Record<string, unknown>).flatMap(([month, raw]) => {
      const monthIndex = MONTHS.indexOf(month as typeof MONTHS[number]);
      if (monthIndex < 0 || !raw || typeof raw !== "object" || Array.isArray(raw)) return [];
      const record = raw as Record<string, unknown>;
      const amount = finiteNumber(record.earnings);
      if (amount === null || amount < 0) return [];
      return [{
        competence: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
        amount,
        paymentDate: String(record.payment_date || "").trim() || null,
        source: "Dados regulatórios e históricos do Dados FII",
      }];
    });
  });
  return dividends.sort((left, right) => left.competence.localeCompare(right.competence)).at(-1) || null;
}

function qualityProjection(fund: PublicFundData) {
  const assessment = fund.regulatoryMeta.validation.assessment;
  return {
    status: assessment?.status || fund.regulatoryMeta.validation.status || (fund.regulatoryMeta.validation.valid ? "valid" : "unavailable"),
    confidence: typeof assessment?.confidence === "number" ? assessment.confidence : null,
    missingFields: [...(assessment?.missingFields || [])].sort(),
    invalidFields: [...(assessment?.invalidFields || [])].sort(),
  };
}

function signalProjection(fund: PublicFundData) {
  const risk = fund.scores?.risk;
  return risk ? {
    score: risk.score,
    confidence: risk.confidence,
    level: risk.level,
    reasons: [...risk.reasons].sort(),
    engineVersion: fund.scores?.engineVersion,
  } : null;
}

export function createFundRadarObservation(
  fund: PublicFundData,
  timeline: RegulatoryTimelineResponse | null,
): FundRadarObservation {
  const dividend = latestFundRadarDividend(fund);
  const timelineItems = (timeline?.items || []).slice(0, 10).map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    occurredAt: item.occurredAt,
    publishedAt: item.publishedAt || null,
    source: item.source,
    url: item.url || null,
  }));
  const quality = qualityProjection(fund);
  const signal = signalProjection(fund);
  const projection = { dividend, timelineItems, quality, signal };
  return Object.freeze({
    fingerprint: hash(projection),
    dividendFingerprint: dividend ? hash(dividend) : null,
    timelineFingerprints: Object.freeze(timelineItems.map(hash)),
    qualityFingerprint: hash(quality),
    signalFingerprint: hash(signal),
  });
}

function updateFingerprint(ticker: string, kind: FundRadarUpdate["kind"], sourceFingerprint: string) {
  return hash({ version: 1, ticker, kind, sourceFingerprint });
}

export function detectFundRadarUpdates(input: Readonly<{
  ticker: string;
  previous: FundRadarObservation | null;
  current: FundRadarObservation;
  fund: PublicFundData;
  timeline: RegulatoryTimelineResponse | null;
  now: string;
}>) {
  if (!input.previous || input.previous.fingerprint === input.current.fingerprint) return Object.freeze([]) as readonly FundRadarUpdate[];
  const updates: FundRadarUpdate[] = [];
  const quality = qualityProjection(input.fund);
  const missingData = Object.freeze([...quality.missingFields, ...quality.invalidFields].slice(0, 20));
  const delivery = Object.freeze({ status: "pending" as const, attemptCount: 0, leaseUntil: null, sentAt: null });

  if (input.previous.dividendFingerprint !== input.current.dividendFingerprint && input.current.dividendFingerprint) {
    const dividend = latestFundRadarDividend(input.fund)!;
    updates.push(Object.freeze({
      fingerprint: updateFingerprint(input.ticker, "dividend", input.current.dividendFingerprint),
      ticker: input.ticker,
      kind: "dividend",
      title: `Rendimento atualizado em ${input.ticker}`,
      whatChanged: `O rendimento mais recente passou a refletir a competência ${dividend.competence}.`,
      whyItMatters: "O evento altera o histórico conhecido do fundo e merece conferência na fonte indicada.",
      source: dividend.source,
      asOf: dividend.paymentDate,
      missingData,
      createdAt: input.now,
      delivery,
    }));
  }

  const previousTimeline = new Set(input.previous.timelineFingerprints);
  const newTimelineFingerprint = input.current.timelineFingerprints.find((fingerprint) => !previousTimeline.has(fingerprint));
  if (newTimelineFingerprint) {
    const index = input.current.timelineFingerprints.indexOf(newTimelineFingerprint);
    const event = input.timeline?.items[index];
    if (event) updates.push(Object.freeze({
      fingerprint: updateFingerprint(input.ticker, "regulatory_event", newTimelineFingerprint),
      ticker: input.ticker,
      kind: "regulatory_event",
      title: `Novo evento regulatório em ${input.ticker}`,
      whatChanged: event.title,
      whyItMatters: "O documento pode acrescentar informação relevante para a análise do fundo.",
      source: event.source,
      asOf: event.occurredAt || event.publishedAt || null,
      missingData,
      createdAt: input.now,
      delivery,
    }));
  }

  if (input.previous.qualityFingerprint !== input.current.qualityFingerprint) {
    updates.push(Object.freeze({
      fingerprint: updateFingerprint(input.ticker, "data_quality", input.current.qualityFingerprint),
      ticker: input.ticker,
      kind: "data_quality",
      title: `Cobertura de dados atualizada em ${input.ticker}`,
      whatChanged: `A qualidade da base agora está classificada como ${quality.status}.`,
      whyItMatters: "Mudanças de cobertura alteram o grau de confiança possível na leitura dos indicadores.",
      source: "RegulatoryDataService",
      asOf: null,
      missingData,
      createdAt: input.now,
      delivery,
    }));
  }

  if (input.previous.signalFingerprint !== input.current.signalFingerprint) {
    updates.push(Object.freeze({
      fingerprint: updateFingerprint(input.ticker, "deterministic_signal", input.current.signalFingerprint),
      ticker: input.ticker,
      kind: "deterministic_signal",
      title: `Sinal determinístico atualizado em ${input.ticker}`,
      whatChanged: "Os dados que alimentam os sinais objetivos do fundo mudaram.",
      whyItMatters: "A mudança pede nova leitura dos dados; ela não constitui recomendação de compra ou venda.",
      source: "ScoreEngine do Dados FII",
      asOf: input.fund.scores?.generatedAt || null,
      missingData,
      createdAt: input.now,
      delivery,
    }));
  }

  return Object.freeze(Array.from(new Map(updates.map((update) => [update.fingerprint, update])).values()));
}
