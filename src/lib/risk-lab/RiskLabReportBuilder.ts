import { createHash } from "node:crypto";
import type { MetricObservation, RiskRule, RiskSnapshot } from "../../types/riskLab";
import type { RiskLabEvidenceItem, RiskLabReport } from "../../types/riskLabProduction";
import { loadRiskDataset } from "./DatasetLoader";
import { RiskRuleEngine } from "./RuleEngine";
import { PILOT_RISK_RULES } from "./rules";

export const RISK_LAB_RULESET_VERSION = "0.1.0";
export const RISK_LAB_RULESET_STATUS = "frozen_out_of_sample_validation" as const;
export const RISK_LAB_RULESET_FROZEN_AT = "2026-07-18T06:00:00.000Z";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

export function riskLabContentHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableValue(value)), "utf8").digest("hex");
}

function rulesFingerprint(rules: RiskRule[]) {
  return rules.map((rule) => ({
    id: rule.id,
    version: rule.version,
    title: rule.title,
    description: rule.description,
    dimension: rule.dimension,
    alert: rule.alert,
    weight: rule.weight,
    families: rule.families,
  }));
}

function latestSnapshot(snapshots: RiskSnapshot[], ticker: string) {
  return snapshots
    .filter((snapshot) => snapshot.ticker === ticker)
    .sort((left, right) => Date.parse(right.asOf) - Date.parse(left.asOf))[0] ?? null;
}

