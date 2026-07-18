import { createHash } from "node:crypto";
import { parseCvmEventualCsv } from "@/lib/risk-lab/CvmEventualCsvParser";
import type {
  AutomaticDocumentEvidence,
  AutomaticSourceSummary,
  AutomaticValidationIssue,
} from "@/types/riskLabAutomatic";

const BASE_URL = "https://dados.cvm.gov.br/dados/FI/DOC/EVENTUAL/DADOS";
const MAX_BYTES = 70 * 1024 * 1024;
const TIMEOUT_MS = 45_000;

export interface CvmEventualDiscoveryResult {
  documents: AutomaticDocumentEvidence[];
  sources: AutomaticSourceSummary[];
  issues: AutomaticValidationIssue[];
}

async function fetchYear(fetchImpl: typeof fetch, cnpj: string, year: number) {
  const sourceUrl = `${BASE_URL}/eventual_fi_${year}.csv`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(sourceUrl, {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: { Accept: "text/csv,text/plain;q=0.9,*/*;q=0.1" },
    });
    if (!response.ok) throw new Error(`CVM respondeu HTTP ${response.status}.`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw new Error("Arquivo CVM excede o limite seguro de 70 MB.");
    const csv = new TextDecoder("windows-1252").decode(bytes);
    const parsed = parseCvmEventualCsv(csv, cnpj, year);
    return {
      documents: parsed.documents,
      issues: parsed.issues,
      summary: {
        year,
        sourceUrl,
        sourceHash: createHash("sha256").update(bytes).digest("hex"),
        fetched: true,
        matchingRows: parsed.matchingRows,
        acceptedDocuments: parsed.documents.length,
        rejectedRows: parsed.rejectedRows,
        error: null,
      } satisfies AutomaticSourceSummary,
    };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "Tempo limite ao consultar a CVM."
      : error instanceof Error
        ? error.message
        : "Falha desconhecida ao consultar a CVM.";
    return {
      documents: [] as AutomaticDocumentEvidence[],
      issues: [{ code: "source_unavailable", severity: "error" as const, message: `Fonte CVM ${year} indisponível: ${message}` }],
      summary: {
        year,
        sourceUrl,
        sourceHash: null,
        fetched: false,
        matchingRows: 0,
        acceptedDocuments: 0,
        rejectedRows: 0,
        error: message,
      } satisfies AutomaticSourceSummary,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export class CvmEventualDocumentDiscovery {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async discover(cnpj: string, years: number[]): Promise<CvmEventualDiscoveryResult> {
    const currentYear = new Date().getFullYear();
    const selectedYears = Array.from(new Set(years.map(Math.trunc)))
      .filter((year) => year >= 2005 && year <= currentYear)
      .sort((left, right) => right - left)
      .slice(0, 4);
    if (!selectedYears.length) throw new Error("Nenhum ano válido foi informado para a pesquisa CVM.");

    const results = [];
    for (const year of selectedYears) results.push(await fetchYear(this.fetchImpl, cnpj, year));

    const documents = new Map<string, AutomaticDocumentEvidence>();
    for (const result of results) {
      for (const document of result.documents) documents.set(document.documentId, document);
    }

    return {
      documents: Array.from(documents.values()).sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)),
      sources: results.map((result) => result.summary),
      issues: results.flatMap((result) => result.issues),
    };
  }
}

export const cvmEventualDocumentDiscovery = new CvmEventualDocumentDiscovery();
