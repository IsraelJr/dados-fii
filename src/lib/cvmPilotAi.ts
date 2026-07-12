import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

const OFFICIAL_DOCUMENT_HOSTS = [
  "fnet.bmfbovespa.com.br",
  "rad.cvm.gov.br",
  "dados.cvm.gov.br",
  "cvm.gov.br",
];

function extractUrl(value: unknown) {
  const match = String(value || "").match(/https?:\/\/[^\s)\]}>]+/i);
  return match?.[0] || "";
}

function normalizeUrl(value: unknown) {
  try {
    const extracted = extractUrl(value);
    if (!extracted) return "";
    const url = new URL(extracted);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    url.searchParams.sort();
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return "";
  }
}

function isOfficialDocumentUrl(value: unknown) {
  const normalized = normalizeUrl(value);
  if (!normalized) return false;
  const hostname = new URL(normalized).hostname;
  return OFFICIAL_DOCUMENT_HOSTS.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
  );
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const texts = payload?.output
    ?.flatMap((item: any) => item?.content || [])
    ?.map((content: any) => content?.text)
    ?.filter(Boolean);
  return Array.isArray(texts) ? texts.join("\n") : "";
}

function buildPrompt(ticker: string, documents: Array<Record<string, unknown>>) {
  const documentLines = documents
    .map((document, index) => [
      `${index + 1}. Tipo: ${document.documentType || document.documentName || "Documento"}`,
      `Data de entrega: ${document.deliveryDate || "não informada"}`,
      `URL oficial: ${normalizeUrl(document.documentUrl)}`,
    ].join(" | "))
    .join("\n");

  return `
Você é um extrator de dados do fundo imobiliário brasileiro ${ticker}.

Os PDFs oficiais estão anexados diretamente nesta solicitação, na mesma ordem da lista abaixo.

REGRAS OBRIGATÓRIAS:
1. Use somente o conteúdo dos PDFs anexados.
2. Não use conhecimento externo, sites agregadores, portais de cotação, blogs ou documentos não anexados.
3. Não invente valores. Use null quando o documento não trouxer a informação.
4. Em documentsReviewed, inclua todas as URLs da lista e marque accessed=true somente quando o PDF correspondente tiver sido lido.
5. sourceUrls deve conter somente URLs exatas da lista abaixo efetivamente usadas.
6. O resumo deve distinguir fatos, declarações da gestora e riscos ainda sem comprovação quantitativa.

DOCUMENTOS OFICIAIS ANEXADOS:
${documentLines}

Retorne somente JSON válido:
{
  "ticker": "${ticker}",
  "summary": "resumo estritamente sustentado pelos PDFs anexados",
  "dividendSustainability": {
    "currentResultPerShare": null,
    "currentDividendPerShare": null,
    "coverageRatio": null,
    "reserves": null,
    "notes": []
  },
  "development": {
    "projects": [],
    "sales": null,
    "inventory": null,
    "receivables": null,
    "remainingInvestment": null
  },
  "credit": {
    "operations": [],
    "delinquencies": [],
    "renegotiations": []
  },
  "risks": [],
  "managementComments": [],
  "warnings": [],
  "documentsReviewed": [
    {
      "url": "URL exata da lista",
      "accessed": true,
      "notes": "conteúdo principal ou motivo de indisponibilidade"
    }
  ],
  "sourceUrls": []
}
`;
}

