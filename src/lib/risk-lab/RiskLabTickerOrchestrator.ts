import { createHash } from "node:crypto";
import { cvmEventualDocumentDiscovery, type CvmEventualDocumentDiscovery } from "@/lib/risk-lab/CvmEventualDocumentDiscovery";
import { regulatoryDataService } from "@/lib/regulatoryDataService";
import type { PublicFundData } from "@/types/regulatory";
import type {
  AutomaticAnalysisReadiness,
  AutomaticFundIdentity,
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

function readiness(ticker: string, status: AutomaticValidationStatus): AutomaticAnalysisReadiness {
  if (status === "blocked") return "blocked";
  if (status !== "validated") return "insufficient_official_evidence";
  if (HISTORICAL_UNIT_TICKERS.has(ticker)) return "historical_unit_available";
  if (SUPPORTED_STRESS_TICKERS.has(ticker)) return "documents_validated_waiting_structured_dividends";
  return "detector_not_yet_supported";
}

function nextActionFor(readinessValue: AutomaticAnalysisReadiness) {
  if (readinessValue === "historical_unit_available") return "O sistema pode executar o marco histórico unitário já aprovado.";
  if (readinessValue === "documents_validated_waiting_structured_dividends") return "O sistema deve extrair automaticamente a série mensal estruturada antes de executar o detector.";
  if (readinessValue === "detector_not_yet_supported") return "Documentos validados; o motor específico deste perfil de fundo ainda precisa ser implementado.";
  if (readinessValue === "insufficient_official_evidence") return "A análise foi interrompida automaticamente por evidência insuficiente ou inconsistente.";
  return "A análise foi bloqueada automaticamente. Nenhuma decisão técnica é exigida do administrador.";
}

export interface RiskLabTickerOrchestratorDependencies {
  resolveFund?: (ticker: string) => Promise<PublicFundData | null>;
  discovery?: CvmEventualDocumentDiscovery;
  repository?: RiskLabAutomaticScanRepository;
  now?: () => Date;
}

export class RiskLabTickerOrchestrator {
  private readonly resolveFund: (ticker: string) => Promise<PublicFundData | null>;
  private readonly discovery: CvmEventualDocumentDiscovery;
  private readonly repository?: RiskLabAutomaticScanRepository;
  private readonly now: () => Date;

  constructor(dependencies: RiskLabTickerOrchestratorDependencies = {}) {
    this.resolveFund = dependencies.resolveFund || ((ticker) => regulatoryDataService.getByTicker(ticker, { bypassCache: true }));
    this.discovery = dependencies.discovery || cvmEventualDocumentDiscovery;
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
    const status: AutomaticValidationStatus = sourceFailures === discovery.sources.length
      ? "blocked"
      : discovery.documents.length === 0 || hardIssues > 0
        ? "inconclusive"
        : "validated";
    const analysisReadiness = readiness(ticker, status);
    const completedAt = this.now().toISOString();
    const hashInput = JSON.stringify({ ticker, startedAt, sourceHashes: discovery.sources.map((source) => source.sourceHash) });

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
      issues: discovery.issues,
      analysisReadiness,
      requiresHumanDocumentValidation: false,
      notificationsSent: false,
      premiumIntegrated: false,
      nextAction: nextActionFor(analysisReadiness),
    };

    return this.repository ? this.repository.save(scan) : scan;
  }
}
