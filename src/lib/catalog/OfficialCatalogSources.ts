import { createHash } from "crypto";
import { unzipSync } from "fflate";
import type { CatalogSourceSnapshot } from "@/types/fund-catalog";

const B3_INSTRUMENTS_URL = "https://bvmf.bmfbovespa.com.br/suplemento/ExecutaAcaoDownload.asp?arquivo=Titulos_Negociaveis.zip&server=L";
const CVM_REGISTRATION_URL = "https://dados.cvm.gov.br/dados/FI/CAD/DADOS/registro_fundo_classe.zip";
const CVM_MONTHLY_BASE_URL = "https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS";
const CVM_FIAGRO_MONTHLY_BASE_URL = "https://dados.cvm.gov.br/dados/FIAGRO/DOC/INF_MENSAL/DADOS";
const CVM_DAILY_BASE_URL = "https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS";
const PUBLIC_FUND_DIRECTORY_URL = "https://www.fundsexplorer.com.br";
const STATUS_INVEST_DIRECTORY_URL = "https://statusinvest.com.br";
const FII_MONTHLY_HISTORY_YEARS = 3;

export type B3InstrumentRecord = {
  ticker: string;
  isin: string | null;
  issuerCode: string;
  legalName: string;
  tradeName: string | null;
  category: string;
  kindHint: "FII" | "FIAGRO" | "FI_INFRA" | "UNKNOWN";
};

export type CvmRegistrationRecord = {
  cnpj: string;
  cvmCode: string | null;
  kind: "FII" | "FIAGRO" | "FI_INFRA";
  legalName: string;
  status: string;
  registrationDate: string | null;
  operatingSince: string | null;
  canceledAt: string | null;
  netWorth: number | null;
  netWorthDate: string | null;
  administrator: { name: string; cnpj: string | null };
  managers: Array<{ name: string; cnpj: string | null }>;
  targetAudience?: string | null;
  exclusive?: boolean | null;
  condominiumForm?: string | null;
  isFundOfFunds?: boolean | null;
  regulatoryClassification?: string | null;
};

export type CvmMonthlyGeneralRecord = Record<string, string> & {
  CNPJ_Fundo_Classe: string;
  Data_Referencia: string;
};

export type OfficialCatalogDataset = {
  fetchedAt: string;
  sources: CatalogSourceSnapshot[];
  b3: B3InstrumentRecord[];
  registrations: CvmRegistrationRecord[];
  monthlyGeneral: Map<string, CvmMonthlyGeneralRecord>;
  monthlyComplement: Map<string, Record<string, string>>;
  monthlyAssets: Map<string, Record<string, string>>;
  monthlyFiagro: Map<string, Record<string, string>>;
  dailyFunds: Map<string, Record<string, string>>;
  publicCnpjByTicker: Map<string, string>;
};

