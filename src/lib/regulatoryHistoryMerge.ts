type MonthlyItem = Record<string, any>;
type DocumentItem = Record<string, any>;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function monthlyKey(item: MonthlyItem) {
  return text(item.referenceDate);
}

function documentKey(item: DocumentItem) {
  return text(item.documentUrl)
    || [text(item.documentType), text(item.deliveryDate), text(item.referenceDate)].join("|");
}

function stableDate(item: DocumentItem) {
  return text(item.deliveryDate || item.referenceDate);
}

export function mergeRegulatoryHistory(input: {
  existingMonthly?: MonthlyItem[];
  incomingMonthly?: MonthlyItem[];
  existingDocuments?: DocumentItem[];
  incomingDocuments?: DocumentItem[];
}) {
  const monthlyByDate = new Map<string, MonthlyItem>();
  for (const item of input.existingMonthly || []) {
    const key = monthlyKey(item);
    if (key) monthlyByDate.set(key, item);
  }
  for (const item of input.incomingMonthly || []) {
    const key = monthlyKey(item);
    if (key) monthlyByDate.set(key, { ...monthlyByDate.get(key), ...item });
  }

  const documentsByKey = new Map<string, DocumentItem>();
  for (const item of input.existingDocuments || []) {
    const key = documentKey(item);
    if (key) documentsByKey.set(key, item);
  }
  for (const item of input.incomingDocuments || []) {
    const key = documentKey(item);
    if (key) documentsByKey.set(key, { ...documentsByKey.get(key), ...item });
  }

  const monthlyHistory = [...monthlyByDate.values()]
    .sort((left, right) => monthlyKey(left).localeCompare(monthlyKey(right)));
  const documents = [...documentsByKey.values()]
    .sort((left, right) => stableDate(left).localeCompare(stableDate(right)));

  return {
    monthlyHistory,
    documents,
    latestSnapshot: monthlyHistory.at(-1) || null,
    years: [...new Set(monthlyHistory
      .map((item) => Number(text(item.referenceDate).slice(0, 4)))
      .filter((year) => Number.isInteger(year) && year > 1900))]
      .sort((left, right) => left - right),
    stats: {
      existingMonthly: (input.existingMonthly || []).length,
      incomingMonthly: (input.incomingMonthly || []).length,
      mergedMonthly: monthlyHistory.length,
      existingDocuments: (input.existingDocuments || []).length,
      incomingDocuments: (input.incomingDocuments || []).length,
      mergedDocuments: documents.length,
    },
  };
}
