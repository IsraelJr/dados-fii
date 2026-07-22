const MONTHS: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  marco: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
};

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  aacute: "á",
  agrave: "à",
  acirc: "â",
  atilde: "ã",
  eacute: "é",
  ecirc: "ê",
  iacute: "í",
  oacute: "ó",
  ocirc: "ô",
  otilde: "õ",
  uacute: "ú",
  ccedil: "ç",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  ndash: "–",
  mdash: "—",
};

function decodeNamedEntity(entity: string, rawName: string) {
  const decoded = NAMED_ENTITIES[rawName.toLowerCase()];
  if (!decoded) return entity;
  return /^[A-Z]/.test(rawName) && decoded.length === 1 ? decoded.toUpperCase() : decoded;
}

function decodeHtml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, decodeNamedEntity);
}

function cleanCell(value: string) {
  return decodeHtml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function cells(html: string) {
  return [...html.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    .map((match) => cleanCell(match[1]))
    .filter(Boolean);
}

function field(allCells: string[], labels: string[]) {
  const normalizedLabels = labels.map(normalize);
  for (let index = 0; index < allCells.length - 1; index += 1) {
    if (normalizedLabels.includes(normalize(allCells[index]))) return allCells[index + 1];
  }
  throw new Error(`Campo FNET ausente: ${labels[0]}`);
}

function parseBrazilianDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) throw new Error(`Data FNET inválida: ${value}`);
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseDelivery(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error(`Data de entrega FNET inválida: ${value}`);
  return `${match[3]}-${match[2]}-${match[1]}T${match[4]}:${match[5]}:${match[6] || "00"}-03:00`;
}

function parseAmount(value: string) {
  const normalized = value.replace(/R\$\s*/gi, "").replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1000) {
    throw new Error(`Valor de provento FNET inválido: ${value}`);
  }
  return parsed;
}

function validMonth(value: string) {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12
    ? String(month).padStart(2, "0")
    : null;
}

function normalizeTemporalCompetence(value: string, informationDate: string, raw: string) {
  const informationMonth = informationDate.slice(0, 7);
  if (value <= informationMonth) return value;

  const [year, month] = value.split("-").map(Number);
  const [informationYear, informationMonthNumber] = informationMonth.split("-").map(Number);
  if (year === informationYear && month === 12 && informationMonthNumber === 1) {
    return `${year - 1}-12`;
  }
  throw new Error(`Período de referência FNET posterior à informação: ${raw}`);
}

function parseCompetence(value: string, informationDate: string) {
  const raw = decodeHtml(value).replace(/\s+/g, " ").trim();
  const monthYear = raw.match(/\b(0?[1-9]|1[0-2])\s*[-\/.]\s*(20\d{2})\b/);
  if (monthYear) {
    return normalizeTemporalCompetence(
      `${monthYear[2]}-${String(Number(monthYear[1])).padStart(2, "0")}`,
      informationDate,
      raw,
    );
  }

  const yearMonth = raw.match(/\b(20\d{2})\s*[-\/.]\s*(0?[1-9]|1[0-2])\b/);
  if (yearMonth) {
    return normalizeTemporalCompetence(
      `${yearMonth[1]}-${String(Number(yearMonth[2])).padStart(2, "0")}`,
      informationDate,
      raw,
    );
  }

  const compact = raw.match(/\b(20\d{2})(0[1-9]|1[0-2])\b/);
  if (compact) return normalizeTemporalCompetence(`${compact[1]}-${compact[2]}`, informationDate, raw);

  const shortMonthYear = raw.match(/\b(0?[1-9]|1[0-2])\s*[-\/.]\s*(\d{2})\b/);
  if (shortMonthYear) {
    return normalizeTemporalCompetence(
      `20${shortMonthYear[2]}-${String(Number(shortMonthYear[1])).padStart(2, "0")}`,
      informationDate,
      raw,
    );
  }

  const cleaned = normalize(raw);
  const monthName = Object.keys(MONTHS).find((month) => cleaned.includes(month));
  if (monthName) {
    const yearMatch = cleaned.match(/\b(20\d{2})\b/);
    const year = yearMatch?.[1] || informationDate.slice(0, 4);
    return normalizeTemporalCompetence(`${year}-${MONTHS[monthName]}`, informationDate, raw);
  }

  const tokens = cleaned.split(" ").filter(Boolean);
  if (tokens.length >= 2) {
    const month = validMonth(tokens[0]);
    const year = tokens.find((token) => /^20\d{2}$/.test(token));
    if (month && year) return normalizeTemporalCompetence(`${year}-${month}`, informationDate, raw);
  }

  throw new Error(`Período de referência FNET inválido: ${value}`);
}

export interface ParsedFnetNotice {
  ticker: string;
  fundName: string;
  informationDate: string;
  baseDate: string;
  paymentDate: string;
  competenceMonth: string;
  periodReferenceRaw: string;
  amountPerShare: number;
  incomeTaxExempt: boolean | null;
}

export interface ParsedFnetProtocol {
  referenceDate: string;
  deliveredAt: string;
  documentIdentification: string;
  version: number;
}

export function parseFnetDividendNoticeHtml(html: string): ParsedFnetNotice {
  if (!html || html.length < 100) throw new Error("HTML do aviso FNET vazio ou incompleto.");
  const allCells = cells(html);
  const informationDate = parseBrazilianDate(field(allCells, ["Data da Informação:", "Data da informação"]));
  const periodReferenceRaw = field(allCells, ["Período de referência"]);
  const exemptRaw = field(allCells, ["Rendimento isento de IR*"]).toLowerCase();
  const ticker = field(allCells, ["Código de negociação:", "Código de negociação da cota:"]).toUpperCase();

  if (!/^[A-Z]{4}\d{2}$/.test(ticker)) throw new Error(`Ticker FNET inválido: ${ticker}`);

  return {
    ticker,
    fundName: field(allCells, ["Nome do Fundo:"]),
    informationDate,
    baseDate: parseBrazilianDate(field(allCells, ["Data-base (último dia de negociação “com” direito ao provento)", "Data-base (último dia de negociação com direito ao provento)"])),
    paymentDate: parseBrazilianDate(field(allCells, ["Data do pagamento"])),
    competenceMonth: parseCompetence(periodReferenceRaw, informationDate),
    periodReferenceRaw,
    amountPerShare: parseAmount(field(allCells, ["Valor do provento (R$/unidade)", "Valor do provento por cota (R$)"])),
    incomeTaxExempt: exemptRaw.startsWith("sim") ? true : exemptRaw.startsWith("não") || exemptRaw.startsWith("nao") ? false : null,
  };
}

export function parseFnetProtocolHtml(html: string): ParsedFnetProtocol {
  if (!html || html.length < 100) throw new Error("HTML do protocolo FNET vazio ou incompleto.");
  const allCells = cells(html);
  const identification = field(allCells, ["Identificação do Documento"]);
  const normalizedIdentification = normalize(identification);
  const isDividendProtocol = normalizedIdentification.includes("rendimentos e amortizacoes")
    || normalizedIdentification.includes("pagamento de proventos");
  if (!isDividendProtocol) {
    throw new Error(`Documento FNET não é aviso estruturado de rendimentos: ${identification}`);
  }
  const version = Number(field(allCells, ["Versão"]));
  if (!Number.isInteger(version) || version < 1) throw new Error("Versão FNET inválida.");

  return {
    referenceDate: parseBrazilianDate(field(allCells, ["Data de Referência"])),
    deliveredAt: parseDelivery(field(allCells, ["Data de Entrega"])),
    documentIdentification: identification,
    version,
  };
}
