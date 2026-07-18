import type {
  OutOfSampleCohort,
  OutOfSampleValidationCase,
  ValidationCaseRole,
} from "../../types/riskLabValidation";

const ROLE_COUNTS: Record<ValidationCaseRole, number> = {
  severe_deterioration: 2,
  healthy_control: 2,
  reversible_stress: 2,
};

function isIsoDate(value: string | null) {
  if (!value) return false;
  return !Number.isNaN(Date.parse(value));
}

function assertCaseShape(item: OutOfSampleValidationCase) {
  if (!/^[A-Z0-9]{4,12}$/.test(item.ticker)) {
    throw new Error(`Ticker inválido na coorte: ${item.ticker}`);
  }
  if (item.family !== "credit_high_yield") {
    throw new Error(`Família incompatível na primeira coorte: ${item.ticker}`);
  }
  if (!isIsoDate(item.analysisWindow.start)) {
    throw new Error(`Janela inicial inválida para ${item.ticker}`);
  }
  if (item.analysisWindow.end && !isIsoDate(item.analysisWindow.end)) {
    throw new Error(`Janela final inválida para ${item.ticker}`);
  }
  if (item.dataExtractionStarted) {
    throw new Error(`Extração não pode começar antes da verificação primária: ${item.ticker}`);
  }

  if (item.role === "severe_deterioration") {
    if (!item.bomb || item.stress || item.healthyControlCriterion) {
      throw new Error(`Caso grave mal configurado: ${item.ticker}`);
    }
  }

  if (item.role === "healthy_control") {
    if (item.bomb || item.stress || !item.healthyControlCriterion) {
      throw new Error(`Controle saudável mal configurado: ${item.ticker}`);
    }
  }

  if (item.role === "reversible_stress") {
    if (item.bomb || !item.stress || item.healthyControlCriterion) {
      throw new Error(`Caso reversível mal configurado: ${item.ticker}`);
    }
  }
}

export function loadOutOfSampleCohort(raw: unknown): OutOfSampleCohort {
  if (!raw || typeof raw !== "object") throw new Error("Coorte externa inválida.");
  const cohort = raw as OutOfSampleCohort;

  if (cohort.metadata.id !== "risk-lab-credit-oos-v0.1") {
    throw new Error("Identificador inesperado da coorte externa.");
  }
  if (cohort.metadata.rulesetVersion !== "0.1.0") {
    throw new Error("A primeira coorte deve usar o ruleset congelado v0.1.0.");
  }
  if (cohort.metadata.family !== "credit_high_yield") {
    throw new Error("A primeira coorte deve permanecer na família de crédito.");
  }
  if (!Array.isArray(cohort.cases) || cohort.cases.length !== 6) {
    throw new Error("A coorte externa deve possuir exatamente seis fundos.");
  }

  const tickers = new Set<string>();
  const counts: Record<ValidationCaseRole, number> = {
    severe_deterioration: 0,
    healthy_control: 0,
    reversible_stress: 0,
  };

  for (const item of cohort.cases) {
    assertCaseShape(item);
    if (tickers.has(item.ticker)) throw new Error(`Ticker duplicado: ${item.ticker}`);
    if (item.ticker === "HCTR11" || item.ticker === "TGAR11") {
      throw new Error(`${item.ticker} não pode integrar validação fora da amostra.`);
    }
    tickers.add(item.ticker);
    counts[item.role] += 1;
  }

  for (const [role, expected] of Object.entries(ROLE_COUNTS) as Array<[ValidationCaseRole, number]>) {
    if (counts[role] !== expected) {
      throw new Error(`A coorte deve conter ${expected} casos do tipo ${role}.`);
    }
  }

  if (cohort.metadata.executionAllowed) {
    assertOutOfSampleCohortReady(cohort);
  }

  return cohort;
}

export function assertOutOfSampleCohortReady(cohort: OutOfSampleCohort) {
  const pending: string[] = [];

  for (const item of cohort.cases) {
    if (item.role === "severe_deterioration") {
      const bomb = item.bomb;
      if (!bomb || bomb.status !== "primary_source_verified" || !bomb.eventDate || !bomb.primarySourceUrl) {
        pending.push(`${item.ticker}: evento material sem fonte primária confirmada`);
      }
    }

    if (item.role === "reversible_stress") {
      const stress = item.stress;
      if (
        !stress ||
        stress.status !== "primary_source_verified" ||
        !stress.stressStart ||
        !stress.stressEnd ||
        !stress.recoveryDate ||
        stress.primarySourceUrls.length === 0
      ) {
        pending.push(`${item.ticker}: janela de estresse e recuperação não confirmada`);
      }
    }
  }

  if (pending.length) {
    throw new Error(`Coorte bloqueada para execução: ${pending.join("; ")}`);
  }

  if (cohort.metadata.status !== "ready_for_execution") {
    throw new Error("Coorte verificada precisa estar marcada como ready_for_execution.");
  }
  if (!cohort.metadata.executionAllowed) {
    throw new Error("Coorte verificada ainda não foi explicitamente liberada para execução.");
  }
}
