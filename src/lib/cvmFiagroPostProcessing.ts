import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { isMeaningfulFiagroFieldValue } from "@/lib/fiagroFieldMapping";

type RawFragment = {
  sourceKind?: string;
  sourceFile?: string;
  raw?: Record<string, unknown>;
};

type Candidate = {
  value?: number | string;
  sourceFile?: string;
};

function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function firstValue(row: Record<string, unknown>, candidates: string[]) {
  const entries = Object.entries(row || {});
  const normalized = candidates.map(normalizeKey);

  for (const candidate of normalized) {
    const exact = entries.find(([key]) => normalizeKey(key) === candidate);
    if (exact && exact[1] !== null && exact[1] !== undefined && String(exact[1]).trim() !== "") {
      return exact[1];
    }
  }

  return undefined;
}

function numberOf(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const numeric = text.replace(/[^0-9,.-]/g, "");
  if (!numeric) return undefined;
  const normalized = numeric.includes(",")
    ? numeric.replace(/\./g, "").replace(",", ".")
    : numeric;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function findCandidate(
  fragments: RawFragment[],
  fields: string[],
  options?: { preferredKinds?: string[]; numeric?: boolean; mappedField?: string }
): Candidate {
  const preferredKinds = options?.preferredKinds || [];
  const ordered = [...fragments].sort((left, right) => {
    const leftIndex = preferredKinds.indexOf(String(left.sourceKind || ""));
    const rightIndex = preferredKinds.indexOf(String(right.sourceKind || ""));
    const leftScore = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
    const rightScore = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;
    return leftScore - rightScore;
  });

  for (const fragment of ordered) {
    const raw = fragment?.raw && typeof fragment.raw === "object" ? fragment.raw : null;
    if (!raw) continue;
    const rawValue = firstValue(raw, fields);
    const value = options?.numeric ? numberOf(rawValue) : rawValue;
    const mappedField = options?.mappedField || fields[0] || "unknown";
    if (isMeaningfulFiagroFieldValue(mappedField, value)) {
      return { value: value as number | string, sourceFile: fragment.sourceFile };
    }
  }

  return {};
}

function materiallyDifferent(left: unknown, right: unknown) {
  if (left === undefined || left === null || right === undefined || right === null) return false;
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) > Math.max(0.000001, Math.abs(left) * 0.000001);
  }
  return String(left) !== String(right);
}

export async function reconcileFiagroMonthlyFields(input: {
  runId: string;
  ticker: string;
}) {
  const collection = adminDb
    .collection("FiiIngestionStaging")
    .doc(input.runId)
    .collection("MonthlySnapshots");
  const snapshot = await collection.limit(100).get();

  let batch = adminDb.batch();
  let operations = 0;
  let reconciled = 0;
  const incompleteSnapshots: string[] = [];
  const conflictsFound: Array<Record<string, unknown>> = [];

  for (const doc of snapshot.docs) {
    const data = (doc.data() || {}) as Record<string, any>;
    const fragments = Array.isArray(data.rawFragments)
      ? data.rawFragments as RawFragment[]
      : [];

    const fundName = findCandidate(fragments, [
      "Nome_Classe",
      "Nome_Subclasse",
    ], { preferredKinds: ["fiagro_mensal", "subclasse"], mappedField: "fundName" });
    const netWorth = findCandidate(fragments, [
      "Patrimonio_Liquido",
    ], { preferredKinds: ["fiagro_mensal"], numeric: true, mappedField: "netWorth" });
    const sharesOutstanding = findCandidate(fragments, [
      "Cotas_Emitidas",
      "Numero_Cotas",
    ], {
      preferredKinds: ["fiagro_mensal", "subclasse"],
      numeric: true,
      mappedField: "sharesOutstanding",
    });
    const numberShareholders = findCandidate(fragments, [
      "Numero_Cotistas",
    ], { preferredKinds: ["fiagro_mensal"], numeric: true, mappedField: "numberShareholders" });
    const vpCota = findCandidate(fragments, [
      "Valor_Patrimonial_Cotas",
      "Valor_Patrimonial_Cota",
    ], { preferredKinds: ["fiagro_mensal", "subclasse"], numeric: true, mappedField: "vpCota" });
    const totalPortfolioValue = findCandidate(fragments, [
      "Valor_Ativo",
    ], { preferredKinds: ["fiagro_mensal"], numeric: true, mappedField: "totalPortfolioValue" });

    const conflicts: Array<Record<string, unknown>> = [];
    const crossChecks = [
      {
        field: "sharesOutstanding",
        primary: "Cotas_Emitidas",
        fallback: "Numero_Cotas",
      },
      {
        field: "vpCota",
        primary: "Valor_Patrimonial_Cotas",
        fallback: "Valor_Patrimonial_Cota",
      },
    ];

    for (const check of crossChecks) {
      const primary = findCandidate(fragments, [check.primary], {
        preferredKinds: ["fiagro_mensal"],
        numeric: true,
        mappedField: check.field,
      });
      const fallback = findCandidate(fragments, [check.fallback], {
        preferredKinds: ["subclasse"],
        numeric: true,
        mappedField: check.field,
      });
      if (materiallyDifferent(primary.value, fallback.value)) {
        const conflict = {
          field: check.field,
          kept: primary.value,
          incoming: fallback.value,
          sourceFile: fallback.sourceFile || "unknown",
        };
        conflicts.push(conflict);
        conflictsFound.push({ referenceDate: data.referenceDate || doc.id, ...conflict });
      }
    }

    const update = {
      ticker: input.ticker,
      fundName: fundName.value ?? data.fundName ?? null,
      netWorth: netWorth.value ?? data.netWorth ?? null,
      sharesOutstanding: sharesOutstanding.value ?? data.sharesOutstanding ?? null,
      numberShareholders: numberShareholders.value ?? data.numberShareholders ?? null,
      vpCota: vpCota.value ?? data.vpCota ?? null,
      totalPortfolioValue: totalPortfolioValue.value ?? data.totalPortfolioValue ?? null,
      conflicts,
      fieldSources: {
        fundName: fundName.sourceFile || null,
        netWorth: netWorth.sourceFile || null,
        sharesOutstanding: sharesOutstanding.sourceFile || null,
        numberShareholders: numberShareholders.sourceFile || null,
        vpCota: vpCota.sourceFile || null,
        totalPortfolioValue: totalPortfolioValue.sourceFile || null,
      },
      fiagroMonthlyReconciledAt: adminFieldValue.serverTimestamp(),
    };

    if (
      update.netWorth === null
      || update.sharesOutstanding === null
      || update.numberShareholders === null
      || update.vpCota === null
    ) {
      incompleteSnapshots.push(String(data.referenceDate || doc.id));
    }

    batch.set(doc.ref, update, { merge: true });
    operations += 1;
    reconciled += 1;

    if (operations >= 400) {
      await batch.commit();
      batch = adminDb.batch();
      operations = 0;
    }
  }

  if (operations) await batch.commit();

  return {
    reconciled,
    totalSnapshots: snapshot.size,
    incompleteSnapshots,
    conflictsFound,
  };
}

// Compatibilidade com o workflow já implantado durante o piloto.
export const reconcileFiagroDailyFields = reconcileFiagroMonthlyFields;
