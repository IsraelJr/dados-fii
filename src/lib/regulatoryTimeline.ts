export type RegulatoryTimelineEvent = {
  id: string;
  date: string;
  month: string;
  kind: "monthly_snapshot" | "official_document" | "capital_change";
  category: string;
  title: string;
  detail: string;
  severity: "information" | "positive" | "attention";
  sourceUrl: string | null;
  metadata: Record<string, unknown>;
};

function numeric(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percentChange(previous: unknown, current: unknown) {
  const start = numeric(previous);
  const end = numeric(current);
  if (start === null || end === null || start === 0) return null;
  return Number((((end - start) / Math.abs(start)) * 100).toFixed(2));
}

function monthKey(date: string) {
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : date;
}

function documentTitle(document: Record<string, any>) {
  const type = String(document.documentType || document.category || "Documento oficial").trim();
  const normalized = type.toUpperCase();
  if (normalized.includes("FATO RELEV")) return "Fato relevante publicado";
  if (normalized.includes("RELAT GERENCIAL")) return "Relatório gerencial publicado";
  if (normalized.includes("REGUL")) return "Regulamento atualizado";
  if (normalized.includes("ASSEMB") || normalized.includes("AGC") || normalized.includes("AGE")) return "Documento de assembleia publicado";
  if (normalized.includes("PROSP")) return "Documento de oferta publicado";
  return `${type} publicado`;
}

function documentSeverity(document: Record<string, any>): RegulatoryTimelineEvent["severity"] {
  const type = String(document.documentType || document.category || "").toUpperCase();
  if (type.includes("FATO RELEV") || type.includes("PROSP") || type.includes("ASSEMB")) return "attention";
  return "information";
}

export function buildRegulatoryTimeline(input: {
  ticker: string;
  monthlyHistory?: Array<Record<string, any>>;
  documents?: Array<Record<string, any>>;
}) {
  const ticker = String(input.ticker || "").trim().toUpperCase();
  const monthly = [...(input.monthlyHistory || [])]
    .filter((item) => String(item?.referenceDate || "").trim())
    .sort((left, right) => String(left.referenceDate).localeCompare(String(right.referenceDate)));
  const documents = [...(input.documents || [])]
    .filter((item) => String(item?.deliveryDate || item?.referenceDate || "").trim());
  const events: RegulatoryTimelineEvent[] = [];

  monthly.forEach((snapshot, index) => {
    const date = String(snapshot.referenceDate);
    events.push({
      id: `${ticker}:monthly:${date}`,
      date,
      month: monthKey(date),
      kind: "monthly_snapshot",
      category: "Informe mensal",
      title: "Nova competência regulatória",
      detail: `Patrimônio líquido, VP por cota, cotas e base de investidores referentes a ${date}.`,
      severity: "information",
      sourceUrl: null,
      metadata: {
        netWorth: numeric(snapshot.netWorth),
        vpCota: numeric(snapshot.vpCota),
        sharesOutstanding: numeric(snapshot.sharesOutstanding),
        numberShareholders: numeric(snapshot.numberShareholders),
      },
    });

    if (index === 0) return;
    const previous = monthly[index - 1];
    const sharesChangePct = percentChange(previous.sharesOutstanding, snapshot.sharesOutstanding);
    if (sharesChangePct !== null && Math.abs(sharesChangePct) >= 5) {
      events.push({
        id: `${ticker}:capital:${date}`,
        date,
        month: monthKey(date),
        kind: "capital_change",
        category: "Capital",
        title: sharesChangePct > 0 ? "Aumento relevante de cotas" : "Redução relevante de cotas",
        detail: `A quantidade de cotas variou ${sharesChangePct.toFixed(2)}% em relação à competência anterior. O evento deve ser confrontado com ofertas, amortizações ou reorganizações oficiais.`,
        severity: "attention",
        sourceUrl: null,
        metadata: {
          previousShares: numeric(previous.sharesOutstanding),
          currentShares: numeric(snapshot.sharesOutstanding),
          sharesChangePct,
        },
      });
    }
  });

  documents.forEach((document, index) => {
    const date = String(document.deliveryDate || document.referenceDate);
    const type = String(document.documentType || document.category || "Documento oficial").trim();
    events.push({
      id: `${ticker}:document:${date}:${index}:${type}`,
      date,
      month: monthKey(date),
      kind: "official_document",
      category: type,
      title: documentTitle(document),
      detail: `Documento oficial ${type} disponibilizado em ${date}.`,
      severity: documentSeverity(document),
      sourceUrl: document.documentUrl || document.sourceUrl || document.url || null,
      metadata: {
        documentType: type,
      },
    });
  });

  const sorted = events.sort((left, right) =>
    right.date.localeCompare(left.date)
      || (left.kind === "capital_change" ? -1 : 1)
      || left.id.localeCompare(right.id)
  );
  const groups = Object.entries(
    sorted.reduce<Record<string, RegulatoryTimelineEvent[]>>((accumulator, event) => {
      (accumulator[event.month] ||= []).push(event);
      return accumulator;
    }, {})
  ).map(([month, monthEvents]) => ({ month, events: monthEvents }));

  return {
    ticker,
    version: "regulatory-timeline-v1",
    events: sorted,
    groups,
    counts: {
      total: sorted.length,
      monthlySnapshots: sorted.filter((event) => event.kind === "monthly_snapshot").length,
      officialDocuments: sorted.filter((event) => event.kind === "official_document").length,
      capitalChanges: sorted.filter((event) => event.kind === "capital_change").length,
    },
  };
}
