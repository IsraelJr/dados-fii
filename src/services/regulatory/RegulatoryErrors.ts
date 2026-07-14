export class RegulatoryServiceError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "RegulatoryServiceError";
    this.code = code;
    this.status = status;
  }
}

export class InvalidTickerError extends RegulatoryServiceError {
  constructor() {
    super("Ticker obrigatório ou inválido.", "INVALID_TICKER", 400);
    this.name = "InvalidTickerError";
  }
}

export class RegulatoryRepositoryError extends RegulatoryServiceError {
  constructor(message = "Falha ao consultar a base regulatória.") {
    super(message, "REGULATORY_REPOSITORY_ERROR", 500);
    this.name = "RegulatoryRepositoryError";
  }
}
