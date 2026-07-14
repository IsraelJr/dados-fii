export class RegulatoryServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "RegulatoryServiceError";
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
