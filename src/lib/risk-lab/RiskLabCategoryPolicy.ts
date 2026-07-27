export type RiskLabFundCategory =
  | "paper_credit"
  | "development"
  | "brick"
  | "fiagro"
  | "fi_infra"
  | "fund_of_funds"
  | "hybrid"
  | "unknown";

export interface RiskLabCategoryContext {
  fundKind?: string | null;
  segment?: string | null;
  sector?: string | null;
  regulatoryClassification?: string | null;
  isFundOfFunds?: boolean | null;
}

export interface RiskLabCategoryDecision {
  category: RiskLabFundCategory;
  calibrated: boolean;
  policyVersion: "risk-lab-category-policy-v1";
  reason: string;
}

function normalizedContext(context: RiskLabCategoryContext) {
  return [
    context.fundKind,
    context.segment,
    context.sector,
    context.regulatoryClassification,
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function classifyRiskLabCategory(context: RiskLabCategoryContext = {}): RiskLabCategoryDecision {
  const text = normalizedContext(context);
  let category: RiskLabFundCategory = "unknown";
  if (context.isFundOfFunds === true || /\bfof\b|fundo de fundos/.test(text)) category = "fund_of_funds";
  else if (/fiagro|cadeias agro|agroindustrial|agronegocio/.test(text)) category = "fiagro";
  else if (/fi-?infra|infraestrutura/.test(text)) category = "fi_infra";
  else if (/desenvolvimento|incorporacao/.test(text)) category = "development";
  else if (/papel|recebiveis|credito|cri\b/.test(text)) category = "paper_credit";
  else if (/hibrid|multiestrategia/.test(text)) category = "hybrid";
  else if (/tijolo|logistic|lajes|shopping|hospital|hotel|varejo|industrial|renda urbana/.test(text)) category = "brick";

  return {
    category,
    calibrated: category === "paper_credit",
    policyVersion: "risk-lab-category-policy-v1",
    reason: category === "paper_credit"
      ? "A metodologia 0.2.0 foi calibrada somente para fundos de crédito/papel e ainda exige participação na coorte verificada."
      : category === "unknown"
        ? "Os metadados disponíveis não permitem determinar a categoria do fundo sem inferência."
        : `A categoria ${category} ainda não possui coorte calibrada e homologada.`,
  };
}