export async function extractPilotInsightsV2(input: {
  runId: string;
  ticker: string;
  documents: Array<Record<string, unknown>>;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const selectedDocuments = input.documents
    .filter((document) => isOfficialDocumentUrl(document.documentUrl))
    .slice(0, 8);
  const submittedUrls: string[] = Array.from(new Set<string>(
    selectedDocuments
      .map((document) => normalizeUrl(document.documentUrl))
      .filter((url): url is string => Boolean(url))
  ));

  if (!apiKey) {
    return {
      status: "skipped",
      reason: "OPENAI_API_KEY ausente",
      documentsSubmitted: submittedUrls.length,
      submittedUrls,
      sourceUrlsUsed: 0,
      matchedUsedUrls: [] as string[],
      externalSourceUrls: [] as string[],
      sourceCoverage: 0,
      quality: "incomplete",
      inputMode: "direct_pdf",
    };
  }

  if (!submittedUrls.length) {
    return {
      status: "skipped",
      reason: "Nenhum documento oficial com URL válida encontrado",
      documentsSubmitted: 0,
      submittedUrls: [] as string[],
      sourceUrlsUsed: 0,
      matchedUsedUrls: [] as string[],
      externalSourceUrls: [] as string[],
      sourceCoverage: 0,
      quality: "incomplete",
      inputMode: "direct_pdf",
    };
  }

  const content: Array<Record<string, unknown>> = selectedDocuments.map((document) => ({
    type: "input_file",
    file_url: normalizeUrl(document.documentUrl),
    detail: "low",
  }));
  content.push({
    type: "input_text",
    text: buildPrompt(input.ticker, selectedDocuments),
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_DOCUMENT_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [{ role: "user", content }],
      temperature: 0,
      max_output_tokens: 6000,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha na extração direta dos PDFs: ${response.status} ${detail.slice(0, 500)}`);
  }

  const payload = await response.json();
  const extraction = safeJsonParse(extractOutputText(payload));
  if (!extraction) throw new Error("A extração direta dos PDFs não retornou JSON válido.");

  const submittedSet = new Set<string>(submittedUrls);
  const rawUsedUrls: string[] = Array.isArray(extraction.sourceUrls)
    ? Array.from(new Set<string>(
        extraction.sourceUrls
          .map((value: unknown) => normalizeUrl(value))
          .filter((url: string): url is string => Boolean(url))
      ))
    : [];
  const matchedSourceUrls = rawUsedUrls.filter((url) => submittedSet.has(url));
  const externalSourceUrls = rawUsedUrls.filter((url) => !submittedSet.has(url));

  const reviewedDocuments = Array.isArray(extraction.documentsReviewed)
    ? extraction.documentsReviewed
        .map((item: any) => ({
          url: normalizeUrl(item?.url),
          accessed: Boolean(item?.accessed),
          notes: String(item?.notes || ""),
        }))
        .filter((item: any) => submittedSet.has(item.url))
    : [];
  const reviewedUrls = Array.from(new Set<string>(
    reviewedDocuments
      .filter((item: any) => item.accessed)
      .map((item: any) => item.url)
  ));
  const matchedUsedUrls = reviewedUrls.length ? reviewedUrls : matchedSourceUrls;
  const sourceCoverage = submittedUrls.length
    ? Number(((matchedUsedUrls.length / submittedUrls.length) * 100).toFixed(1))
    : 0;
  const completeEnough = sourceCoverage >= 50 && externalSourceUrls.length === 0;
  const qualityWarnings = [
    ...(Array.isArray(extraction.warnings) ? extraction.warnings : []),
    ...(externalSourceUrls.length
      ? [`Foram descartadas ${externalSourceUrls.length} fontes não autorizadas retornadas pela IA.`]
      : []),
  ];

  const sanitizedExtraction = {
    ...extraction,
    warnings: qualityWarnings,
    sourceUrls: matchedSourceUrls,
    documentsReviewed: reviewedDocuments,
  };

  await adminDb.collection("FiiIngestionStaging").doc(input.runId).set({
    aiExtraction: sanitizedExtraction,
    aiExtractionUpdatedAt: adminFieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    status: completeEnough ? "completed" : "partial",
    reason: completeEnough
      ? null
      : externalSourceUrls.length
        ? `A IA retornou ${externalSourceUrls.length} fontes não autorizadas; cobertura oficial válida: ${matchedUsedUrls.length} de ${submittedUrls.length}.`
        : `Cobertura documental oficial insuficiente: ${matchedUsedUrls.length} de ${submittedUrls.length} documentos utilizados.`,
    extraction: sanitizedExtraction,
    documentsSubmitted: submittedUrls.length,
    submittedUrls,
    rawUsedUrls,
    matchedUsedUrls,
    externalSourceUrls,
    sourceUrlsUsed: matchedUsedUrls.length,
    sourceCoverage,
    quality: completeEnough ? "reviewable" : "partial",
    inputMode: "direct_pdf",
  };
}