function evidenceItems(snapshot: RiskSnapshot, metrics: string[]) {
  const seen = new Set<string>();
  const items: RiskLabEvidenceItem[] = [];

  for (const metric of metrics) {
    const observation: MetricObservation | undefined = snapshot.observations[metric];
    if (!observation) continue;
    for (const evidence of observation.evidence) {
      if (!evidence.sourceUrl || !evidence.sourceType || !evidence.page || !evidence.excerpt || !evidence.publishedAt) {
        throw new Error(`Gold evidence is incomplete for ${snapshot.ticker}/${metric}`);
      }
      if (evidence.sourceType !== "primary_regulatory" && evidence.sourceType !== "primary_manager") {
        throw new Error(`Non-primary evidence reached production for ${snapshot.ticker}/${metric}`);
      }
      const key = `${metric}:${evidence.documentId}:${evidence.page}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        metric,
        value: observation.value,
        unit: observation.unit,
        competenceDate: observation.competenceDate,
        knownAt: observation.knownAt,
        confidence: observation.confidence,
        documentId: evidence.documentId,
        sourceUrl: evidence.sourceUrl,
        sourceType: evidence.sourceType,
        page: evidence.page,
        excerpt: evidence.excerpt,
        publishedAt: evidence.publishedAt,
      });
    }
  }
  return items;
}

function prudentialAction(alert: RiskLabReport["assessment"]["prudentialAlert"]) {
  if (alert === "red") return "Tese comprometida no marco histórico analisado. Suspender aportes e avaliar redução ou saída, considerando preço, liquidez e situação pessoal.";
  if (alert === "orange") return "Deterioração material. Não aumentar a posição e revisar o tamanho da exposição.";
  if (alert === "yellow") return "Risco crescente. Suspender novos aportes e acompanhar as próximas evidências.";
  if (alert === "gray") return "Dados insuficientes para conclusão prudencial.";
  return "Nenhuma ação prudencial extraordinária foi acionada por este recorte.";
}

function buildMarkdown(report: Omit<RiskLabReport, "reportMarkdown">) {
  const rules = report.assessment.hits.length
    ? report.assessment.hits.map((hit) => `- **${hit.ruleId} — ${hit.title}:** ${hit.message} (confiança da evidência ${hit.confidence}%)`).join("\n")
    : "- Nenhuma regra acionada.";
  const evidence = report.evidence.length
    ? report.evidence.map((item) => `- **${item.metric}:** ${String(item.value)} ${item.unit || ""} — página ${item.page}. ${item.excerpt} Fonte: ${item.sourceUrl}`).join("\n")
    : "- Nenhuma evidência material vinculada.";

  return `# Risk Lab — ${report.ticker}\n\n` +
    `**Modo:** teste histórico administrativo com dataset ouro\n\n` +
    `**Data do marco analisado:** ${report.assessment.asOf}\n\n` +
    `**Alerta prudencial:** ${report.assessment.prudentialAlert.toUpperCase()}\n\n` +
    `**Alerta de deterioração:** ${report.assessment.deteriorationAlert.toUpperCase()}\n\n` +
    `**Risco estrutural:** ${report.assessment.structuralRisk}\n\n` +
    `**Severidade da deterioração:** ${report.assessment.deteriorationSeverityScore}/100 — quanto maior, pior\n\n` +
    `**Saúde estimada da tese:** ${report.assessment.thesisHealthScore}/100 — quanto maior, melhor\n\n` +
    `**Confiança nas evidências e no diagnóstico:** ${report.assessment.evidenceConfidence}%\n\n` +
    `**Confiança na gestão:** não calculada neste piloto\n\n` +
    `**Regras congeladas:** v${report.ruleSet.version}, desde ${report.ruleSet.frozenAt}\n\n` +
    `## Regras acionadas\n\n${rules}\n\n` +
    `## Evidências verificadas\n\n${evidence}\n\n` +
    `## Ação prudencial\n\n${prudentialAction(report.assessment.prudentialAlert)}\n\n` +
    `## Limitações\n\n` +
    `- Este relatório reproduz um marco histórico já validado; não representa uma análise corrente do fundo.\n` +
    `- A confiança exibida mede a confiabilidade das evidências e do diagnóstico, não a qualidade do fundo ou da gestão.\n` +
    `- A nota de saúde da tese é derivada da severidade de deterioração e ainda não incorpora uma nota própria de governança.\n` +
    `- As regras v${report.ruleSet.version} estão congeladas para validação fora da amostra.\n` +
    `- Não está integrado ao Relatório Premium.\n` +
    `- Não envia notificações e não altera nenhuma recomendação pública.\n` +
    `- A decisão de investimento continua sendo do investidor.\n`;
}

export function buildRiskLabReport(
  rawDataset: unknown,
  requestedTicker: string,
  actor: string,
  generatedAt = new Date().toISOString(),
): RiskLabReport {
  const ticker = requestedTicker.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(ticker)) throw new Error("Ticker inválido para o Risk Lab.");
  if (!actor.trim()) throw new Error("Responsável administrativo obrigatório.");

  const dataset = loadRiskDataset(rawDataset);
  const approval = dataset.metadata.productionApproval;
  if (!dataset.metadata.productionApproved || !approval) {
    throw new Error("Dataset não aprovado para execução em produção.");
  }
  if (approval.scope !== "admin_unit_test_only") {
    throw new Error("Escopo de produção incompatível com o teste administrativo.");
  }
  if (!approval.allowedTickers.includes(ticker)) {
    throw new Error(`Ticker ${ticker} não autorizado neste dataset.`);
  }

  const snapshot = latestSnapshot(dataset.snapshots, ticker);
  if (!snapshot) throw new Error(`Snapshot aprovado não encontrado para ${ticker}.`);

  const assessment = new RiskRuleEngine(PILOT_RISK_RULES).evaluate(snapshot);
  const metrics = [...new Set(assessment.hits.flatMap((hit) => hit.evidenceMetrics))];
  const evidence = evidenceItems(snapshot, metrics);
  const datasetHash = riskLabContentHash(dataset);
  const ruleSetHash = riskLabContentHash(rulesFingerprint(PILOT_RISK_RULES));
  const compactDate = generatedAt.replace(/[^0-9]/g, "").slice(0, 14);
  const id = `risk-${ticker}-${compactDate}-${riskLabContentHash({ ticker, generatedAt, datasetHash, ruleSetHash }).slice(0, 10)}`;

  const core: Omit<RiskLabReport, "reportMarkdown"> = {
    id,
    schemaVersion: 1,
    status: "completed",
    ticker,
    mode: "historical_gold_admin_test",
    generatedAt,
    generatedBy: actor.trim().toLowerCase(),
    dataset: {
      id: dataset.metadata.id,
      version: dataset.metadata.version,
      quality: dataset.metadata.quality,
      contentHash: datasetHash,
      approvalHash: approval.approvalHash,
      scope: approval.scope,
    },
    ruleSet: {
      version: RISK_LAB_RULESET_VERSION,
      contentHash: ruleSetHash,
      status: RISK_LAB_RULESET_STATUS,
      frozenAt: RISK_LAB_RULESET_FROZEN_AT,
    },
    assessment,
    evidence,
    premiumIntegrated: false,
    notificationsSent: false,
    productionScope: "admin_unit_test_only",
  };

  return { ...core, reportMarkdown: buildMarkdown(core) };
}