type DownloadedSource = {
  bytes: Uint8Array;
  snapshot: CatalogSourceSnapshot;
};

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function download(id: CatalogSourceSnapshot["id"], provider: string, url: string, fetchedAt: string): Promise<DownloadedSource> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { "User-Agent": "DadosFII-RegulatoryCatalog/2.0" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`${provider}: HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 1_000) throw new Error(`${provider}: arquivo oficial inesperadamente pequeno.`);
      return {
        bytes,
        snapshot: {
          id,
          provider,
          url,
          fetchedAt,
          referenceDate: null,
          sha256: sha256(bytes),
          bytes: bytes.byteLength,
        },
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(`Falha ao consultar ${provider}.`);
    }
  }
  throw lastError || new Error(`Falha ao consultar ${provider}.`);
}

function utcMonth(now: Date, offset: number) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function downloadCvmDaily(now: Date, fetchedAt: string) {
  let lastError: unknown = null;
  for (const offset of [0, -1]) {
    const month = utcMonth(now, offset);
    const url = `${CVM_DAILY_BASE_URL}/inf_diario_fi_${month}.zip`;
    try {
      return { month, download: await download("cvm-daily", "CVM — Informe Diário de Fundos", url, fetchedAt) };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha ao consultar o informe diário de fundos da CVM.");
}

async function downloadCvmFiagroMonthlySeries(now: Date, fetchedAt: string) {
  // Um arquivo de competência pode receber apenas parte das entregas no início
  // do mês. A janela curta preserva o último informe por CNPJ sem fazer uma
  // requisição por fundo e cobre administradores com prazos distintos.
  const attempts = await Promise.allSettled([-1, -2, -3].map(async (offset) => {
    const month = utcMonth(now, offset);
    const url = `${CVM_FIAGRO_MONTHLY_BASE_URL}/inf_mensal_fiagro_${month}.zip`;
    return { month, download: await download("cvm-fiagro-monthly", "CVM — Informe Mensal FIAGRO", url, fetchedAt) };
  }));
  const successful = attempts.flatMap((attempt) => attempt.status === "fulfilled" ? [attempt.value] : []);
  if (!successful.length) throw new Error("Falha ao consultar a janela recente do informe mensal FIAGRO da CVM.");
  return successful;
}

function decode(bytes: Uint8Array) {
  return new TextDecoder("windows-1252").decode(bytes).replace(/^\uFEFF/, "");
}

function zipFile(archive: Uint8Array, suffix: string) {
  const files = unzipSync(archive);
  const key = Object.keys(files).find((name) => name.toLowerCase().endsWith(suffix.toLowerCase()));
  if (!key) throw new Error(`Arquivo ${suffix} não encontrado no pacote oficial.`);
  return files[key];
}

export function parseCsvLine(line: string, delimiter = ";") {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      values.push(value.trim());
      value = "";
    } else value += character;
  }
  values.push(value.trim());
  return values;
}

function csvObjects(bytes: Uint8Array, select?: (record: Record<string, string>) => boolean) {
  const lines = decode(bytes).split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() || "");
  const result: Array<Record<string, string>> = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const values = parseCsvLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => { record[header] = values[index] || ""; });
    if (!select || select(record)) result.push(record);
  }
  return result;
}

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function isoDate(value: unknown) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function decimal(value: unknown) {
  const number = Number(String(value || "").trim().replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function validTicker(value: string) {
  return /^[A-Z0-9]{4,8}11$/.test(value);
}

function infrastructureName(value: unknown) {
  const name = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const infrastructure = /INFRAESTRUT|(?:^|\W)INFRA(?:\W|$)|(?:^|\W)FIIF(?:\W|$)|ISENTO|INCENTIVAD|DEBENTURAS? INCENTIVADAS?|TITULOS? DE DIVIDA/.test(name);
  const participationFund = /(?:^|\W)FIP(?:\W|$)|FUNDO(?:S)? DE INVESTIMENTO EM PARTICIPACO|FDO INV(?:ESTIMENTO)? EM PART/.test(name);
  const indexProduct = /(?:^|\W)ETF(?:\W|$)|FUNDO DE INDICE|FDO DE INDICE/.test(name);
  return infrastructure && !participationFund && !indexProduct;
}

function validIsin(value: string) {
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(value)) return false;
  const expanded = value.split("").map((character) => /\d/.test(character) ? character : String(character.charCodeAt(0) - 55)).join("");
  let sum = 0;
  let double = false;
  for (let index = expanded.length - 1; index >= 0; index -= 1) {
    let number = Number(expanded[index]);
    if (double) {
      number *= 2;
      if (number > 9) number -= 9;
    }
    sum += number;
    double = !double;
  }
  return sum % 10 === 0;
}

export function publicDirectoryCnpj(html: string, expectedTicker?: string) {
  if (expectedTicker && !new RegExp(`(?:^|[^A-Z0-9])${expectedTicker}(?:[^A-Z0-9]|$)`, "i").test(html)) return null;
  const match = html.match(/headerTicker__content__cnpj[^>]*>[\s\S]{0,160}?<b>(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})<\/b>/i)
    || html.match(/"cnpj":"(\d{2}\.\d{3}\.\d{3}\\?\/\d{4}-\d{2})"/i)
    // Status Invest renders the fund CNPJ before the administrator data. The
    // bounded expression deliberately avoids accepting any CNPJ elsewhere on
    // an error/search page.
    || html.match(/(?:CNPJ|Cnpj)[\s\S]{0,700}?(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/i);
  const cnpj = digits(match?.[1]);
  return cnpj.length === 14 ? cnpj : null;
}

function publicDirectoryUrls(instrument: B3InstrumentRecord) {
  const ticker = instrument.ticker.toLowerCase();
  const fundsExplorerSection = instrument.kindHint === "FII" ? "funds" : instrument.kindHint === "FIAGRO" ? "fiagros" : "fiinfras";
  const statusInvestSection = instrument.kindHint === "FII" ? "fundos-imobiliarios" : instrument.kindHint === "FIAGRO" ? "fiagros" : "fiinfras";
  return [
    `${PUBLIC_FUND_DIRECTORY_URL}/${fundsExplorerSection}/${ticker}`,
    `${STATUS_INVEST_DIRECTORY_URL}/${statusInvestSection}/${ticker}`,
  ];
}

async function fetchPublicIdentityBridges(instruments: B3InstrumentRecord[], knownCnpjByTicker: ReadonlyMap<string, string>) {
  const pending = instruments.filter((instrument) => !knownCnpjByTicker.has(instrument.ticker));
  const mappings = new Map<string, string>();
  let downloadedBytes = 0;
  for (let offset = 0; offset < pending.length; offset += 12) {
    const group = pending.slice(offset, offset + 12);
    const results = await Promise.all(group.map(async (instrument) => {
      for (const url of publicDirectoryUrls(instrument)) {
        try {
          const response = await fetch(url, {
            cache: "no-store",
            headers: { "User-Agent": "DadosFII-CatalogIdentityBridge/1.1", Accept: "text/html" },
            signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) continue;
          const html = await response.text();
          const cnpj = publicDirectoryCnpj(html, instrument.ticker);
          if (cnpj) return { ticker: instrument.ticker, cnpj, bytes: Buffer.byteLength(html, "utf8") };
        } catch {
          // A ponte é opcional e só resolve identidades que permaneceram
          // ambíguas. Falha de um diretório não interrompe as fontes oficiais.
        }
      }
      return null;
    }));
    for (const result of results) if (result) {
      mappings.set(result.ticker, result.cnpj);
      downloadedBytes += result.bytes;
    }
  }
  return { mappings, downloadedBytes };
}

/**
 * Segunda etapa opcional: consulta apenas os tickers que permaneceram
 * ambíguos após a conciliação em lote B3+CVM. O diretório fornece somente a
 * ponte ticker/CNPJ; todos os dados publicados continuam vindo da CVM.
 */
export async function augmentWithPublicIdentityBridge(dataset: OfficialCatalogDataset, tickers: Iterable<string>) {
  const wanted = new Set(Array.from(tickers, (ticker) => String(ticker).trim().toUpperCase()));
  const candidates = dataset.b3.filter((instrument) => wanted.has(instrument.ticker));
  if (!candidates.length) return dataset;
  const identityBridge = await fetchPublicIdentityBridges(candidates, new Map());
  if (!identityBridge.mappings.size) return dataset;
  const source: CatalogSourceSnapshot = {
    id: "public-fund-directory",
    provider: "Diretórios públicos — ponte ticker/CNPJ validada no cadastro CVM",
    url: STATUS_INVEST_DIRECTORY_URL,
    fetchedAt: dataset.fetchedAt,
    referenceDate: dataset.fetchedAt.slice(0, 10),
    sha256: sha256(new TextEncoder().encode(JSON.stringify(Array.from(identityBridge.mappings).sort()))),
    bytes: identityBridge.downloadedBytes,
  };
  return {
    ...dataset,
    sources: [...dataset.sources.filter((item) => item.id !== "public-fund-directory"), source],
    publicCnpjByTicker: new Map([...dataset.publicCnpjByTicker, ...identityBridge.mappings]),
  };
}

export function parseB3Instruments(bytes: Uint8Array) {
  const lines = decode(bytes).split(/\r?\n/);
  let issuerCode = "";
  let legalName = "";
  let tradeName: string | null = null;
  const records: B3InstrumentRecord[] = [];
  for (const line of lines) {
    if (line.startsWith("01")) {
      issuerCode = line.slice(2, 6).trim();
      legalName = line.slice(6, 66).trim();
      tradeName = line.slice(66, 86).trim() || null;
      continue;
    }
    if (!line.startsWith("02")) continue;
    const ticker = line.slice(2, 14).trim().toUpperCase();
    const category = line.slice(21, 81).trim();
    const market = line.slice(111, 126).trim();
    if (market !== "VISTA" || !validTicker(ticker)) continue;
    const rawIsin = line.slice(81, 93).trim().toUpperCase();
    const fullName = `${legalName} ${tradeName || ""}`;
    const fiagroName = /FIAGRO|FI-?AGRO|CADEIAS? PRODUTIVAS? (?:DO )?AGRO|AGROINDUSTRIAIS?/i.test(fullName);
    const fiInfraName = infrastructureName(fullName);
    const kindHint = category === "FUNDOS IMOBILIARIOS"
      ? "FII"
      : category === "CERT.INVEST/TIT.DIV.PUBLICA" && fiagroName ? "FIAGRO"
        : category === "CERT.INVEST/TIT.DIV.PUBLICA" && fiInfraName ? "FI_INFRA" : "UNKNOWN";
    if (kindHint === "UNKNOWN") continue;
    records.push({
      ticker,
      isin: validIsin(rawIsin) ? rawIsin : null,
      issuerCode,
      legalName,
      tradeName,
      category,
      kindHint,
    });
  }
  return Array.from(new Map(records.map((record) => [record.ticker, record])).values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
}

export function parseCvmRegistrations(fundBytes: Uint8Array, classBytes?: Uint8Array) {
  const allFundRows = csvObjects(fundBytes, (record) => ["FII", "FIAGRO", "FI"].includes(record.Tipo_Fundo));
  const raw = allFundRows.filter((record) => ["FII", "FIAGRO"].includes(record.Tipo_Fundo)
    || (record.Tipo_Fundo === "FI" && infrastructureName(record.Denominacao_Social)));
  const grouped = new Map<string, CvmRegistrationRecord>();
  const providersByFundId = new Map<string, { administrator: CvmRegistrationRecord["administrator"]; managers: CvmRegistrationRecord["managers"] }>();
  for (const row of allFundRows) {
    const manager = { name: row.Gestor.trim(), cnpj: digits(row.CPF_CNPJ_Gestor).length === 14 ? digits(row.CPF_CNPJ_Gestor) : null };
    const existingProviders = providersByFundId.get(row.ID_Registro_Fundo);
    if (existingProviders) {
      if (manager.name && !existingProviders.managers.some((item) => item.name === manager.name && item.cnpj === manager.cnpj)) existingProviders.managers.push(manager);
    } else providersByFundId.set(row.ID_Registro_Fundo, {
      administrator: {
        name: row.Administrador.trim(),
        cnpj: digits(row.CNPJ_Administrador).length === 14 ? digits(row.CNPJ_Administrador) : null,
      },
      managers: manager.name ? [manager] : [],
    });
  }
  for (const row of raw) {
    const cnpj = digits(row.CNPJ_Fundo);
    if (cnpj.length !== 14) continue;
    const kind = row.Tipo_Fundo === "FI" ? "FI_INFRA" : row.Tipo_Fundo as "FII" | "FIAGRO";
    const key = [cnpj, kind, row.Situacao, row.Data_Inicio_Situacao, row.Data_Cancelamento].join(":");
    const manager = { name: row.Gestor.trim(), cnpj: digits(row.CPF_CNPJ_Gestor).length === 14 ? digits(row.CPF_CNPJ_Gestor) : null };
    const existing = grouped.get(key);
    if (existing) {
      if (manager.name && !existing.managers.some((item) => item.name === manager.name && item.cnpj === manager.cnpj)) existing.managers.push(manager);
      continue;
    }
    grouped.set(key, {
      cnpj,
      cvmCode: row.Codigo_CVM.trim() || null,
      kind,
      legalName: row.Denominacao_Social.trim(),
      status: row.Situacao.trim(),
      registrationDate: isoDate(row.Data_Registro),
      operatingSince: isoDate(row.Data_Constituicao) || isoDate(row.Data_Registro),
      canceledAt: isoDate(row.Data_Cancelamento),
      netWorth: decimal(row.Patrimonio_Liquido),
      netWorthDate: isoDate(row.Data_Patrimonio_Liquido),
      administrator: {
        name: row.Administrador.trim(),
        cnpj: digits(row.CNPJ_Administrador).length === 14 ? digits(row.CNPJ_Administrador) : null,
      },
      managers: manager.name ? [manager] : [],
      targetAudience: null,
      exclusive: null,
      condominiumForm: null,
      isFundOfFunds: null,
      regulatoryClassification: null,
    });
  }
  if (!classBytes) return Array.from(grouped.values());

  const fundRecords = Array.from(grouped.values());
  const infrastructureFundIds = new Set(raw.filter((record) => record.Tipo_Fundo === "FI").map((record) => record.ID_Registro_Fundo));
  const classRecords = csvObjects(classBytes, (record) => /Fundos (?:FII|FIAGRO)/i.test(record.Tipo_Classe)
    || (/Fundos FIF/i.test(record.Tipo_Classe)
      && (infrastructureFundIds.has(record.ID_Registro_Fundo) || infrastructureName(record.Denominacao_Social))));
  const classCnpjs = new Set<string>();
  const classResult = new Map<string, CvmRegistrationRecord>();
  for (const row of classRecords) {
    const cnpj = digits(row.CNPJ_Classe);
    if (cnpj.length !== 14) continue;
    classCnpjs.add(cnpj);
    const kind = /FIAGRO/i.test(row.Tipo_Classe) ? "FIAGRO" : /FII/i.test(row.Tipo_Classe) ? "FII" : "FI_INFRA";
    const providers = providersByFundId.get(row.ID_Registro_Fundo) || { administrator: { name: "", cnpj: null }, managers: [] };
    const key = [cnpj, kind, row.Situacao, row.Data_Inicio_Situacao].join(":");
    classResult.set(key, {
      cnpj,
      cvmCode: row.Codigo_CVM.trim() || null,
      kind,
      legalName: row.Denominacao_Social.trim(),
      status: row.Situacao.trim(),
      registrationDate: isoDate(row.Data_Registro),
      operatingSince: isoDate(row.Data_Inicio) || isoDate(row.Data_Constituicao) || isoDate(row.Data_Registro),
      canceledAt: /cancel/i.test(row.Situacao) ? isoDate(row.Data_Inicio_Situacao) : null,
      netWorth: decimal(row.Patrimonio_Liquido),
      netWorthDate: isoDate(row.Data_Patrimonio_Liquido),
      administrator: providers.administrator,
      managers: providers.managers,
      targetAudience: String(row.Publico_Alvo || "").trim() || null,
      exclusive: /^S$/i.test(String(row.Exclusivo || "").trim()) ? true : /^N$/i.test(String(row.Exclusivo || "").trim()) ? false : null,
      condominiumForm: String(row.Forma_Condominio || "").trim() || null,
      isFundOfFunds: /^S$/i.test(String(row.Classe_Cotas || "").trim()) ? true : /^N$/i.test(String(row.Classe_Cotas || "").trim()) ? false : null,
      regulatoryClassification: String(row.Classificacao || "").trim() || null,
    });
  }
  for (const record of fundRecords) {
    if (!classCnpjs.has(record.cnpj)) classResult.set([record.cnpj, record.kind, record.status, record.registrationDate].join(":"), record);
  }
  return Array.from(classResult.values());
}

function investorBreakdownField(row: Record<string, string>) {
  return Object.keys(row).find((key) => normalizedHeader(key) === "NUMEROCOTISTASPESSOAFISICA");
}

function hasInvestorBreakdown(row: Record<string, string>) {
  const field = investorBreakdownField(row);
  return Boolean(field && String(row[field] || "").trim());
}

function copyInvestorBreakdown(target: Record<string, string>, breakdown: Record<string, string>) {
  for (const [key, value] of Object.entries(breakdown)) {
    const normalized = normalizedHeader(key);
    if (normalized === "TOTALNUMEROCOTISTAS" || normalized.startsWith("NUMEROCOTISTAS")) target[key] = value;
  }
  target.Data_Referencia_Composicao_Cotistas = breakdown.Data_Referencia_Composicao_Cotistas
    || breakdown.Data_Informacao_Numero_Cotistas || breakdown.Data_Referencia || target.Data_Referencia;
}

function latestByCnpj(bytes: Uint8Array, options?: { preserveInvestorBreakdown?: boolean }) {
  const rows = csvObjects(bytes);
  const latest = new Map<string, Record<string, string>>();
  const latestInvestorBreakdown = new Map<string, Record<string, string>>();
  for (const row of rows) {
    const cnpj = digits(row.CNPJ_Fundo_Classe || row.CNPJ_Classe || row.CNPJ_Fundo);
    if (cnpj.length !== 14) continue;
    const current = latest.get(cnpj);
    const reference = row.Data_Referencia || "";
    const currentReference = current?.Data_Referencia || "";
    const version = Number(row.Versao || 0);
    const currentVersion = Number(current?.Versao || 0);
    if (!current || reference > currentReference || (reference === currentReference && version > currentVersion)) latest.set(cnpj, row);
    if (options?.preserveInvestorBreakdown) {
      if (hasInvestorBreakdown(row)) {
        const currentBreakdown = latestInvestorBreakdown.get(cnpj);
        const breakdownReference = row.Data_Informacao_Numero_Cotistas || row.Data_Referencia || "";
        const currentBreakdownReference = currentBreakdown?.Data_Informacao_Numero_Cotistas || currentBreakdown?.Data_Referencia || "";
        const currentBreakdownVersion = Number(currentBreakdown?.Versao || 0);
        if (!currentBreakdown || breakdownReference > currentBreakdownReference
          || (breakdownReference === currentBreakdownReference && version > currentBreakdownVersion)) latestInvestorBreakdown.set(cnpj, row);
      }
    }
  }
  if (options?.preserveInvestorBreakdown) {
    for (const [cnpj, breakdown] of latestInvestorBreakdown) {
      const current = latest.get(cnpj);
      if (!current) continue;
      copyInvestorBreakdown(current, breakdown);
    }
  }
  return latest;
}

export function parseLatestFiiComplement(bytes: Uint8Array) {
  return latestByCnpj(bytes, { preserveInvestorBreakdown: true });
}

function mergeInvestorBreakdownFallback(
  current: Map<string, Record<string, string>>,
  fallback: Map<string, Record<string, string>>,
) {
  const result = new Map(Array.from(current, ([cnpj, row]) => [cnpj, { ...row }]));
  for (const [cnpj, fallbackRow] of fallback) {
    const row = result.get(cnpj);
    if (!row) {
      result.set(cnpj, { ...fallbackRow });
      continue;
    }
    if (!hasInvestorBreakdown(row) && hasInvestorBreakdown(fallbackRow)) copyInvestorBreakdown(row, fallbackRow);
  }
  return result;
}

function sumFields(row: Record<string, string>, fields: string[]) {
  return fields.reduce((sum, field) => sum + (decimal(row[field]) || 0), 0);
}

/** Normaliza o layout próprio do FIAGRO para o contrato interno já usado pelo catálogo. */
export function parseFiagroMonthly(bytes: Uint8Array) {
  const raw = latestByCnpj(bytes);
  const general = new Map<string, CvmMonthlyGeneralRecord>();
  const complement = new Map<string, Record<string, string>>();
  const assets = new Map<string, Record<string, string>>();
  for (const [cnpj, row] of raw) {
    const referenceDate = row.Data_Referencia;
    general.set(cnpj, {
      ...row,
      CNPJ_Fundo_Classe: cnpj,
      Nome_Fundo_Classe: row.Nome_Classe,
      Data_Referencia: referenceDate,
      Quantidade_Cotas_Emitidas: row.Cotas_Emitidas,
    } as CvmMonthlyGeneralRecord);
    complement.set(cnpj, {
      Data_Referencia: referenceDate,
      Patrimonio_Liquido: row.Patrimonio_Liquido,
      Cotas_Emitidas: row.Cotas_Emitidas,
      Valor_Patrimonial_Cotas: row.Valor_Patrimonial_Cotas,
      Total_Numero_Cotistas: row.Numero_Cotistas,
      Numero_Cotistas_Pessoa_Fisica: row.Numero_Cotistas_Pessoa_Natural,
      Numero_Cotistas_Pessoa_Juridica_Nao_Financeira: row.Numero_Cotistas_Pessoa_Juridica_Nao_Financeira,
      Numero_Cotistas_Outras_Pessoas_Juridicas_Financeira: row.Numero_Cotistas_Pessoa_Juridica_Financeira,
      Numero_Cotistas_Investidores_Nao_Residentes: row.Numero_Cotistas_Investidor_Nao_Residente,
      Numero_Cotistas_Entidade_Fechada_Previdencia_Complementar: row.Numero_Cotistas_Entidade_Previdencia_Complementar_Exceto_RPPS,
      Numero_Cotistas_Regime_Proprio_Previdencia_Servidores_Publicos: row.Numero_Cotistas_Entidade_RPPS,
      Numero_Cotistas_Sociedade_Seguradora_Resseguradora: row.Numero_Cotistas_Sociedade_Seguradora_Resseguradora,
      Numero_Cotistas_Outros_Fundos: row.Numero_Cotistas_Fundos_Investimento,
      Numero_Cotistas_Distribuidores_Fundo: row.Numero_Cotistas_Distribuidos_Conta_Ordem,
      Numero_Cotistas_Outros_Tipos: row.Numero_Cotistas_Outros_Tipos,
    });
    assets.set(cnpj, {
      ...row,
      Data_Referencia: referenceDate,
      Direitos_Bens_Imoveis: row.Imoveis_Rurais,
      Participacoes_Societarias: row.Participacoes_Societarias,
      CRI_CRA: String(sumFields(row, [
        "Titulos_Divida_Corporativa",
        "Valor_Titulos_Credito",
        "Demais_Direitos_Creditorios",
        "Titulos_Securitizacao",
      ])),
      FII: row.Cotas_Fundos_Investimento,
      FIDC: "0",
    });
  }
  return { raw, general, complement, assets };
}

function mergeLatest<T extends Record<string, string>>(base: Map<string, T>, additions: Map<string, T>) {
  const result = new Map(base);
  for (const [cnpj, row] of additions) {
    const current = result.get(cnpj);
    if (!current || String(row.Data_Referencia || "") >= String(current.Data_Referencia || "")) result.set(cnpj, row);
  }
  return result;
}

function normalizedHeader(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

export function parseLatestDailyFunds(bytes: Uint8Array, allowedCnpjs: Set<string>) {
  const lines = decode(bytes).split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() || "");
  const indexByHeader = new Map(headers.map((header, index) => [normalizedHeader(header), index]));
  const cnpjIndex = indexByHeader.get("CNPJFUNDOCLASSE") ?? indexByHeader.get("CNPJFUNDO");
  const dateIndex = indexByHeader.get("DTCOMPTC") ?? indexByHeader.get("DATAREFERENCIA");
  if (cnpjIndex === undefined || dateIndex === undefined) throw new Error("Layout do informe diário da CVM não reconhecido.");
  const latest = new Map<string, Record<string, string>>();
  for (const line of lines) {
    if (!line.trim()) continue;
    const values = parseCsvLine(line);
    const cnpj = digits(values[cnpjIndex]);
    if (!allowedCnpjs.has(cnpj)) continue;
    const reference = values[dateIndex] || "";
    const currentReference = latest.get(cnpj)?.DT_COMPTC || latest.get(cnpj)?.Data_Referencia || "";
    if (reference < currentReference) continue;
    const row: Record<string, string> = {};
    headers.forEach((header, index) => { row[header] = values[index] || ""; });
    const current = latest.get(cnpj);
    const holdersHeader = headers.find((header) => normalizedHeader(header) === "NRCOTST");
    if (holdersHeader) {
      const reportedHolders = decimal(row[holdersHeader]);
      const previousHolders = decimal(current?.[holdersHeader]);
      if ((!reportedHolders || reportedHolders <= 0) && previousHolders && previousHolders > 0) {
        row[holdersHeader] = current![holdersHeader];
        row.NR_COTST_REFERENCE_DATE = current!.NR_COTST_REFERENCE_DATE || currentReference;
      } else if (reportedHolders && reportedHolders > 0) row.NR_COTST_REFERENCE_DATE = reference;
    }
    latest.set(cnpj, row);
  }
  return latest;
}

function maximumReference(...maps: Array<Map<string, Record<string, string>>>) {
  let maximum: string | null = null;
  for (const map of maps) for (const row of map.values()) {
    const value = isoDate(row.Data_Referencia || row.DT_COMPTC);
    if (value && (!maximum || value > maximum)) maximum = value;
  }
  return maximum;
}

export async function fetchOfficialCatalogDataset(
  now = new Date(),
  options?: { knownCnpjByTicker?: ReadonlyMap<string, string>; enablePublicIdentityBridge?: boolean },
) : Promise<OfficialCatalogDataset> {
  const fetchedAt = now.toISOString();
  const year = now.getUTCFullYear();
  const monthlyYears = Array.from({ length: FII_MONTHLY_HISTORY_YEARS }, (_, index) => year - index).sort();
  const [b3Download, registrationDownload, monthlyDownloads, fiagroResults, dailyResult] = await Promise.all([
    download("b3-instruments", "B3 — Títulos Negociáveis", B3_INSTRUMENTS_URL, fetchedAt),
    download("cvm-registration", "CVM — Cadastro de Fundos e Classes", CVM_REGISTRATION_URL, fetchedAt),
    Promise.all(monthlyYears.map((monthlyYear) => download(
      "cvm-monthly",
      `CVM — Informe Mensal FII ${monthlyYear}`,
      `${CVM_MONTHLY_BASE_URL}/inf_mensal_fii_${monthlyYear}.zip`,
      fetchedAt,
    ))),
    downloadCvmFiagroMonthlySeries(now, fetchedAt),
    downloadCvmDaily(now, fetchedAt),
  ]);

  const b3 = parseB3Instruments(zipFile(b3Download.bytes, "TITULOS_NEGOCIAVEIS.TXT"));
  const registrations = parseCvmRegistrations(
    zipFile(registrationDownload.bytes, "registro_fundo.csv"),
    zipFile(registrationDownload.bytes, "registro_classe.csv"),
  );
  let fiiGeneral = new Map<string, CvmMonthlyGeneralRecord>();
  let fiiComplement = new Map<string, Record<string, string>>();
  let fiiAssets = new Map<string, Record<string, string>>();
  monthlyDownloads.forEach((downloaded, index) => {
    const monthlyYear = monthlyYears[index];
    const yearlyGeneral = latestByCnpj(zipFile(downloaded.bytes, `inf_mensal_fii_geral_${monthlyYear}.csv`)) as Map<string, CvmMonthlyGeneralRecord>;
    const yearlyComplement = parseLatestFiiComplement(zipFile(downloaded.bytes, `inf_mensal_fii_complemento_${monthlyYear}.csv`));
    const yearlyAssets = latestByCnpj(zipFile(downloaded.bytes, `inf_mensal_fii_ativo_passivo_${monthlyYear}.csv`));
    const previousComplement = fiiComplement;
    fiiGeneral = mergeLatest(fiiGeneral, yearlyGeneral);
    fiiComplement = mergeInvestorBreakdownFallback(mergeLatest(fiiComplement, yearlyComplement), previousComplement);
    fiiAssets = mergeLatest(fiiAssets, yearlyAssets);
  });
  const fiagro = fiagroResults
    .map((result) => parseFiagroMonthly(zipFile(result.download.bytes, `inf_mensal_fiagro_${result.month}.csv`)))
    .reduce((combined, current) => ({
      raw: mergeLatest(combined.raw, current.raw),
      general: mergeLatest(combined.general, current.general),
      complement: mergeLatest(combined.complement, current.complement),
      assets: mergeLatest(combined.assets, current.assets),
    }), {
      raw: new Map<string, Record<string, string>>(),
      general: new Map<string, CvmMonthlyGeneralRecord>(),
      complement: new Map<string, Record<string, string>>(),
      assets: new Map<string, Record<string, string>>(),
    });
  const monthlyGeneral = mergeLatest(fiiGeneral, fiagro.general);
  const monthlyComplement = mergeLatest(fiiComplement, fiagro.complement);
  const monthlyAssets = mergeLatest(fiiAssets, fiagro.assets);
  const monthlyIsins = new Set(Array.from(monthlyGeneral.values()).map((row) => String(row.Codigo_ISIN || "").trim().toUpperCase()).filter(Boolean));
  const knownCnpjByTicker = options?.knownCnpjByTicker || new Map<string, string>();
  const bridgeCandidates = options?.enablePublicIdentityBridge
    ? b3.filter((instrument) => !knownCnpjByTicker.has(instrument.ticker)
      && (!instrument.isin || !monthlyIsins.has(instrument.isin)))
    : [];
  const identityBridge = await fetchPublicIdentityBridges(bridgeCandidates, knownCnpjByTicker);
  // Depois da Resolução CVM 175, vários FIAGRO passaram a publicar patrimônio,
  // cota e total de cotistas no informe diário de FI, não mais no informe FII.
  const dailyEligibleCnpjs = new Set(registrations
    .filter((record) => record.kind === "FI_INFRA" || record.kind === "FIAGRO")
    .map((record) => record.cnpj));
  const dailyFunds = parseLatestDailyFunds(
    zipFile(dailyResult.download.bytes, `inf_diario_fi_${dailyResult.month}.csv`),
    dailyEligibleCnpjs,
  );
  const monthlyReference = maximumReference(monthlyGeneral, monthlyComplement, monthlyAssets);
  const monthlyAggregateHash = sha256(new TextEncoder().encode(JSON.stringify([
    ...monthlyDownloads.map((downloaded, index) => [monthlyYears[index], downloaded.snapshot.sha256]),
  ])));
  const monthlyAggregateBytes = monthlyDownloads.reduce((sum, downloaded) => sum + downloaded.snapshot.bytes, 0);
  const fiagroReference = maximumReference(fiagro.raw);
  const fiagroBytes = fiagroResults.reduce((sum, result) => sum + result.download.snapshot.bytes, 0);
  const fiagroAggregateHash = sha256(new TextEncoder().encode(JSON.stringify(fiagroResults
    .map((result) => [result.month, result.download.snapshot.sha256]).sort())));
  const dailyReference = maximumReference(dailyFunds);
  const sources = [
    { ...b3Download.snapshot, referenceDate: fetchedAt.slice(0, 10) },
    { ...registrationDownload.snapshot, referenceDate: fetchedAt.slice(0, 10) },
    {
      id: "cvm-monthly" as const,
      provider: `CVM — Informe Mensal FII (janela ${monthlyYears[0]}–${year})`,
      url: CVM_MONTHLY_BASE_URL,
      fetchedAt,
      referenceDate: monthlyReference,
      sha256: monthlyAggregateHash,
      bytes: monthlyAggregateBytes,
    },
    {
      id: "cvm-fiagro-monthly" as const,
      provider: "CVM — Informe Mensal FIAGRO (janela consolidada)",
      url: CVM_FIAGRO_MONTHLY_BASE_URL,
      fetchedAt,
      referenceDate: fiagroReference,
      sha256: fiagroAggregateHash,
      bytes: fiagroBytes,
    },
    { ...dailyResult.download.snapshot, referenceDate: dailyReference },
    ...(identityBridge.mappings.size ? [{
      id: "public-fund-directory" as const,
      provider: "Diretórios públicos — ponte ticker/CNPJ validada no cadastro CVM",
      url: STATUS_INVEST_DIRECTORY_URL,
      fetchedAt,
      referenceDate: fetchedAt.slice(0, 10),
      sha256: sha256(new TextEncoder().encode(JSON.stringify(Array.from(identityBridge.mappings).sort()))),
      bytes: identityBridge.downloadedBytes,
    }] : []),
  ];
  return {
    fetchedAt,
    sources,
    b3,
    registrations,
    monthlyGeneral,
    monthlyComplement,
    monthlyAssets,
    monthlyFiagro: fiagro.raw,
    dailyFunds,
    publicCnpjByTicker: identityBridge.mappings,
  };
}

export const OFFICIAL_CATALOG_SOURCE_URLS = {
  b3: B3_INSTRUMENTS_URL,
  cvmRegistration: CVM_REGISTRATION_URL,
  cvmMonthly: CVM_MONTHLY_BASE_URL,
  cvmDaily: CVM_DAILY_BASE_URL,
  publicFundDirectory: PUBLIC_FUND_DIRECTORY_URL,
} as const;
