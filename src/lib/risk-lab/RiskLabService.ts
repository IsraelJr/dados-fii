import { featureEnabled } from "@/lib/featureFlags";
import type { RiskLabAdminStatus, RiskLabReport } from "@/types/riskLabProduction";
import { loadRiskDataset } from "./DatasetLoader";
import { PRODUCTION_RISK_DATASET_RAW } from "./productionDataset";
import { buildRiskLabReport } from "./RiskLabReportBuilder";
import { RiskLabRepository, type RiskLabRepositoryPort } from "./RiskLabRepository";

const HARD_ALLOWED_TICKERS = new Set(["HCTR11"]);

export class RiskLabService {
  private readonly repository: RiskLabRepositoryPort;

  constructor(repository: RiskLabRepositoryPort = new RiskLabRepository()) {
    this.repository = repository;
  }

  isEnabled() {
    return featureEnabled("ENABLE_RISK_LAB_ADMIN", true);
  }

  supportedTickers() {
    const dataset = loadRiskDataset(PRODUCTION_RISK_DATASET_RAW);
    const approved = dataset.metadata.productionApproval?.allowedTickers || [];
    return approved.filter((ticker) => HARD_ALLOWED_TICKERS.has(ticker));
  }

  async status(): Promise<RiskLabAdminStatus> {
    const dataset = loadRiskDataset(PRODUCTION_RISK_DATASET_RAW);
    const approval = dataset.metadata.productionApproval;
    const supportedTickers = this.supportedTickers();
    const latestReport = supportedTickers.length ? await this.repository.getLatest(supportedTickers[0]) : null;
    const recentReports = await this.repository.listRecent(10);
    return {
      enabled: this.isEnabled(),
      supportedTickers,
      dataset: {
        id: dataset.metadata.id,
        version: dataset.metadata.version,
        quality: dataset.metadata.quality,
        approved: dataset.metadata.productionApproved,
        scope: approval?.scope || null,
        approvalHash: approval?.approvalHash || null,
      },
      latestReport,
      recentReports,
    };
  }

  async generate(requestedTicker: string, actor: string): Promise<RiskLabReport> {
    if (!this.isEnabled()) throw new Error("Risk Lab administrativo está desabilitado por feature flag.");
    const ticker = requestedTicker.trim().toUpperCase();
    if (!this.supportedTickers().includes(ticker)) {
      throw new Error(`Ticker ${ticker || "vazio"} não está autorizado para o teste unitário do Risk Lab.`);
    }

    const lockOwner = `${actor.toLowerCase()}:${Date.now()}`;
    await this.repository.acquireLock(ticker, lockOwner, 45_000);
    try {
      const report = buildRiskLabReport(PRODUCTION_RISK_DATASET_RAW, ticker, actor);
      return await this.repository.saveReport(report);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida no Risk Lab.";
      await this.repository.recordFailure(ticker, actor, message).catch(() => undefined);
      throw error;
    } finally {
      await this.repository.releaseLock(ticker, lockOwner).catch(() => undefined);
    }
  }
}

export const riskLabService = new RiskLabService();
