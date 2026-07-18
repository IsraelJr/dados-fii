import type {
  CandidateOfficialDocument,
  EventVerificationCandidate,
  EventVerificationLedger,
} from "../../types/riskLabEventVerification";

const EXPECTED_TICKERS = new Set(["DEVA11", "VSLH11", "MCCI11", "RBRY11"]);
const ALLOWED_PRIMARY_HOSTS = new Set([
  "fnet.bmfbovespa.com.br",
  "www.devantasset.com.br",
  "devantasset.com.br",
  "www.mauacapital.com.br",
  "mauacapital.com.br",
  "www.rbrasset.com.br",
  "rbrasset.com.br",
]);

function isIsoDate(value: string | null) {
  if (!value) return false;
  return !Number.isNaN(Date.parse(value));
}

function assertPrimaryUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`URL primária inválida: ${value}`);
  }
  if (parsed.protocol !== "https:" || !ALLOWED_PRIMARY_HOSTS.has(parsed.hostname)) {
    throw new Error(`Host primário não autorizado: ${parsed.hostname}`);
  }
}

function assertOfficialDocument(document: CandidateOfficialDocument, ticker: string) {
  if (!document.documentId.trim()) throw new Error(`Documento oficial sem ID: ${ticker}`);
  assertPrimaryUrl(document.sourceUrl);
  if (!isIsoDate(document.referenceDate) || !isIsoDate(document.publishedAt)) {
    throw new Error(`Datas do documento oficial inválidas: ${ticker}`);
  }

  const review = document.contentReview;
  const hasReviewFields = Boolean(
    review.page &&
      review.page > 0 &&
      review.excerpt?.trim() &&
      review.reviewedBy?.trim() &&
      review.reviewedAt &&
      isIsoDate(review.reviewedAt),
  );

  if (review.status === "manually_verified" && !hasReviewFields) {
    throw new Error(`Revisão manual incompleta: ${ticker}`);
  }
  if (review.status !== "manually_verified" && hasReviewFields) {
    throw new Error(`Campos de revisão preenchidos sem promoção manual: ${ticker}`);
  }
  if (review.status !== "manually_verified") {
    if (review.page !== null || review.excerpt !== null || review.reviewedBy !== null || review.reviewedAt !== null) {
      throw new Error(`Documento pendente não pode carregar evidência parcial: ${ticker}`);
    }
  }
}

function assertCandidate(candidate: EventVerificationCandidate) {
  if (!EXPECTED_TICKERS.has(candidate.ticker)) {
    throw new Error(`Ticker inesperado no ledger: ${candidate.ticker}`);
  }
  if (!candidate.candidateId.startsWith(`${candidate.ticker}-`)) {
    throw new Error(`ID de candidato incompatível: ${candidate.candidateId}`);
  }

  for (const locator of candidate.locatorEvidence) {
    if (locator.sourceType !== "secondary_locator") {
      throw new Error(`Localizador não pode ser tratado como fonte primária: ${candidate.ticker}`);
    }
    if (!isIsoDate(locator.observedAt)) {
      throw new Error(`Data do localizador inválida: ${candidate.ticker}`);
    }
  }

  if (candidate.status === "pending_document_location") {
    if (candidate.officialDocument || candidate.eventDateCandidate || candidate.eligibleForCohortPromotion) {
      throw new Error(`Caso pendente contém promoção prematura: ${candidate.ticker}`);
    }
    return;
  }

  if (!candidate.officialDocument || !candidate.eventDateCandidate) {
    throw new Error(`Documento candidato incompleto: ${candidate.ticker}`);
  }
  assertOfficialDocument(candidate.officialDocument, candidate.ticker);

  if (Date.parse(candidate.eventDateCandidate) !== Date.parse(candidate.officialDocument.publishedAt)) {
    throw new Error(`Data candidata deve ser a primeira data pública do documento: ${candidate.ticker}`);
  }

  const manuallyVerified = candidate.officialDocument.contentReview.status === "manually_verified";
  if (candidate.status === "primary_content_verified" && !manuallyVerified) {
    throw new Error(`Evento marcado como verificado sem revisão manual: ${candidate.ticker}`);
  }
  if (candidate.status !== "primary_content_verified" && manuallyVerified) {
    throw new Error(`Revisão manual exige status primary_content_verified: ${candidate.ticker}`);
  }
  if (candidate.eligibleForCohortPromotion !== manuallyVerified) {
    throw new Error(`Elegibilidade de promoção incompatível com a revisão: ${candidate.ticker}`);
  }
}

export function loadEventVerificationLedger(raw: unknown): EventVerificationLedger {
  if (!raw || typeof raw !== "object") throw new Error("Ledger de verificação inválido.");
  const ledger = raw as EventVerificationLedger;

  if (ledger.metadata.id !== "risk-lab-event-verification-v0.1") {
    throw new Error("Identificador inesperado do ledger de verificação.");
  }
  if (ledger.metadata.cohortId !== "risk-lab-credit-oos-v0.1") {
    throw new Error("Ledger não pertence à coorte externa congelada.");
  }
  if (ledger.metadata.rulesetVersion !== "0.1.0") {
    throw new Error("Ledger deve permanecer vinculado ao ruleset v0.1.0.");
  }
  if (ledger.metadata.executionAllowed) {
    throw new Error("Ledger de pesquisa nunca pode liberar execução do backtest.");
  }
  if (!Array.isArray(ledger.candidates) || ledger.candidates.length !== 4) {
    throw new Error("Ledger deve conter os quatro casos que exigem verificação de evento.");
  }

  const tickers = new Set<string>();
  const ids = new Set<string>();
  for (const candidate of ledger.candidates) {
    assertCandidate(candidate);
    if (tickers.has(candidate.ticker)) throw new Error(`Ticker duplicado no ledger: ${candidate.ticker}`);
    if (ids.has(candidate.candidateId)) throw new Error(`ID duplicado no ledger: ${candidate.candidateId}`);
    tickers.add(candidate.ticker);
    ids.add(candidate.candidateId);
  }

  for (const ticker of EXPECTED_TICKERS) {
    if (!tickers.has(ticker)) throw new Error(`Caso obrigatório ausente do ledger: ${ticker}`);
  }

  const verified = ledger.candidates.filter((item) => item.status === "primary_content_verified").length;
  const expectedStatus = verified === 4 ? "verified" : verified > 0 ? "partially_verified" : "research_only_blocked";
  if (ledger.metadata.status !== expectedStatus) {
    throw new Error(`Status agregado incompatível: esperado ${expectedStatus}.`);
  }

  return ledger;
}

export function assertCandidatePromotionReady(candidate: EventVerificationCandidate) {
  if (candidate.status !== "primary_content_verified" || !candidate.eligibleForCohortPromotion) {
    throw new Error(`${candidate.ticker}: candidato ainda não pode promover a coorte.`);
  }
  if (!candidate.officialDocument) {
    throw new Error(`${candidate.ticker}: documento primário ausente.`);
  }
  assertOfficialDocument(candidate.officialDocument, candidate.ticker);
}
