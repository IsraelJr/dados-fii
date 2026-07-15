import type { RegulatoryFund, ValidationIssue } from "@/types/regulatory";
import { normalizeTicker } from "@/lib/regulatory/RegulatoryNormalizer";

function normalizeCnpj(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 14 ? digits : "";
}

export function validCnpj(value: unknown) {
  const digits = normalizeCnpj(value);
  if (!digits || /^(\d)\1+$/.test(digits)) return false;
  const calculate = (length: number) => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculate(12) === Number(digits[12]) && calculate(13) === Number(digits[13]);
}

export function validateRegulatoryFund(fund: RegulatoryFund): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!normalizeTicker(fund.ticker)) issues.push({ code: "invalid_ticker", field: "ticker", message: "Ticker ausente ou inválido.", severity: "error" });
  if (fund.kind === "UNKNOWN") issues.push({ code: "unknown_fund_kind", field: "kind", message: "Tipo FII/FIAGRO não identificado.", severity: "error" });
  if (!fund.name && !fund.corporateName) issues.push({ code: "missing_name", field: "name", message: "Nome do fundo não informado.", severity: "warning" });
  if (!fund.cnpj) issues.push({ code: "missing_cnpj", field: "cnpj", message: "CNPJ não informado.", severity: "warning" });
  else if (!validCnpj(fund.cnpj)) issues.push({ code: "invalid_cnpj", field: "cnpj", message: "CNPJ com formato ou dígitos inválidos.", severity: "error" });
  if (!fund.segment) issues.push({ code: "missing_segment", field: "segment", message: "Segmento não informado.", severity: "warning" });
  if (!fund.sources.length) issues.push({ code: "missing_source", field: "sources", message: "Fonte regulatória não identificada.", severity: "error" });
  return issues;
}
