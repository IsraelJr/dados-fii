import { createHash } from "node:crypto";
import {
  automaticCreditEventScreeningService,
  type AutomaticCreditEventScreeningService,
} from "@/lib/risk-lab/AutomaticCreditEventScreeningService";
import { dividendStressWindowEngine } from "@/lib/risk-lab/DividendStressWindowEngine";
import { RiskLabTickerOrchestrator } from "@/lib/risk-lab/RiskLabTickerOrchestrator";
import type {
  RiskLabAutomaticScan,
  RiskLabAutomaticScanRepository,
} from "@/types/riskLabAutomatic";

function interval(scan: RiskLabAutomaticScan) {
  const series = scan.monthlySeries;
  if (!series?.detectorResult || series.observations.length === 0) return null;
  const ordered = [...series.observations].sort(
    (left, right) => Date.parse(left.announcedAt) - Date.parse(right.announcedAt),
  );
  return {
    from: ordered[0].announcedAt,
    until: series.detectorResult.recoveryDetectedAt
      || series.detectorResult.stressDetectedAt
      || ordered[ordered.length - 1].announcedAt,
  };
}

export interface RiskLabAutomaticOrchestratorDependencies {
  base?: Pick<RiskLabTickerOrchestrator, "scan">;
  creditScreen?: Pick<AutomaticCreditEventScreeningService, "screen">;
  repository?: RiskLabAutomaticScanRepository;
}

export class RiskLabAutomaticOrchestrator {
  private readonly base: Pick<RiskLabTickerOrchestrator, "scan">;
  private readonly creditScreen: Pick<AutomaticCreditEventScreeningService, "screen">;
  private readonly repository?: RiskLabAutomaticScanRepository;

  constructor(dependencies: RiskLabAutomaticOrchestratorDependencies = {}) {
    this.base = dependencies.base || new RiskLabTickerOrchestrator();
    this.creditScreen = dependencies.creditScreen || automaticCreditEventScreeningService;
    this.repository = dependencies.repository;
  }

  private persist(scan: RiskLabAutomaticScan) {
    return this.repository ? this.repository.save(scan) : Promise.resolve(scan);
  }

  async scan(ticker: string, actor: string): Promise<RiskLabAutomaticScan> {
    const scan = await this.base.scan(ticker, actor);
    const series = scan.monthlySeries;
    const dates = interval(scan);
    if (!series || series.status !== "ready" || !series.detectorResult || !dates) {
      return this.persist(scan);
    }

    const creditEventScreen = await this.creditScreen.screen(
      scan.ticker,
      scan.documents,
      scan.sources,
      dates.from,
      dates.until,
    );
    const detectorResult = creditEventScreen.verifiedEvents.length > 0
      ? dividendStressWindowEngine.detect(series.observations, {
          creditEvents: creditEventScreen.verifiedEvents,
        })
      : series.detectorResult;
    const classificationFinal = creditEventScreen.status === "material_event_confirmed";
    const monthlySeries = {
      ...series,
      detectorResult,
      creditEventScreen,
      classificationFinal,
      limitation: creditEventScreen.status === "material_event_confirmed"
        ? "material_credit_event_confirmed" as const
        : creditEventScreen.status === "inconclusive"
          ? "material_credit_event_screen_inconclusive" as const
          : "no_explicit_material_credit_event_found" as const,
    };

    const issue = creditEventScreen.status === "material_event_confirmed"
      ? {
          code: "material_credit_event_confirmed",
          severity: "warning" as const,
          message: creditEventScreen.summary,
        }
      : creditEventScreen.status === "inconclusive"
        ? {
            code: "material_credit_event_screen_inconclusive",
            severity: "warning" as const,
            message: creditEventScreen.summary,
          }
        : {
            code: "no_explicit_material_credit_event_found",
            severity: "warning" as const,
            message: creditEventScreen.summary,
          };

    const status = creditEventScreen.status === "inconclusive" ? "inconclusive" : scan.status;
    const analysisReadiness = classificationFinal
      ? "structured_series_final" as const
      : creditEventScreen.status === "inconclusive"
        ? "credit_event_screen_inconclusive" as const
        : "structured_series_ready" as const;
    const nextAction = classificationFinal
      ? "Um evento material de crédito foi confirmado automaticamente e bloqueou qualquer interpretação de recuperação saudável."
      : creditEventScreen.status === "inconclusive"
        ? "A classificação final foi interrompida automaticamente por documentos ambíguos ou não legíveis. Nenhuma validação técnica é exigida do administrador."
        : "Nenhum evento material explícito foi confirmado automaticamente. O resultado permanece preliminar e não representa certificação de ausência de risco.";
    const id = `${scan.ticker}_${createHash("sha256")
      .update(JSON.stringify({
        originalScan: scan.id,
        matches: creditEventScreen.matches,
        ambiguous: creditEventScreen.ambiguousDocuments.map((item) => item.documentId),
      }))
      .digest("hex")
      .slice(0, 20)}`;

    return this.persist({
      ...scan,
      id,
      status,
      monthlySeries,
      issues: [...scan.issues, issue],
      analysisReadiness,
      nextAction,
      requiresHumanDocumentValidation: false,
      notificationsSent: false,
      premiumIntegrated: false,
    });
  }
}
