import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { dividendStressWindowEngine } from "@/lib/risk-lab/DividendStressWindowEngine";
import { derivePrimaryStressTruth } from "@/lib/risk-lab/CohortPrimaryVerificationService";
import type {
  DividendStressWindow,
  VerifiedDividendNotice,
  VerifiedMaterialCreditEvent,
} from "@/types/riskLabDividendStress";

export type FrozenCohortRole = "severe_deterioration" | "healthy_control" | "reversible_stress";
export type FrozenCohortOutcome = "true_positive" | "true_negative" | "false_positive" | "false_negative" | "inconclusive";
export type PhaseCStatus = "completed" | "completed_requires_calibration" | "blocked";

export interface FrozenCohortRegistryCase {
  ticker: string;
  cnpj: string;
  role: FrozenCohortRole;
  fromDate: string;
  untilDate: string;
  indexPath: string;
  expectedEvidenceHash: string;
  expectedCombinedObservationsHash: string;
}

export interface FrozenCriticalDocumentEvidence {
  documentId: string;
  receivedAt: string;
  sourceUrl: string;
  status: "extracted" | "failed";
  sourceHash?: string;
  textHash?: string;
  matches: Array<{ type: VerifiedMaterialCreditEvent["type"]; term: string; excerpt: string }>;
  error?: string;
}

export interface FrozenPrimaryTruthCase {
  ticker: string;
  catalogCoverageComplete: boolean;
  catalogDocumentCount: number;
  catalogDocumentsHash: string;
  catalogScreenHash: string;
  criticalDocuments: FrozenCriticalDocumentEvidence[];
  materialEvent?: {
    documentId: string;
    knownAt: string;
    type: VerifiedMaterialCreditEvent["type"];
    sourceUrl: string;
    sourceHash: string;
    textHash: string;
    term: string;
    excerpt: string;
  } | null;
}

export interface FrozenCohortRegistry {
  schemaVersion: 1;
  datasetId: string;
  datasetVersion: string;
  methodologyVersion: string;
  rulesetVersion: string;
  evaluatedAt: string;
  expectedCohortIdentityHash: string;
  sourceCatalogs: Array<{ year: number; sourceHash: string }>;
  provenance: {
    sourceCoverage: { workflowRunId: number; artifactId: number; artifactDigest: string; artifactHash: string };
    dividendWindows: { workflowRunId: number; artifactId: number; artifactDigest: string; artifactHash: string };
    criticalPdfs: { artifacts: Array<{ workflowRunId: number; artifactId: number; artifactDigest: string; artifactHash: string }> };
  };
  cases: FrozenCohortRegistryCase[];
  primaryTruth: FrozenPrimaryTruthCase[];
}

interface AnnualObservationDescriptor {
  file: string;
  year: string;
  count: number;
  observationsHash: string;
}

interface FrozenCaseIndex {
  schemaVersion: number;
  phase: string;
  status: string;
  identity: {
    ticker: string;
    cnpj: string;
    role: FrozenCohortRole;
    fromDate: string;
    untilDate: string;
  };
  result: {
    pendingDocuments: number;
    conflicts: number;
    missingMonths: string[];
    longestContiguousSequence: number;
    selectedMonthlyObservations: number;
  };
  observationFiles: AnnualObservationDescriptor[];
  combinedObservationsHash: string;
  evidenceHash: string;
  [key: string]: unknown;
}

interface RawFrozenObservation {
  ticker: string;
  competenceMonth: string;
  amountPerShare: number;
  announcedAt: string;
  receivedAt: string;
  documentId: string;
  sourceUrl: string;
  page: number;
  excerpt: string;
  sourceHash: string;
  sourceVersion: string;
  protocolHash: string;
  protocolVersion: number;
  [key: string]: unknown;
}

export interface FrozenTimelinePoint {
  asOf: string;
  observationsKnown: number;
  detectorStatus: DividendStressWindow["status"];
  stressDetectedAt: string | null;
  recoveryDetectedAt: string | null;
}

export interface FrozenGroundTruth {
  status: "verified" | "blocked";
  eventAt: string | null;
  stressAt: string | null;
  recoveryAt: string | null;
  evidence: Array<{
    kind: "material_event" | "catalog_coverage" | "critical_document" | "dividend_series";
    documentId: string;
    knownAt: string;
    sourceUrl: string;
    sourceHash: string;
    textHash: string | null;
    excerpt: string;
  }>;
  blockers: string[];
  verificationHash: string;
}

