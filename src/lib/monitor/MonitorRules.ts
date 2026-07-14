import { createHash } from "crypto";
import type { MonitorAlert } from "../../types/monitor";
import type { ParserHealth, SystemHealth, ValidationRun } from "../../types/regulatory";

type RuleInput = {
  health: SystemHealth;
  parsers: ParserHealth[];
  latestValidation: ValidationRun | null;
};

function fingerprint(code: string, component: string) {
  return createHash("sha256").update(`${code}:${component}`, "utf8").digest("hex").slice(0, 32);
}

function alert(code: string, component: string, title: string, message: string, severity: MonitorAlert["severity"], metadata: MonitorAlert["metadata"], detectedAt: string): MonitorAlert {
  return { fingerprint: fingerprint(code, component), code, component, title, message, severity, status: "active", detectedAt, metadata };
}

export function evaluateMonitorAlerts(input: RuleInput, detectedAt = new Date().toISOString()) {
  const alerts: MonitorAlert[] = [];
  if (!input.health.ok) {
    alerts.push(alert("system-health", "system", "Saúde sistêmica degradada", `Health Score em ${input.health.score}% (${input.health.status}).`, input.health.status === "down" || input.health.score < 50 ? "critical" : "warning", { healthScore: input.health.score, status: input.health.status }, detectedAt));
  }
  for (const [component, state] of Object.entries(input.health.components)) {
    if (state.status === "down" || state.status === "degraded") {
      alerts.push(alert(`component-${state.status}`, component, `${component} ${state.status}`, state.message, state.status === "down" ? "critical" : "warning", { score: state.score, status: state.status }, detectedAt));
    }
  }
  for (const parser of input.parsers) {
    if (parser.status === "down" || parser.status === "degraded") {
      alerts.push(alert(`parser-${parser.status}`, parser.parser, `Parser ${parser.parser} ${parser.status}`, parser.lastError || `Taxa de sucesso em ${parser.successRate}%.`, parser.status === "down" ? "critical" : "warning", { successRate: parser.successRate, failures: parser.failures }, detectedAt));
    }
  }
  if (!input.latestValidation) {
    alerts.push(alert("validation-missing", "qa", "Validação ainda não executada", "Não existe histórico de validação para confirmar a qualidade da base.", "warning", {}, detectedAt));
  } else if (input.latestValidation.status === "failed" || input.latestValidation.healthScore < 70) {
    alerts.push(alert("validation-unhealthy", "qa", "Validação com falhas", `Última validação: ${input.latestValidation.status}, Health ${input.latestValidation.healthScore}%, ${input.latestValidation.totals.errors} erro(s).`, input.latestValidation.status === "failed" || input.latestValidation.healthScore < 50 ? "critical" : "warning", { healthScore: input.latestValidation.healthScore, errors: input.latestValidation.totals.errors }, detectedAt));
  }
  return Array.from(new Map(alerts.map((item) => [item.fingerprint, item])).values());
}
