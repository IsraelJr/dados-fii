import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

type RawFragment = {
  sourceKind?: string;
  raw?: Record<string, unknown>;
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

export async function reconcileFiagroDailyFields(input: {
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
  const missingDailyReference: string[] = [];

  for (const doc of snapshot.docs) {
    const data = (doc.data() || {}) as Record<string, any>;
    const fragments = Array.isArray(data.rawFragments)
      ? data.rawFragments as RawFragment[]
      : [];
    const daily = fragments.find((fragment) => fragment?.sourceKind === "fi_daily_month_end");
    const raw = daily?.raw && typeof daily.raw === "object" ? daily.raw : null;

    if (!raw) {
      missingDailyReference.push(String(data.referenceDate || doc.id));
      continue;
    }

    const dailyNetWorth = numberOf(firstValue(raw, ["VL_PATRIM_LIQ"]));
    const dailyVpCota = numberOf(firstValue(raw, ["VL_QUOTA", "VL_COTA"]));
    const numberShareholders = numberOf(firstValue(raw, ["NR_COTST", "NR_COTISTAS"]));
    const dailyReferenceDate = String(firstValue(raw, ["DT_COMPTC"]) || data.dailyReferenceDate || "").trim();
    const sharesOutstanding = dailyNetWorth && dailyVpCota && dailyVpCota > 0
      ? dailyNetWorth / dailyVpCota
      : undefined;

    const derivedFields = Array.from(new Set([
      ...(Array.isArray(data.derivedFields) ? data.derivedFields : []),
      ...(sharesOutstanding !== undefined ? ["sharesOutstanding:dailyNetWorth/dailyVpCota"] : []),
    ]));

    batch.set(doc.ref, {
      ticker: input.ticker,
      dailyNetWorth: dailyNetWorth ?? null,
      dailyVpCota: dailyVpCota ?? null,
      dailyReferenceDate: dailyReferenceDate || null,
      vpCota: dailyVpCota ?? data.vpCota ?? null,
      numberShareholders: numberShareholders ?? data.numberShareholders ?? null,
      sharesOutstanding: sharesOutstanding ?? data.sharesOutstanding ?? null,
      derivedFields,
      fiagroDailyReconciledAt: adminFieldValue.serverTimestamp(),
    }, { merge: true });
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
    missingDailyReference,
  };
}
