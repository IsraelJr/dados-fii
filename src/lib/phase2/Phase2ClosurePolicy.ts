import { createHash } from "crypto";
import type { PublicFundData } from "@/types/regulatory";
import type { CanonicalFundCatalogEntry, FundCatalogAudit, FundCatalogDirectory, FundCatalogRun } from "@/types/fund-catalog";
import type { Phase2ClosureCheck } from "@/types/phase2-closure";

const BASIC_TARGET = 100;
const ESSENTIAL_TARGET = 95;
const SOURCE_TARGET = 100;
const MINIMUM_OFFICIAL_UNIVERSE = 250;

function check(id: string, passed: boolean, message: string, metadata: Phase2ClosureCheck["metadata"]): Phase2ClosureCheck {
  return { id, status: passed ? "passed" : "failed", message, metadata };
}

export function evaluateCatalogPreview(run: FundCatalogRun) {
  const checks: Phase2ClosureCheck[] = [
    check("catalog.source-match", run.coverage.sourceMatchPercent === SOURCE_TARGET, "Conciliação B3/CVM deve cobrir 100% dos candidatos.", { actual: run.coverage.sourceMatchPercent, target: SOURCE_TARGET }),
    check("catalog.basic-coverage", run.coverage.basicCoveragePercent === BASIC_TARGET, "Todos os fundos ativos devem ter os dados cadastrais básicos.", { actual: run.coverage.basicCoveragePercent, target: BASIC_TARGET }),
    check("catalog.essential-coverage", run.coverage.essentialCoveragePercent >= ESSENTIAL_TARGET, "A cobertura essencial deve permanecer acima do piso formal.", { actual: run.coverage.essentialCoveragePercent, target: ESSENTIAL_TARGET }),
    check("catalog.duplicate-cnpj", run.coverage.duplicateCnpjGroups === 0, "Não pode existir CNPJ duplicado entre fundos ativos.", { duplicateGroups: run.coverage.duplicateCnpjGroups }),
    check("catalog.universe-size", run.coverage.b3Candidates >= MINIMUM_OFFICIAL_UNIVERSE, "O universo oficial não pode estar truncado.", { candidates: run.coverage.b3Candidates, minimum: MINIMUM_OFFICIAL_UNIVERSE }),
    check("catalog.sentinels", run.safety.sentinelsPresent, "Os fundos sentinela precisam estar presentes antes da carga.", { sentinelsPresent: run.safety.sentinelsPresent }),
    check("catalog.safe-to-apply", run.safety.safeToApply, "A engine deve autorizar explicitamente a aplicação.", { safeToApply: run.safety.safeToApply }),
    check("catalog.destructive-safety", run.totals.inactivated === 0 || run.safety.destructiveChangesAllowed, "Inativações só são aceitas com evidência oficial suficiente.", { inactivated: run.totals.inactivated, destructiveChangesAllowed: run.safety.destructiveChangesAllowed }),
    check("catalog.acceptance", run.acceptance.meetsTargets, "A prévia deve cumprir integralmente os critérios de aceite da engine.", { meetsTargets: run.acceptance.meetsTargets }),
  ];
  const blockers = [
    ...checks.filter((item) => item.status === "failed").map((item) => item.message),
    ...run.safety.blockers,
    ...run.acceptance.gaps,
  ].filter((value, index, values) => value && values.indexOf(value) === index);
  return { checks, blockers };
}

export function evaluateCatalogAudit(audit: FundCatalogAudit, directory: FundCatalogDirectory, expectedRunId: string) {
  const checks: Phase2ClosureCheck[] = [
    check("audit.run-id", audit.runId === expectedRunId && directory.runId === expectedRunId, "Auditoria e diretório devem apontar para a carga aprovada.", { auditRunMatches: audit.runId === expectedRunId, directoryRunMatches: directory.runId === expectedRunId }),
    check("audit.basic-coverage", audit.basicCoveragePercent === BASIC_TARGET && audit.missingBasic.length === 0, "O double check deve confirmar 100% dos dados básicos.", { actual: audit.basicCoveragePercent, missingFunds: audit.missingBasic.length }),
    check("audit.essential-coverage", audit.essentialCoveragePercent >= ESSENTIAL_TARGET, "O double check deve confirmar a cobertura essencial mínima.", { actual: audit.essentialCoveragePercent, target: ESSENTIAL_TARGET }),
    check("audit.duplicate-cnpj", audit.duplicateCnpjGroups === 0, "O double check não pode encontrar CNPJ duplicado.", { duplicateGroups: audit.duplicateCnpjGroups }),
    check("audit.directory", directory.total === audit.activeDocuments, "O diretório materializado deve conter todos os fundos ativos auditados.", { directoryTotal: directory.total, activeDocuments: audit.activeDocuments }),
    check("audit.acceptance", audit.acceptanceMet, "A auditoria pós-carga deve cumprir os critérios formais.", { acceptanceMet: audit.acceptanceMet }),
  ];
  return {
    checks,
    blockers: checks.filter((item) => item.status === "failed").map((item) => item.message),
  };
}

