import { createHash } from "node:crypto";
import { calculateDividendSeriesReadiness } from "./DividendSeriesReadiness";
import { dividendStressWindowEngine } from "./DividendStressWindowEngine";
import type { DividendStressWindow, VerifiedDividendNotice } from "../../types/riskLabDividendStress";
import {
  DIVIDEND_STRESS_RULESET_VERSION,
  type DividendStressRun,
  type DividendStressRunRepository,
  type DividendStressRunResult,
  type DividendStressRunStatus,
  type DividendStressRunTicker,
  type VerifiedDividendNoticeReader,
} from "../../types/riskLabDividendStressRun";

const SUPPORTED_TICKERS = new Set<DividendStressRunTicker>(["MCCI11", "RBRY11"]);

export interface DividendStressDetector {
  detect(notices: VerifiedDividendNotice[]): DividendStressWindow;
}

export interface DividendStressRunServiceDependencies {
  noticeReader: VerifiedDividendNoticeReader;
  runRepository: DividendStressRunRepository;
  detector?: DividendStressDetector;
  now?: () => string;
}

function normalizeTicker(value: string): DividendStressRunTicker {
  const ticker = value.trim().toUpperCase() as DividendStressRunTicker;
  if (!SUPPORTED_TICKERS.has(ticker)) {
    throw new Error(`Ticker não suportado para execução de estresse: ${ticker || "vazio"}`);
  }
  return ticker;
}

function assertActor(value: string) {
  if (!value || /\s/.test(value) || value.length > 254) {
    throw new Error("Responsável administrativo inválido.");
  }
}

function canonicalObservation(notice: VerifiedDividendNotice) {
  return {
    ticker: notice.ticker,
    competenceMonth: notice.competenceMonth,
    amountPerShare: notice.amountPerShare,
    announcedAt: notice.announcedAt,
    source: {
      documentId: notice.source.documentId,
      sourceUrl: notice.source.sourceUrl,
      sourceType: notice.source.sourceType,
      reviewMethod: notice.source.reviewMethod,
      reviewedBy: notice.source.reviewedBy,
      reviewedAt: notice.source.reviewedAt,
      page: notice.source.page,
      excerpt: notice.source.excerpt,
    },
  };
}

function snapshot(notices: VerifiedDividendNotice[]) {
  return [...notices]
    .sort((left, right) => left.competenceMonth.localeCompare(right.competenceMonth))
    .map(canonicalObservation);
}

export function hashVerifiedDividendNotices(notices: VerifiedDividendNotice[]) {
  return createHash("sha256").update(JSON.stringify(snapshot(notices))).digest("hex");
}

function observationId(notice: VerifiedDividendNotice) {
  return `${notice.ticker}_${notice.competenceMonth}_${notice.source.documentId}`;
}

export class DividendStressRunService {
  private readonly noticeReader: VerifiedDividendNoticeReader;
  private readonly runRepository: DividendStressRunRepository;
  private readonly detector: DividendStressDetector;
  private readonly now: () => string;

  constructor(dependencies: DividendStressRunServiceDependencies) {
    this.noticeReader = dependencies.noticeReader;
    this.runRepository = dependencies.runRepository;
    this.detector = dependencies.detector || dividendStressWindowEngine;
    this.now = dependencies.now || (() => new Date().toISOString());
  }

  async status(tickerValue: string, enabled: boolean): Promise<DividendStressRunStatus> {
    const ticker = normalizeTicker(tickerValue);
    const notices = await this.noticeReader.listByTicker(ticker);
    const readiness = calculateDividendSeriesReadiness(ticker, notices);
    const latestRun = (await this.runRepository.listLatestByTicker(ticker, 1))[0] || null;
    return { enabled, ticker, readiness, latestRun };
  }

  async execute(tickerValue: string, actor: string): Promise<DividendStressRunResult> {
    const ticker = normalizeTicker(tickerValue);
    assertActor(actor);

    const notices = await this.noticeReader.listByTicker(ticker);
    const readiness = calculateDividendSeriesReadiness(ticker, notices);
    if (!readiness.readyForStressDetection) {
      throw new Error(
        `Série insuficiente para ${ticker}: maior sequência ${readiness.longestContiguousCount}/${readiness.requiredContiguousCount}.`,
      );
    }

    const ordered = snapshot(notices) as VerifiedDividendNotice[];
    const inputHash = hashVerifiedDividendNotices(ordered);
    const id = `${ticker}_${DIVIDEND_STRESS_RULESET_VERSION}_${inputHash.slice(0, 24)}`;
    const existing = await this.runRepository.getById(id);
    if (existing) return { run: existing, created: false };

    const executedAt = this.now();
    if (Number.isNaN(Date.parse(executedAt))) throw new Error("Data de execução inválida.");

    const run: DividendStressRun = {
      id,
      ticker,
      rulesetVersion: DIVIDEND_STRESS_RULESET_VERSION,
      inputHash,
      observationIds: ordered.map(observationId),
      competenceMonths: ordered.map((notice) => notice.competenceMonth),
      executedAt,
      executedBy: actor,
      manualConfirmation: true,
      classificationFinal: false,
      limitations: ["material_credit_events_not_reviewed"],
      result: this.detector.detect(ordered),
      readiness: { ...readiness, detectorExecuted: true },
      externalEffects: {
        alertsCreated: false,
        notificationsSent: false,
        premiumUpdated: false,
      },
    };

    return { run: await this.runRepository.save(run), created: true };
  }
}