export interface FrozenCaseBacktestResult {
  ticker: string;
  role: FrozenCohortRole;
  indexPath: string;
  indexEvidenceHash: string;
  combinedObservationsHash: string;
  observations: number;
  missingMonths: string[];
  longestContiguousSequence: number;
  firstSignalAt: string | null;
  finalDetector: DividendStressWindow;
  timeline: FrozenTimelinePoint[];
  groundTruth: FrozenGroundTruth;
  outcome: FrozenCohortOutcome;
  leadTimeDays: number | null;
  lookAheadDetected: boolean;
  blockers: string[];
  premiumIntegrated: false;
  notificationsSent: false;
}

export interface FrozenCohortMetrics {
  totalCases: number;
  conclusiveCases: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  inconclusiveCases: number;
  coveragePercent: number;
  averageLeadTimeDays: number | null;
  minimumLeadTimeDays: number | null;
  maximumLeadTimeDays: number | null;
}

export interface FrozenCohortCheck {
  id: string;
  status: "passed" | "failed";
  message: string;
  metadata: Record<string, unknown>;
}

export interface FrozenCohortPhaseCResult {
  schemaVersion: 1;
  phase: "3.5-C";
  datasetId: string;
  datasetVersion: string;
  methodologyVersion: string;
  rulesetVersion: string;
  evaluatedAt: string;
  status: PhaseCStatus;
  cohortIdentityHash: string;
  datasetHash: string;
  observationCount: number;
  cases: FrozenCaseBacktestResult[];
  metrics: FrozenCohortMetrics;
  methodologyChecks: FrozenCohortCheck[];
  performanceFindings: string[];
  methodologicalBlockers: string[];
  calibrationRequired: boolean;
  homologationAllowed: false;
  premiumIntegrated: false;
  notificationsSent: false;
  evidenceHash: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPECTED_TICKERS = ["DEVA11", "VSLH11", "KNCR11", "KNSC11", "MCCI11", "RBRY11"];

export function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

export function hashValue(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableValue(value)), "utf8").digest("hex");
}

