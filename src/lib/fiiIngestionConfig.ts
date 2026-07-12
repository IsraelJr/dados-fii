export const INGESTION_FUND_TYPES = ["FII", "FIAGRO", "FI_INFRA"] as const;
export type IngestionFundType = typeof INGESTION_FUND_TYPES[number];

export const INGESTION_ADAPTER_IDS = ["cvm-fii-v2", "cvm-fiagro-v2"] as const;
export type IngestionAdapterId = typeof INGESTION_ADAPTER_IDS[number];

export type IngestionFundConfig = {
  ticker: string;
  fundType: IngestionFundType;
  adapterId: IngestionAdapterId | null;
  operational: boolean;
  cnpj?: string;
  description: string;
  blockReason?: string;
};

export const FII_INGESTION_REGISTRY = {
  TGAR11: {
    ticker: "TGAR11",
    fundType: "FII",
    adapterId: "cvm-fii-v2",
    operational: true,
    description: "FII tradicional usado como referência do adaptador CVM FII v2.",
  },
  VGIA11: {
    ticker: "VGIA11",
    fundType: "FIAGRO",
    adapterId: "cvm-fiagro-v2",
    operational: true,
    cnpj: "41081088000109",
    description: "FIAGRO usado como referência do adaptador CVM FIAGRO v2.",
  },
  MXRF11: {
    ticker: "MXRF11",
    fundType: "FII",
    adapterId: "cvm-fii-v2",
    operational: true,
    description: "Segundo FII tradicional para teste de reutilização do adaptador.",
  },
  KNCA11: {
    ticker: "KNCA11",
    fundType: "FIAGRO",
    adapterId: "cvm-fiagro-v2",
    operational: true,
    description: "Segundo FIAGRO para teste de reutilização do adaptador.",
  },
  BODB11: {
    ticker: "BODB11",
    fundType: "FI_INFRA",
    adapterId: null,
    operational: false,
    description: "Fundo de infraestrutura reservado para a próxima família regulatória.",
    blockReason: "O adaptador FI-Infra ainda não foi desenvolvido e validado em staging.",
  },
} as const satisfies Record<string, IngestionFundConfig>;

export type RegisteredIngestionTicker = keyof typeof FII_INGESTION_REGISTRY;
export type SupportedIngestionTicker = string;

export const REGISTERED_INGESTION_TICKERS = Object.keys(FII_INGESTION_REGISTRY) as RegisteredIngestionTicker[];
export const SUPPORTED_INGESTION_TICKERS = REGISTERED_INGESTION_TICKERS.filter(
  (ticker) => FII_INGESTION_REGISTRY[ticker].operational
);

export function normalizeIngestionTicker(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function getIngestionFundConfig(value: unknown): IngestionFundConfig | null {
  const ticker = normalizeIngestionTicker(value) as RegisteredIngestionTicker;
  return FII_INGESTION_REGISTRY[ticker] || null;
}

export function isRegisteredIngestionTicker(value: unknown): value is RegisteredIngestionTicker {
  return Boolean(getIngestionFundConfig(value));
}

export function isSupportedIngestionTicker(value: unknown): value is SupportedIngestionTicker {
  return getIngestionFundConfig(value)?.operational === true;
}

export function assertSupportedIngestionTicker(value: unknown): SupportedIngestionTicker {
  const ticker = normalizeIngestionTicker(value);
  const config = getIngestionFundConfig(ticker);

  if (!config) {
    throw new Error(
      `Ticker não cadastrado para ingestão. Operacionais: ${SUPPORTED_INGESTION_TICKERS.join(", ")}.`
    );
  }

  if (!config.operational || !config.adapterId) {
    throw new Error(
      `${ticker} está bloqueado: ${config.blockReason || "não existe adaptador operacional para este tipo de fundo."}`
    );
  }

  return ticker;
}

export function getKnownIngestionCnpj(value: unknown) {
  return String(getIngestionFundConfig(value)?.cnpj || "").replace(/\D/g, "");
}

export function getIngestionAdapterId(value: unknown): IngestionAdapterId {
  const ticker = assertSupportedIngestionTicker(value);
  const adapterId = getIngestionFundConfig(ticker)?.adapterId;
  if (!adapterId) {
    throw new Error(`Adaptador não configurado para ${ticker}.`);
  }
  return adapterId;
}

export function listOperationalIngestionFunds() {
  return SUPPORTED_INGESTION_TICKERS.map((ticker) => FII_INGESTION_REGISTRY[ticker]);
}

export function listBlockedIngestionFunds() {
  return REGISTERED_INGESTION_TICKERS
    .map((ticker) => FII_INGESTION_REGISTRY[ticker])
    .filter((fund) => !fund.operational);
}
