import { createHash } from "node:crypto";
import { automaticDividendSeriesService, type AutomaticDividendSeriesService } from "@/lib/risk-lab/AutomaticDividendSeriesService";
import { cvmEventualDocumentDiscovery, type CvmEventualDocumentDiscovery } from "@/lib/risk-lab/CvmEventualDocumentDiscovery";
import type { PublicFundData } from "@/types/regulatory";
import type {
  AutomaticAnalysisReadiness,
  AutomaticFundIdentity,
  AutomaticMonthlySeries,
  AutomaticValidationIssue,
  AutomaticValidationStatus,
  RiskLabAutomaticScan,
  RiskLabAutomaticScanRepository,
} from "@/types/riskLabAutomatic";

const SUPPORTED_STRESS_TICKERS = new Set(["MCCI11", "RBRY11"]);
const HISTORICAL_UNIT_TICKERS = new Set(["HCTR11"]);

function normalizeTicker(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function identityFromFund(ticker: string, fund: PublicFundData): AutomaticFundIdentity {
  const record = fund as unknown as Record<string, unknown>;
  const cnpj = digits(record.cnpj || record.CNPJ || record.cnpjFundo || record.cnpj_fundo);
  if (cnpj.length !== 14) throw new Error(`O catálogo oficial não possui CNPJ válido para ${ticker}.`);
  const fundName = String(record.name || record.fundName || record.socialName || record.razaoSocial || ticker).trim();
  return {
    ticker,
    cnpj,
    fundName,
    identitySource: "Catálogo oficial normalizado Dados FII",
  };
}

function yearsForTicker(ticker: string, currentYear: number) {
  if (SUPPORTED_STRESS_TICKERS.has(ticker)) return [2024, 2025, 2026].filter((year) => year <= currentYear);
  if (HISTORICAL_UNIT_TICKERS.has(ticker)) return [2023, 2024, 2025].filter((year) => year <= currentYear);
  return [currentYear - 2, currentYear - 1, currentYear];
}

function readiness(
  ticker: string,
  status: AutomaticValidationStatus,
  monthlySeries: AutomaticMonthlySeries | null,
): AutomaticAnalysisReadiness {
  if (status === "blocked") return "blocked";
  if (HISTORICAL_UNIT_TICKERS.has(ticker)) {
    return status === "validated" ? "historical_unit_available" : "insufficient_official_evidence";
  }
  if (SUPPORTED_STRESS_TICKERS.has(ticker)) {
    return monthlySeries?.status === "ready" ? "structured_series_ready" : "structured_series_incomplete";
  }
  if (status !== "validated") return "insufficient_official_evidence";
  return "detector_not_yet_supported";
}

function nextActionFor(readinessValue: AutomaticAnalysisReadiness) {
  if (readinessValue === "historical_unit_available") return "O sistema pode executar o marco histórico unitário já aprovado.";
  if (readinessValue === "structured_series_ready") return "O detector foi executado automaticamente. O sistema ainda precisa validar eventos materiais de crédito antes de tornar a classificação final.";
  if (readinessValue === "structured_series_incomplete") return "O sistema não encontrou nove competências contínuas validadas e interrompeu o detector automaticamente. Nenhuma conferência técnica é exigida do administrador.";
  if (readinessValue === "detector_not_yet_supported") return "Documentos validados; o motor específico deste perfil de fundo ainda precisa ser implementado.";
  if (readinessValue === "insufficient_official_evidence") return "A análise foi interrompida automaticamente por evidência insuficiente ou inconsistente.";
  return "A análise foi bloqueada automaticamente. Nenhuma decisão técnica é exigida do administrador.";
}

async function resolveFundFromCatalog(ticker: string): Promise<PublicFundData | null> {
  const { regulatoryDataService } = await import("@/lib/regulatoryDataService");
  return regulatoryDataService.getByTicker(ticker, { bypassCache: true });
}

export interface RiskLabTickerOrchestratorDependencies {
  resolveFund?: (ticker: string) => Promise<PublicFundData | null>;
  discovery?: CvmEventualDocumentDiscovery;
  monthlySeries?: Pick<AutomaticDividendSeriesService, "build">;
  repository?: RiskLabAutomaticScanRepository;
  now?: () => Date;
}

export class RiskLabTickerOrchestrator {
  private readonly resolveFund: (ticker: string) => Promise<PublicFundData | null>;
  private readonly discovery: CvmEventualDocumentDiscovery;
  private readonly monthlySeries: Pick<AutomaticDividendSeriesService, "build">;
  private readonly repository?: RiskLabAutomaticScanRepository;
  private readonly now: () => Date;

  constructor(dependencies: RiskLabTickerOrchestratorDependencies = {}) {
    this.resolveFund = dependencies.resolveFund || resolveFundFromCatalog;
    this.discovery = dependencies.discovery || cvmEventualDocumentDiscovery;
    this.monthlySeries = dependencies.monthlySeries || automaticDividendSeriesService;
    this.repository = dependencies.repository;
    this.now = dependencies.now || (() => new Date());
  }

  async scan(rawTicker: string, actor: string): Promise<RiskLabAutomaticScan> {
    const ticker = normalizeTicker(rawTicker);
    if (!/^[A-Z]{4}11$/.test(ticker)) throw new Error("Ticker inválido. Informe um código como MCCI11.");
    if (!actor || !actor.includes("@")) throw new Error("Responsável administrativo inválido.");

    const startedAt = this.now().toISOString();
    const fund = await this.resolveFund(ticker);
    if (!fund) throw new Error(`Ticker ${ticker} não encontrado no catálogo do Dados FII.`);
    const identity = identityFromFund(ticker, fund);
    const discovery = await this.discovery.discover(identity.cnpj, yearsForTicker(ticker, this.now().getFullYear()));

    const sourceFailures = discovery.sources.filter((source) => !source.fetched).length;
    const hardIssues = discovery.issues.filter((issue) => issue.severity === "error").length;
    const allSourcesFailed = sourceFailures === discovery.sources.length;
    let monthlySeries: AutomaticMonthlySeries | null = null;
    const automaticIssues: AutomaticValidationIssue[] = [...discovery.issues];

    if (SUPPORTED_STRESS_TICKERS.has(ticker) && !allSourcesFailed) {
      try {
        monthlySeries = await this.monthlySeries.build(ticker, discovery.documents);
        if (monthlySeries.status === "incomplete") {
          automaticIssues.push({
            code: "structured_series_incomplete",
            severity: "warning",
            message: `Série automática com ${monthlySeries.observations.length} competência(s); maior sequência contínua: ${monthlySeries.longestContiguousSequence}.`,
          });
        }
        monthlySeries.conflicts.forEach((message) => automaticIssues.push({
          code: "structured_series_validation",
          severity: monthlySeries?.status === "blocked" ? "error" : "warning",
          message,
        }));
      } catch (error) {
        automaticIssues.push({
          code: "structured_series_pipeline_failure",
          severity: "error",
          message: error instanceof Error ? error.message : "Falha desconhecida na série automática.",
        });
      }
    }

    let status: AutomaticValidationStatus;
    if (allSourcesFailed) status = "blocked";
    else if (SUPPORTED_STRESS_TICKERS.has(ticker)) {
      if (!monthlySeries || monthlySeries.status === "blocked") status = "blocked";
      else if (monthlySeries.status === "ready" && hardIssues === 0) status = "validated";
      else status = "inconclusive";
    } else {
      status = discovery.documents.length === 0 || hardIssues > 0 ? "inconclusive" : "validated";
    }

    const analysisReadiness = readiness(ticker, status, monthlySeries);
    const completedAt = this.now().toISOString();
    const hashInput = JSON.stringify({
      ticker,
      startedAt,
      sourceHashes: discovery.sources.map((source) => source.sourceHash),
      monthlyDocuments: monthlySeries?.observations.map((item) => item.source.documentId) || [],
    });

    const scan: RiskLabAutomaticScan = {
      id: `${ticker}_${createHash("sha256").update(hashInput).digest("hex").slice(0, 20)}`,
      ticker,
      startedAt,
      completedAt,
      requestedBy: actor,
      status,
      identity,
      documents: discovery.documents,
      sources: discovery.sources,
      issues: automaticIssues,
      monthlySeries,
      analysisReadiness,
      requiresHumanDocumentValidation: false,
      notificationsSent: false,
      premiumIntegrated: false,
      nextAction: nextActionFor(analysisReadiness),
    };

    return this.repository ? this.repository.save(scan) : scan;
  }
}