function readJson<T>(root: string, file: string): T {
  return JSON.parse(readFileSync(path.resolve(root, file), "utf8")) as T;
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function toVerifiedNotice(item: RawFrozenObservation, evaluatedAt: string): VerifiedDividendNotice {
  return {
    ticker: item.ticker,
    competenceMonth: item.competenceMonth,
    amountPerShare: item.amountPerShare,
    announcedAt: item.announcedAt,
    source: {
      documentId: item.documentId,
      sourceUrl: item.sourceUrl,
      sourceType: "primary_regulatory",
      reviewMethod: "automatic_regulatory_validation",
      reviewedBy: "risk-lab-frozen-cohort-phase-c-v1",
      reviewedAt: evaluatedAt,
      page: item.page || 1,
      excerpt: item.excerpt,
      sourceHash: item.sourceHash,
      sourceVersion: item.sourceVersion,
      protocolHash: item.protocolHash,
      protocolVersion: item.protocolVersion,
    },
  };
}

function loadCase(root: string, registry: FrozenCohortRegistry, item: FrozenCohortRegistryCase) {
  const index = readJson<FrozenCaseIndex>(root, item.indexPath);
  assertCondition(index.schemaVersion === 1, `${item.ticker}: schema do índice inválido.`);
  assertCondition(index.status === "complete", `${item.ticker}: caso individual não está completo.`);
  assertCondition(index.identity.ticker === item.ticker, `${item.ticker}: ticker divergente no índice.`);
  assertCondition(index.identity.cnpj === item.cnpj, `${item.ticker}: CNPJ divergente no índice.`);
  assertCondition(index.identity.role === item.role, `${item.ticker}: papel divergente no índice.`);
  assertCondition(index.identity.fromDate === item.fromDate, `${item.ticker}: início de janela divergente.`);
  assertCondition(index.identity.untilDate === item.untilDate, `${item.ticker}: fim de janela divergente.`);
  assertCondition(index.result.pendingDocuments === 0, `${item.ticker}: existem documentos pendentes.`);
  assertCondition(index.result.conflicts === 0, `${item.ticker}: existem conflitos.`);

  const indexPayload = { ...index };
  delete indexPayload.evidenceHash;
  assertCondition(hashValue(indexPayload) === index.evidenceHash, `${item.ticker}: evidenceHash do índice divergente.`);
  assertCondition(index.evidenceHash === item.expectedEvidenceHash, `${item.ticker}: evidenceHash não corresponde ao registro congelado.`);

  const raw: RawFrozenObservation[] = [];
  for (const descriptor of index.observationFiles) {
    const payload = readJson<{ schemaVersion: number; phase: string; ticker: string; year: string; observations: RawFrozenObservation[] }>(root, descriptor.file);
    assertCondition(payload.schemaVersion === 1, `${descriptor.file}: schema anual inválido.`);
    assertCondition(payload.phase === index.phase, `${descriptor.file}: fase anual divergente.`);
    assertCondition(payload.ticker === item.ticker, `${descriptor.file}: ticker anual divergente.`);
    assertCondition(payload.year === descriptor.year, `${descriptor.file}: ano divergente.`);
    assertCondition(payload.observations.length === descriptor.count, `${descriptor.file}: contagem anual divergente.`);
    assertCondition(hashValue(payload.observations) === descriptor.observationsHash, `${descriptor.file}: hash anual divergente.`);
    raw.push(...payload.observations);
  }
  assertCondition(hashValue(raw) === index.combinedObservationsHash, `${item.ticker}: hash combinado divergente.`);
  assertCondition(index.combinedObservationsHash === item.expectedCombinedObservationsHash, `${item.ticker}: hash combinado não corresponde ao registro congelado.`);
  assertCondition(raw.length === index.result.selectedMonthlyObservations, `${item.ticker}: total de observações divergente.`);

  const notices = raw.map((observation) => toVerifiedNotice(observation, registry.evaluatedAt));
  return { index, raw, notices };
}

export function buildFrozenTimeline(notices: VerifiedDividendNotice[]) {
  const orderedAsOf = [...new Set(notices.map((item) => item.announcedAt))]
    .sort((left, right) => Date.parse(left) - Date.parse(right));
  const points: FrozenTimelinePoint[] = [];
  let firstSignalAt: string | null = null;
  let lookAheadDetected = false;
  let lastSignature = "";

  for (const asOf of orderedAsOf) {
    const known = notices.filter((item) => Date.parse(item.announcedAt) <= Date.parse(asOf));
    if (known.some((item) => Date.parse(item.announcedAt) > Date.parse(asOf))) lookAheadDetected = true;
    const result = dividendStressWindowEngine.detect(known);
    if (result.stressDetectedAt && Date.parse(result.stressDetectedAt) > Date.parse(asOf)) lookAheadDetected = true;
    if (result.recoveryDetectedAt && Date.parse(result.recoveryDetectedAt) > Date.parse(asOf)) lookAheadDetected = true;
    if (!firstSignalAt && result.status !== "no_qualifying_stress") firstSignalAt = result.stressDetectedAt || asOf;
    const signature = `${result.status}|${result.stressDetectedAt || ""}|${result.recoveryDetectedAt || ""}`;
    if (signature !== lastSignature) {
      points.push({
        asOf,
        observationsKnown: known.length,
        detectorStatus: result.status,
        stressDetectedAt: result.stressDetectedAt,
        recoveryDetectedAt: result.recoveryDetectedAt,
      });
      lastSignature = signature;
    }
  }

  return {
    points,
    firstSignalAt,
    finalDetector: dividendStressWindowEngine.detect(notices),
    lookAheadDetected,
  };
}

function criticalEvidence(truth: FrozenPrimaryTruthCase) {
  return truth.criticalDocuments
    .filter((document) => document.status === "extracted")
    .map((document) => ({
      kind: "critical_document" as const,
      documentId: document.documentId,
      knownAt: document.receivedAt,
      sourceUrl: document.sourceUrl,
      sourceHash: document.sourceHash || "",
      textHash: document.textHash || null,
      excerpt: document.matches[0]?.excerpt || "Documento crítico extraído sem termo material reconhecido.",
    }));
}

function groundTruth(
  item: FrozenCohortRegistryCase,
  truth: FrozenPrimaryTruthCase,
  notices: VerifiedDividendNotice[],
): FrozenGroundTruth {
  const blockers: string[] = [];
  const evidence: FrozenGroundTruth["evidence"] = [
    {
      kind: "catalog_coverage" as const,
      documentId: `CVM:${item.ticker}`,
      knownAt: item.untilDate,
      sourceUrl: "https://dados.cvm.gov.br/dados/FI/DOC/EVENTUAL/DADOS/",
      sourceHash: truth.catalogDocumentsHash,
      textHash: null,
      excerpt: `${truth.catalogDocumentCount} documentos do fundo foram indexados com cobertura anual completa.`,
    },
    ...criticalEvidence(truth),
    {
      kind: "dividend_series" as const,
      documentId: `${item.ticker}:DIVIDEND-SERIES`,
      knownAt: notices.at(-1)?.announcedAt || item.untilDate,
      sourceUrl: notices.at(-1)?.source.sourceUrl || "https://fnet.bmfbovespa.com.br/",
      sourceHash: hashValue(notices.map((notice) => ({
        competenceMonth: notice.competenceMonth,
        announcedAt: notice.announcedAt,
        sourceHash: notice.source.sourceHash,
      }))),
      textHash: null,
      excerpt: `${notices.length} observações mensais primárias congeladas.`,
    },
  ];

  if (!truth.catalogCoverageComplete) blockers.push("Cobertura anual do catálogo CVM incompleta.");
  if (truth.criticalDocuments.some((document) => document.status !== "extracted")) {
    blockers.push("Um ou mais documentos críticos não puderam ser extraídos de forma determinística.");
  }

  let eventAt: string | null = null;
  let stressAt: string | null = null;
  let recoveryAt: string | null = null;

  if (item.role === "severe_deterioration") {
    if (!truth.materialEvent) blockers.push("Evento material primário não verificado para o caso grave.");
    else {
      eventAt = truth.materialEvent.knownAt;
      evidence.push({
        kind: "material_event",
        documentId: truth.materialEvent.documentId,
        knownAt: truth.materialEvent.knownAt,
        sourceUrl: truth.materialEvent.sourceUrl,
        sourceHash: truth.materialEvent.sourceHash,
        textHash: truth.materialEvent.textHash,
        excerpt: truth.materialEvent.excerpt,
      });
    }
  } else {
    const materialMatches = truth.criticalDocuments.flatMap((document) => document.matches);
    if (materialMatches.length > 0) blockers.push("Documento crítico contém evento material incompatível com o rótulo pré-registrado.");
  }

  if (item.role === "reversible_stress") {
    const derived = derivePrimaryStressTruth(notices);
    stressAt = derived.stressAt;
    recoveryAt = derived.recoveryAt;
    if (!stressAt || !recoveryAt) blockers.push("A série primária não confirmou estresse reversível segundo a definição pré-registrada.");
  }

  const identity = {
    ticker: item.ticker,
    role: item.role,
    eventAt,
    stressAt,
    recoveryAt,
    evidence: evidence.map((entry) => ({
      kind: entry.kind,
      documentId: entry.documentId,
      knownAt: entry.knownAt,
      sourceHash: entry.sourceHash,
      textHash: entry.textHash,
    })),
    blockers,
  };
  return {
    status: blockers.length === 0 ? "verified" : "blocked",
    eventAt,
    stressAt,
    recoveryAt,
    evidence,
    blockers,
    verificationHash: hashValue(identity),
  };
}

function leadTimeDays(firstSignalAt: string | null, referenceAt: string | null) {
  if (!firstSignalAt || !referenceAt) return null;
  return Math.round((Date.parse(referenceAt) - Date.parse(firstSignalAt)) / DAY_MS * 100) / 100;
}

function classify(
  item: FrozenCohortRegistryCase,
  temporal: ReturnType<typeof buildFrozenTimeline>,
  truth: FrozenGroundTruth,
): { outcome: FrozenCohortOutcome; blockers: string[]; leadTimeDays: number | null } {
  if (truth.status !== "verified") return { outcome: "inconclusive", blockers: truth.blockers, leadTimeDays: null };
  if (temporal.lookAheadDetected) return { outcome: "inconclusive", blockers: ["Informação futura detectada."], leadTimeDays: null };

  if (item.role === "severe_deterioration") {
    const lead = leadTimeDays(temporal.firstSignalAt, truth.eventAt);
    if (temporal.firstSignalAt && truth.eventAt && Date.parse(temporal.firstSignalAt) <= Date.parse(truth.eventAt)) {
      return { outcome: "true_positive", blockers: [], leadTimeDays: lead };
    }
    return { outcome: "false_negative", blockers: ["O ruleset não produziu sinal antes do evento material."], leadTimeDays: lead };
  }

  if (item.role === "healthy_control") {
    return temporal.finalDetector.status === "no_qualifying_stress"
      ? { outcome: "true_negative", blockers: [], leadTimeDays: null }
      : { outcome: "false_positive", blockers: ["Controle saudável recebeu sinal de deterioração sem evento material primário."], leadTimeDays: null };
  }

  const reproduced = temporal.finalDetector.status === "reversible_stress_confirmed"
    && temporal.finalDetector.stressDetectedAt === truth.stressAt
    && temporal.finalDetector.recoveryDetectedAt === truth.recoveryAt;
  return reproduced
    ? { outcome: "true_positive", blockers: [], leadTimeDays: leadTimeDays(temporal.firstSignalAt, truth.recoveryAt) }
    : { outcome: "false_negative", blockers: ["O ruleset não reproduziu a janela primária de estresse e recuperação."], leadTimeDays: leadTimeDays(temporal.firstSignalAt, truth.recoveryAt) };
}

export function calculateFrozenCohortMetrics(cases: FrozenCaseBacktestResult[]): FrozenCohortMetrics {
  const count = (outcome: FrozenCohortOutcome) => cases.filter((item) => item.outcome === outcome).length;
  const leads = cases.map((item) => item.leadTimeDays).filter((value): value is number => typeof value === "number");
  const inconclusiveCases = count("inconclusive");
  const conclusiveCases = cases.length - inconclusiveCases;
  return {
    totalCases: cases.length,
    conclusiveCases,
    truePositives: count("true_positive"),
    trueNegatives: count("true_negative"),
    falsePositives: count("false_positive"),
    falseNegatives: count("false_negative"),
    inconclusiveCases,
    coveragePercent: cases.length ? Math.round(conclusiveCases / cases.length * 10_000) / 100 : 0,
    averageLeadTimeDays: leads.length ? Math.round(leads.reduce((sum, value) => sum + value, 0) / leads.length * 100) / 100 : null,
    minimumLeadTimeDays: leads.length ? Math.min(...leads) : null,
    maximumLeadTimeDays: leads.length ? Math.max(...leads) : null,
  };
}

function cohortIdentityHash(registry: FrozenCohortRegistry) {
  return hashValue({
    datasetId: registry.datasetId,
    datasetVersion: registry.datasetVersion,
    rulesetVersion: registry.rulesetVersion,
    cases: registry.cases.map((item) => [item.ticker, item.cnpj, item.role, item.fromDate, item.untilDate]),
  });
}

function check(id: string, passed: boolean, message: string, metadata: Record<string, unknown> = {}): FrozenCohortCheck {
  return { id, status: passed ? "passed" : "failed", message, metadata };
}

export function buildFrozenCohortPhaseC(
  root = process.cwd(),
  registryPath = "src/lib/risk-lab/frozen-cohort-phase-c-v1.json",
): FrozenCohortPhaseCResult {
  const registry = readJson<FrozenCohortRegistry>(root, registryPath);
  assertCondition(registry.schemaVersion === 1, "Schema do registro da coorte inválido.");
  assertCondition(registry.rulesetVersion === "0.1.0", "A 3.5-C não pode alterar o ruleset congelado v0.1.0.");
  assertCondition(registry.cases.length === 6, "A coorte deve possuir exatamente seis casos.");
  assertCondition(
    JSON.stringify(registry.cases.map((item) => item.ticker)) === JSON.stringify(EXPECTED_TICKERS),
    "Ordem ou identidade dos seis fundos divergente.",
  );
  const identityHash = cohortIdentityHash(registry);
  assertCondition(identityHash === registry.expectedCohortIdentityHash, "Hash de identidade da coorte divergente.");

  const cases: FrozenCaseBacktestResult[] = [];
  const datasetRows: Array<Record<string, unknown>> = [];
  for (const item of registry.cases) {
    const loaded = loadCase(root, registry, item);
    const truthInput = registry.primaryTruth.find((candidate) => candidate.ticker === item.ticker);
    assertCondition(truthInput, `${item.ticker}: verdade-terreno ausente.`);
    const temporal = buildFrozenTimeline(loaded.notices);
    const truth = groundTruth(item, truthInput, loaded.notices);
    const classified = classify(item, temporal, truth);
    const result: FrozenCaseBacktestResult = {
      ticker: item.ticker,
      role: item.role,
      indexPath: item.indexPath,
      indexEvidenceHash: loaded.index.evidenceHash,
      combinedObservationsHash: loaded.index.combinedObservationsHash,
      observations: loaded.notices.length,
      missingMonths: loaded.index.result.missingMonths,
      longestContiguousSequence: loaded.index.result.longestContiguousSequence,
      firstSignalAt: temporal.firstSignalAt,
      finalDetector: temporal.finalDetector,
      timeline: temporal.points,
      groundTruth: truth,
      outcome: classified.outcome,
      leadTimeDays: classified.leadTimeDays,
      lookAheadDetected: temporal.lookAheadDetected,
      blockers: classified.blockers,
      premiumIntegrated: false,
      notificationsSent: false,
    };
    cases.push(result);
    loaded.raw.forEach((observation) => datasetRows.push({
      ticker: item.ticker,
      role: item.role,
      competenceMonth: observation.competenceMonth,
      amountPerShare: observation.amountPerShare,
      announcedAt: observation.announcedAt,
      documentId: observation.documentId,
      sourceHash: observation.sourceHash,
      protocolHash: observation.protocolHash,
      sourceVersion: observation.sourceVersion,
    }));
  }

  datasetRows.sort((left, right) => String(left.ticker).localeCompare(String(right.ticker))
    || String(left.competenceMonth).localeCompare(String(right.competenceMonth)));
  const datasetHash = hashValue(datasetRows);
  const resultMetrics = calculateFrozenCohortMetrics(cases);
  const noLookAhead = cases.every((item) => !item.lookAheadDetected);
  const isolation = cases.every((item) => !item.premiumIntegrated && !item.notificationsSent);
  const checks = [
    check("cohort.identity", identityHash === registry.expectedCohortIdentityHash, "A identidade pré-registrada da coorte deve permanecer imutável.", { identityHash }),
    check("cohort.six-cases", cases.length === 6, "Os seis fundos devem ser carregados do Git.", { total: cases.length }),
    check("dataset.immutable", datasetRows.length > 0 && /^[a-f0-9]{64}$/.test(datasetHash), "O dataset consolidado deve possuir hash determinístico.", { observations: datasetRows.length, datasetHash }),
    check("source.catalogs", registry.sourceCatalogs.length === 6 && registry.sourceCatalogs.every((item) => /^[a-f0-9]{64}$/.test(item.sourceHash)), "Os catálogos anuais da CVM devem estar congelados."),
    check("look-ahead.none", noLookAhead, "Nenhuma observação posterior à data simulada pode influenciar o resultado."),
    check("ruleset.frozen", registry.rulesetVersion === "0.1.0", "O ruleset v0.1.0 deve permanecer congelado."),
    check("isolation.external-effects", isolation, "A 3.5-C não pode integrar Premium nem enviar notificações."),
    check("metrics.measured", resultMetrics.totalCases === 6, "Todos os resultados, inclusive inconclusivos, devem ser medidos."),
  ];
  const methodologicalBlockers = checks.filter((item) => item.status === "failed").map((item) => item.message);
  const performanceFindings = [
    ...cases.filter((item) => item.outcome === "false_positive").map((item) => `${item.ticker}: falso positivo.`),
    ...cases.filter((item) => item.outcome === "false_negative").map((item) => `${item.ticker}: falso negativo.`),
    ...cases.filter((item) => item.outcome === "inconclusive").map((item) => `${item.ticker}: inconclusivo — ${item.blockers.join(" ")}`),
  ];
  const status: PhaseCStatus = methodologicalBlockers.length > 0
    ? "blocked"
    : performanceFindings.length > 0 ? "completed_requires_calibration" : "completed";
  const withoutHash: Omit<FrozenCohortPhaseCResult, "evidenceHash"> = {
    schemaVersion: 1,
    phase: "3.5-C",
    datasetId: registry.datasetId,
    datasetVersion: registry.datasetVersion,
    methodologyVersion: registry.methodologyVersion,
    rulesetVersion: registry.rulesetVersion,
    evaluatedAt: registry.evaluatedAt,
    status,
    cohortIdentityHash: identityHash,
    datasetHash,
    observationCount: datasetRows.length,
    cases,
    metrics: resultMetrics,
    methodologyChecks: checks,
    performanceFindings,
    methodologicalBlockers,
    calibrationRequired: performanceFindings.length > 0,
    homologationAllowed: false,
    premiumIntegrated: false,
    notificationsSent: false,
  };
  return { ...withoutHash, evidenceHash: hashValue(withoutHash) };
}