export function selectStratifiedSamples(directory: FundCatalogDirectory) {
  const preferred = { FII: "MXRF11", FIAGRO: "VGIA11", FI_INFRA: "BODB11" } as const;
  return (["FII", "FIAGRO", "FI_INFRA"] as const).map((kind) => {
    const candidates = directory.items.filter((item) => item.kind === kind);
    const selected = candidates.find((item) => item.ticker === preferred[kind]) || candidates[0];
    return selected ? { ticker: selected.ticker, kind } : null;
  }).filter((item): item is { ticker: string; kind: "FII" | "FIAGRO" | "FI_INFRA" } => Boolean(item));
}

function nonEmpty(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function selectEdgeSamples(run: FundCatalogRun, audit: FundCatalogAudit) {
  const standardTickers = new Set(["MXRF11", "VGIA11", "BODB11"]);
  const missingCandidates = audit.missingEssential.filter((item) => !standardTickers.has(item.ticker));
  const incomplete = missingCandidates.find((item) => item.ticker === "RJDA11") || missingCandidates[0] || null;
  const lifecycleCandidates = audit.staleOrInactive.filter((item) => item.ticker !== incomplete?.ticker);
  const lifecycle = lifecycleCandidates.find((item) => item.ticker === "HGPO11") || lifecycleCandidates[0] || null;
  const review = run.reviewSamples.find((item) => item.ticker !== incomplete?.ticker) || null;
  const exceptional = lifecycle
    ? { ticker: lifecycle.ticker, status: lifecycle.status, reason: lifecycle.reason }
    : review
      ? { ticker: review.ticker, status: "under_review" as const, reason: review.issue }
      : null;
  return {
    incomplete: incomplete ? { ticker: incomplete.ticker, fields: incomplete.fields } : null,
    exceptional,
  };
}

export function basicFundEvidence(fund: PublicFundData | null) {
  const catalog = fund?.catalog && typeof fund.catalog === "object" ? fund.catalog as CanonicalFundCatalogEntry : null;
  const cnpj = String(catalog?.identity.cnpj || fund?.cnpj || fund?.CNPJ || "").replace(/\D/g, "");
  const name = catalog?.identity.legalName || fund?.corporateName || fund?.socialReason || fund?.name;
  const manager = catalog?.serviceProviders.managers[0]?.name || fund?.manager || fund?.gestor;
  const administrator = catalog?.serviceProviders.administrator.name || fund?.administrator || fund?.administrador;
  return {
    cnpj: cnpj.length === 14,
    name: nonEmpty(name),
    manager: nonEmpty(manager),
    administrator: nonEmpty(administrator),
    kind: Boolean(fund && fund.fundKind !== "UNKNOWN"),
  };
}

export function misleadingMissingDataClaims(text: string, evidence: ReturnType<typeof basicFundEvidence>) {
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const claims: string[] = [];
  const absent = "(ausente|nao informado|nao (?:foi )?identificado)";
  if (evidence.cnpj && (new RegExp(`(cnpj).{0,45}${absent}`).test(normalized) || /(ausencia|falta).{0,30}(cnpj)/.test(normalized))) claims.push("CNPJ informado foi descrito como ausente.");
  if (evidence.manager && new RegExp(`(gestor|gestora).{0,45}${absent}`).test(normalized)) claims.push("Gestor informado foi descrito como ausente.");
  if (evidence.administrator && new RegExp(`(administrador|administradora).{0,45}${absent}`).test(normalized)) claims.push("Administrador informado foi descrito como ausente.");
  return claims;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
}

export function evidenceHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(stableValue(value)), "utf8").digest("hex");
}
