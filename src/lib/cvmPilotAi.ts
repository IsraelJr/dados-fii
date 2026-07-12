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

export async function extractPilotInsightsV2(input: {
  runId: string;
  ticker: string;
  documents: Array<Record<string, unknown>>;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const selectedDocuments = input.documents
    .filter((document) => isOfficialDocumentUrl(document.documentUrl))
    .slice(0, 8);
  const submittedUrls = [...new Set(
    selectedDocuments
      .map((document) => normalizeUrl(document.documentUrl))
      .filter(Boolean)
  )];

  if (!apiKey) {
    return {
      status: "skipped",
      reason: "OPENAI_API_KEY ausente",
      documentsSubmitted: submittedUrls.length,
      submittedUrls,
      sourceUrlsUsed: 0,
      matchedUsedUrls: [],
      externalSourceUrls: [],
      sourceCoverage: 0,
      quality: "incomplete",
    };
  }

  if (!submittedUrls.length) {
    return {
      status: "skipped",
      reason: "Nenhum documento oficial com URL válida encontrado",
      documentsSubmitted: 0,
      submittedUrls: [],
      sourceUrlsUsed: 0,
      matchedUsedUrls: [],
      externalSourceUrls: [],
      sourceCoverage: 0,
      quality: "incomplete",
    };
  }

  const documentLines = selectedDocuments
    .map((document, index) => [
      `${index + 1}. Tipo: ${document.documentType || document.documentName || "Documento"}`,
      `Data de entrega: ${document.deliveryDate || "não informada"}`,
      `URL oficial autorizada: ${normalizeUrl(document.documentUrl)}`,
    ].join(" | "))
    .join("\n");

  const prompt = `
Você é um extrator de dados do fundo imobiliário brasileiro ${input.ticker}.

REGRAS OBRIGATÓRIAS:
1. Analise SOMENTE os documentos oficiais listados abaixo.
2. Não use sites agregadores, portais de cotação, blogs, redes sociais, páginas comerciais ou documentos antigos encontrados por busca.
3. A busca web serve exclusivamente para abrir ou localizar uma versão acessível da MESMA URL oficial fornecida.
4. Não substitua um documento inacessível por outra fonte.
5. Não invente valores. Use null quando o documento oficial não puder ser acessado.
6. sourceUrls deve conter somente URLs EXATAS da lista autorizada que foram realmente abertas e utilizadas.
7. Para cada URL, informe em documentsReviewed se ela foi acessada.

DOCUMENTOS OFICIAIS AUTORIZADOS:
${documentLines}

Retorne somente JSON válido:
{
  "ticker": "${input.ticker}",
  "summary": "resumo estritamente sustentado pelos documentos oficiais acessados",
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
      "accessed": false,
      "notes": "motivo objetivo"
    }
  ],
  "sourceUrls": []
}
`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_SEARCH_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: prompt,
      temperature: 0,
      tools: [{ type: "web_search", search_context_size: "high" }],
      tool_choice: "required",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha na extração por IA: ${response.status} ${detail.slice(0, 300)}`);
  }

  const payload = await response.json();
  const extraction = safeJsonParse(extractOutputText(payload));
  if (!extraction) throw new Error("A extração por IA não retornou JSON válido.");

  const submittedSet = new Set(submittedUrls);
  const rawUsedUrls = Array.isArray(extraction.sourceUrls)
    ? [...new Set(extraction.sourceUrls.map(normalizeUrl).filter(Boolean))]
    : [];
  const matchedUsedUrls = rawUsedUrls.filter((url) => submittedSet.has(url));
  const externalSourceUrls = rawUsedUrls.filter((url) => !submittedSet.has(url));
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
    sourceUrls: matchedUsedUrls,
    documentsReviewed: Array.isArray(extraction.documentsReviewed)
      ? extraction.documentsReviewed.map((item: any) => ({
          url: normalizeUrl(item?.url),
          accessed: Boolean(item?.accessed) && submittedSet.has(normalizeUrl(item?.url)),
          notes: String(item?.notes || ""),
        })).filter((item: any) => submittedSet.has(item.url))
      : [],
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
  };
}
