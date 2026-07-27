import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  classifyRiskLabCategory,
  type RiskLabCategoryContext,
} from "@/lib/risk-lab/RiskLabCategoryPolicy";
import type { PremiumRiskLabReadOnly } from "../../types/premium-report";

export const RISK_LAB_PREMIUM_REGISTRY_VERSION = "premium-readonly-v1" as const;
export const RISK_LAB_PREMIUM_RULESET_VERSION = "0.2.0" as const;
export const RISK_LAB_PREMIUM_DATASET_HASH = "f18f61b7ddb5cc63955fa9791c6e5e3e43552134aaa28a9dd622a96ee587fcae" as const;
export const RISK_LAB_PREMIUM_CALIBRATION_REPORT_HASH = "22b84180531f3687c9b3ebeb691020e75e6cb608777276061997b734090d701a" as const;
export const RISK_LAB_PREMIUM_EVIDENCE_HASH = "fd695ecf4cbc759f9953ddcaf15ef14f28ba43a0b3d74098dd5cd1938baa9c81" as const;
export const RISK_LAB_PREMIUM_INDEX_HASH = "35dd492e433855e50849cba05990bb9c5255be6f209fbcce5d5a9cb832ef0017" as const;
export const RISK_LAB_PREMIUM_REGISTRY_SHA256 = "982b1c9911610eb58ad6e0af5ea6ed801063c2b9f80783a5ee9c0b45b6de9ac9" as const;

const DEFAULT_REGISTRY_PATH = "src/lib/risk-lab/risk-lab-premium-readonly-v1.json";
const HASH_PATTERN = /^[a-f0-9]{64}$/;

type VerifiedStatus = "no_qualifying_stress" | "stress_without_recovery" | "reversible_stress_confirmed";
type RegistryStatus = VerifiedStatus | "inconclusive_unscored";
type RegistryDisposition = "none" | "informational_recovery" | "elevated_risk" | "inconclusive";

type RegistryCase = {
  ticker: string;
  groundTruthStatus: "verified" | "blocked";
  outcome: "verified_correct" | "inconclusive_unscored";
  status: RegistryStatus;
  disposition: RegistryDisposition;
  riskAlert: boolean | null;
  stressDetectedAt: string | null;
  recoveryDetectedAt: string | null;
  recoveryPercentOfBaseline: number | null;
};

