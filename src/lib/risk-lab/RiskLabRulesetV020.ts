import { readFileSync } from "node:fs";
import path from "node:path";
import { dividendStressWindowEngine } from "./DividendStressWindowEngine";
import type {
  DividendStressStatus,
  DividendStressWindow,
  VerifiedDividendNotice,
  VerifiedMaterialCreditEvent,
} from "../../types/riskLabDividendStress";

export type RiskLabDisposition = "none" | "informational_recovery" | "elevated_risk";

export interface RiskLabRulesetV020Config {
  schemaVersion: 1;
  phase: "3.6";
  rulesetVersion: "0.2.0";
  sourceRulesetVersion: "0.1.0";
  dataset: {
    id: string;
    version: string;
    hash: string;
    cohortIdentityHash: string;
  };
  structure: {
    baselineMonths: 6;
    stressMonths: 3;
    recoveryMonths: 3;
  };
  candidateSpace: {
    stressThresholds: number[];
    recoveryThresholds: number[];
    minimumRecoveryDecisionMargin: number;
  };
  selection: {
    validationProtocol: "leave-one-verified-case-out";
    priority: string[];
  };
  selectedParameters: {
    stressThreshold: number;
    recoveryThreshold: number;
  };
  policy: {
    riskAlertStatuses: DividendStressStatus[];
    informationalStatuses: DividendStressStatus[];
    inconclusiveGroundTruth: "exclude_from_optimization_and_scored_metrics";
    externalEffectsAllowed: false;
  };
}

export interface RiskLabRulesetEvaluation {
  rulesetVersion: "0.2.0";
  evaluatedAsOf: string | null;
  window: DividendStressWindow;
  disposition: RiskLabDisposition;
  riskAlert: boolean;
  externalEffectsAllowed: false;
}

const DEFAULT_CONFIG_PATH = "src/lib/risk-lab/risk-lab-ruleset-v0.2.0.json";
const HASH_PATTERN = /^[a-f0-9]{64}$/;

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isIsoDate(value: string) {
  return !Number.isNaN(Date.parse(value));
}

export function loadRiskLabRulesetV020Config(
  root = process.cwd(),
  configPath = DEFAULT_CONFIG_PATH,
): RiskLabRulesetV020Config {
  const config = JSON.parse(readFileSync(path.resolve(root, configPath), "utf8")) as RiskLabRulesetV020Config;
  assertCondition(config.schemaVersion === 1, "Schema do ruleset v0.2.0 inválido.");
  assertCondition(config.phase === "3.6", "Fase do ruleset v0.2.0 inválida.");
  assertCondition(config.rulesetVersion === "0.2.0", "Versão do ruleset calibrado inválida.");
  assertCondition(config.sourceRulesetVersion === "0.1.0", "Ruleset de origem divergente.");
  assertCondition(HASH_PATTERN.test(config.dataset.hash), "Hash do dataset calibrado inválido.");
  assertCondition(HASH_PATTERN.test(config.dataset.cohortIdentityHash), "Hash da coorte calibrada inválido.");
  assertCondition(
    config.structure.baselineMonths === 6
      && config.structure.stressMonths === 3
      && config.structure.recoveryMonths === 3,
    "A calibração não pode alterar silenciosamente a estrutura 6-3-3.",
  );
  assertCondition(
    config.candidateSpace.stressThresholds.length === 1
      && config.candidateSpace.stressThresholds[0] === 0.8,
    "O espaço de calibração não pode alterar o limiar de estresse congelado.",
  );
  assertCondition(
    config.candidateSpace.recoveryThresholds.length === 10
      && config.candidateSpace.recoveryThresholds[0] === 0.81
      && config.candidateSpace.recoveryThresholds[9] === 0.9,
    "Espaço de recuperação não corresponde ao protocolo pré-registrado.",
  );
  assertCondition(
    config.candidateSpace.minimumRecoveryDecisionMargin === 0.005,
    "Margem mínima de recuperação divergente.",
  );
  assertCondition(config.selectedParameters.stressThreshold === 0.8, "Limiar de estresse selecionado divergente.");
  assertCondition(config.selectedParameters.recoveryThreshold === 0.89, "Limiar de recuperação selecionado divergente.");
  assertCondition(config.policy.externalEffectsAllowed === false, "O ruleset 3.6 não pode habilitar efeitos externos.");
  assertCondition(
    config.policy.inconclusiveGroundTruth === "exclude_from_optimization_and_scored_metrics",
    "Política de verdade-terreno inconclusiva divergente.",
  );
  return config;
}

export function dispositionForDividendStressStatus(
  status: DividendStressStatus,
  config: RiskLabRulesetV020Config = loadRiskLabRulesetV020Config(),
): RiskLabDisposition {
  if (config.policy.riskAlertStatuses.includes(status)) return "elevated_risk";
  if (config.policy.informationalStatuses.includes(status)) return "informational_recovery";
  return "none";
}

export class RiskLabRulesetV020 {
  private readonly config: RiskLabRulesetV020Config;

  constructor(config: RiskLabRulesetV020Config = loadRiskLabRulesetV020Config()) {
    this.config = config;
  }

  get version() {
    return this.config.rulesetVersion;
  }

  get parameters() {
    return { ...this.config.selectedParameters };
  }

  evaluate(
    notices: VerifiedDividendNotice[],
    creditEvents: VerifiedMaterialCreditEvent[] = [],
  ): RiskLabRulesetEvaluation {
    const window = dividendStressWindowEngine.detect(notices, {
      stressThreshold: this.config.selectedParameters.stressThreshold,
      recoveryThreshold: this.config.selectedParameters.recoveryThreshold,
      creditEvents,
    });
    const disposition = dispositionForDividendStressStatus(window.status, this.config);
    return {
      rulesetVersion: "0.2.0",
      evaluatedAsOf: null,
      window,
      disposition,
      riskAlert: disposition === "elevated_risk",
      externalEffectsAllowed: false,
    };
  }

  evaluateAsOf(
    notices: VerifiedDividendNotice[],
    creditEvents: VerifiedMaterialCreditEvent[],
    asOf: string,
  ): RiskLabRulesetEvaluation {
    assertCondition(isIsoDate(asOf), `Data de corte inválida: ${asOf}`);
    const asOfTime = Date.parse(asOf);
    const knownNotices = notices.filter((item) => Date.parse(item.announcedAt) <= asOfTime);
    const knownEvents = creditEvents.filter((item) => Date.parse(item.knownAt) <= asOfTime);
    assertCondition(knownNotices.length > 0, "Nenhuma observação era conhecida na data de corte.");
    const result = this.evaluate(knownNotices, knownEvents);
    if (result.window.stressDetectedAt) {
      assertCondition(Date.parse(result.window.stressDetectedAt) <= asOfTime, "Look-ahead detectado no estresse.");
    }
    if (result.window.recoveryDetectedAt) {
      assertCondition(Date.parse(result.window.recoveryDetectedAt) <= asOfTime, "Look-ahead detectado na recuperação.");
    }
    return { ...result, evaluatedAsOf: asOf };
  }
}

export const riskLabRulesetV020 = new RiskLabRulesetV020();