export type RiskLabPremiumRegistry = {
  schemaVersion: 1;
  registryVersion: typeof RISK_LAB_PREMIUM_REGISTRY_VERSION;
  phase: "3.7";
  rulesetVersion: typeof RISK_LAB_PREMIUM_RULESET_VERSION;
  dataset: { id: string; version: string; hash: string; cohortIdentityHash: string };
  evidence: { rulesetConfigHash: string; calibrationReportHash: string; calibrationEvidenceHash: string; calibrationIndexHash: string };
  policy: { readOnly: true; notificationsAllowed: false; externalEffectsAllowed: false; outsideCohort: "explicit_unavailable"; inconclusive: "preserve_unscored" };
  cases: RegistryCase[];
};

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function normalizedTicker(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export function loadRiskLabPremiumRegistry(root = process.cwd(), registryPath = DEFAULT_REGISTRY_PATH): RiskLabPremiumRegistry {
  const raw = readFileSync(path.resolve(root, registryPath), "utf8");
  const registrySha256 = createHash("sha256").update(raw, "utf8").digest("hex");
  assertCondition(registrySha256 === RISK_LAB_PREMIUM_REGISTRY_SHA256, "SHA-256 integral do registro Premium do Risk Lab divergente.");
  const registry = JSON.parse(raw) as RiskLabPremiumRegistry;
  assertCondition(registry.schemaVersion === 1, "Schema do registro Premium do Risk Lab inválido.");
  assertCondition(registry.registryVersion === RISK_LAB_PREMIUM_REGISTRY_VERSION, "Versão do registro Premium do Risk Lab divergente.");
  assertCondition(registry.phase === "3.7", "Fase do registro Premium do Risk Lab divergente.");
  assertCondition(registry.rulesetVersion === RISK_LAB_PREMIUM_RULESET_VERSION, "Ruleset Premium não corresponde ao homologado.");
  assertCondition(registry.dataset.hash === RISK_LAB_PREMIUM_DATASET_HASH, "Hash do dataset Premium do Risk Lab divergente.");
  assertCondition(HASH_PATTERN.test(registry.dataset.cohortIdentityHash), "Hash da coorte Premium inválido.");
  assertCondition(registry.evidence.calibrationReportHash === RISK_LAB_PREMIUM_CALIBRATION_REPORT_HASH, "Hash do relatório de calibração divergente.");
  assertCondition(registry.evidence.calibrationEvidenceHash === RISK_LAB_PREMIUM_EVIDENCE_HASH, "Hash da evidência de calibração divergente.");
  assertCondition(registry.evidence.calibrationIndexHash === RISK_LAB_PREMIUM_INDEX_HASH, "Hash do índice de calibração divergente.");
  assertCondition(registry.policy.readOnly === true, "Integração Premium do Risk Lab deve permanecer read-only.");
  assertCondition(registry.policy.notificationsAllowed === false, "Integração Premium do Risk Lab não pode habilitar notificações.");
  assertCondition(registry.policy.externalEffectsAllowed === false, "Integração Premium do Risk Lab não pode habilitar efeitos externos.");
  assertCondition(registry.cases.length === 6, "A coorte Premium homologada deve conter exatamente seis casos.");
  const tickers = registry.cases.map((item) => item.ticker);
  assertCondition(new Set(tickers).size === tickers.length, "Registro Premium contém ticker duplicado.");
  for (const item of registry.cases) {
    assertCondition(/^[A-Z]{4}11$/.test(item.ticker), `Ticker inválido no registro Premium: ${item.ticker}`);
    if (item.groundTruthStatus === "blocked") {
      assertCondition(item.outcome === "inconclusive_unscored" && item.status === "inconclusive_unscored" && item.disposition === "inconclusive", "Caso bloqueado não preservou a condição inconclusiva.");
      assertCondition(item.riskAlert === null, "Caso inconclusivo não pode receber alerta binário.");
    } else {
      assertCondition(item.outcome === "verified_correct", "Caso verificado diverge da homologação.");
      assertCondition(item.disposition !== "inconclusive", "Caso verificado não pode ser inconclusivo.");
      assertCondition(typeof item.riskAlert === "boolean", "Caso verificado deve possuir resultado binário de alerta.");
    }
  }
  return registry;
}

function base(
  registry: RiskLabPremiumRegistry,
  category: ReturnType<typeof classifyRiskLabCategory>,
): Pick<PremiumRiskLabReadOnly,
  "schemaVersion" | "mode" | "registryVersion" | "rulesetVersion" | "datasetId" | "datasetHash" | "evidenceHash" | "applicabilityCategory" | "categoryPolicyVersion" | "categoryCalibrated" | "readOnly" | "notificationsAllowed" | "externalEffectsAllowed"> {
  return {
    schemaVersion: 1,
    mode: "read_only",
    registryVersion: registry.registryVersion,
    rulesetVersion: registry.rulesetVersion,
    datasetId: registry.dataset.id,
    datasetHash: registry.dataset.hash,
    evidenceHash: registry.evidence.calibrationEvidenceHash,
    applicabilityCategory: category.category,
    categoryPolicyVersion: category.policyVersion,
    categoryCalibrated: category.calibrated,
    readOnly: true,
    notificationsAllowed: false,
    externalEffectsAllowed: false,
  };
}

function summaryFor(item: RegistryCase) {
  if (item.disposition === "elevated_risk") return "A série histórica homologada apresentou estresse de dividendos sem recuperação qualificada. É um sinal histórico de risco para diligência, não uma previsão nem ordem de venda.";
  if (item.disposition === "informational_recovery") return "A série histórica homologada apresentou estresse seguido de recuperação qualificada. A recuperação é informativa e não constitui sinal de compra.";
  if (item.disposition === "none") return "Nenhum estresse qualificante foi identificado na janela histórica homologada. Isso não comprova ausência de risco atual ou futuro.";
  return "A verdade-terreno deste caso permaneceu inconclusiva. O fundo foi excluído da otimização e das métricas pontuadas, sem classificação positiva ou negativa inventada.";
}

export class RiskLabPremiumReadModel {
  private readonly registry: RiskLabPremiumRegistry;
  private readonly byTicker: Map<string, RegistryCase>;

  constructor(registry: RiskLabPremiumRegistry = loadRiskLabPremiumRegistry()) {
    this.registry = registry;
    this.byTicker = new Map(registry.cases.map((item) => [item.ticker, item]));
  }

  read(value: unknown, options?: { enabled?: boolean; category?: RiskLabCategoryContext }): PremiumRiskLabReadOnly {
    const ticker = normalizedTicker(value);
    const category = this.byTicker.has(ticker)
      ? classifyRiskLabCategory({ fundKind: "fundo de papel/credito" })
      : classifyRiskLabCategory(options?.category);
    const common = base(this.registry, category);
    if (options?.enabled !== true) {
      return {
        ...common,
        availability: "disabled",
        groundTruthStatus: null,
        outcome: null,
        status: null,
        disposition: null,
        riskAlert: null,
        stressDetectedAt: null,
        recoveryDetectedAt: null,
        recoveryPercentOfBaseline: null,
        summary: "A leitura read-only do Risk Lab está desabilitada por feature flag neste ambiente.",
        limitations: ["Nenhum resultado do Risk Lab foi exposto.", "A desativação não altera o restante do Relatório Premium."],
      };
    }
    const item = this.byTicker.get(ticker);
    if (!item) {
      if (!category.calibrated) {
        return {
          ...common,
          availability: "insufficient_data",
          groundTruthStatus: null,
          outcome: null,
          status: null,
          disposition: null,
          riskAlert: null,
          stressDetectedAt: null,
          recoveryDetectedAt: null,
          recoveryPercentOfBaseline: null,
          summary: `O Risk Lab não possui calibração homologada para esta categoria. ${category.reason}`,
          limitations: [
            "Nenhum resultado de uma categoria diferente foi extrapolado para este fundo.",
            "Indisponibilidade metodológica não significa ausência de risco.",
          ],
        };
      }
      return {
        ...common,
        availability: "outside_verified_cohort",
        groundTruthStatus: null,
        outcome: null,
        status: null,
        disposition: null,
        riskAlert: null,
        stressDetectedAt: null,
        recoveryDetectedAt: null,
        recoveryPercentOfBaseline: null,
        summary: "Este fundo não pertence à coorte histórica homologada do Risk Lab. Nenhuma classificação foi inferida por semelhança.",
        limitations: ["Leitura indisponível fora da coorte verificada.", "Ausência de classificação não significa ausência de risco."],
      };
    }
    const inconclusive = item.groundTruthStatus === "blocked";
    return {
      ...common,
      availability: inconclusive ? "inconclusive" : "available",
      groundTruthStatus: item.groundTruthStatus,
      outcome: item.outcome,
      status: item.status,
      disposition: item.disposition,
      riskAlert: item.riskAlert,
      stressDetectedAt: item.stressDetectedAt,
      recoveryDetectedAt: item.recoveryDetectedAt,
      recoveryPercentOfBaseline: item.recoveryPercentOfBaseline,
      summary: summaryFor(item),
      limitations: [
        "Resultado derivado de uma coorte histórica congelada; não substitui análise atual do fundo.",
        "O sinal não dispara notificações, não altera carteira e não produz recomendação de investimento.",
      ],
    };
  }
}

export const riskLabPremiumReadModel = new RiskLabPremiumReadModel();
