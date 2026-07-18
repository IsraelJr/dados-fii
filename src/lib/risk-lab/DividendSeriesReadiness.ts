import type { VerifiedDividendNotice } from "@/types/riskLabDividendStress";
import type { DividendSeriesReadiness } from "@/types/riskLabSeriesReadiness";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const REQUIRED_CONTIGUOUS_COUNT = 9;

function monthIndex(value: string) {
  if (!MONTH_PATTERN.test(value)) throw new Error(`Competência mensal inválida: ${value}`);
  const [year, month] = value.split("-").map(Number);
  return year * 12 + month - 1;
}

function monthFromIndex(index: number) {
  const year = Math.floor(index / 12);
  const month = index % 12 + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function calculateDividendSeriesReadiness(
  ticker: string,
  rawNotices: VerifiedDividendNotice[],
): DividendSeriesReadiness {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!/^[A-Z]{4}11$/.test(normalizedTicker)) throw new Error(`Ticker inválido: ${normalizedTicker}`);
  if (!Array.isArray(rawNotices)) throw new Error("Série verificada inválida.");

  const notices = [...rawNotices].sort(
    (left, right) => monthIndex(left.competenceMonth) - monthIndex(right.competenceMonth),
  );
  const seen = new Set<string>();
  for (const notice of notices) {
    if (notice.ticker !== normalizedTicker) {
      throw new Error(`Ticker divergente na série: ${notice.ticker}`);
    }
    monthIndex(notice.competenceMonth);
    if (seen.has(notice.competenceMonth)) {
      throw new Error(`Competência duplicada: ${notice.competenceMonth}`);
    }
    seen.add(notice.competenceMonth);
  }

  if (!notices.length) {
    return {
      ticker: normalizedTicker,
      approvedObservations: 0,
      firstCompetence: null,
      lastCompetence: null,
      missingMonths: [],
      longestContiguousMonths: [],
      longestContiguousCount: 0,
      requiredContiguousCount: REQUIRED_CONTIGUOUS_COUNT,
      readyForStressDetection: false,
      detectorExecuted: false,
    };
  }

  const indexes = notices.map((notice) => monthIndex(notice.competenceMonth));
  const missingMonths: string[] = [];
  for (let index = indexes[0]; index <= indexes[indexes.length - 1]; index += 1) {
    const month = monthFromIndex(index);
    if (!seen.has(month)) missingMonths.push(month);
  }

  let current: string[] = [];
  let longest: string[] = [];
  for (const notice of notices) {
    const previous = current[current.length - 1];
    if (!previous || monthIndex(notice.competenceMonth) === monthIndex(previous) + 1) {
      current = [...current, notice.competenceMonth];
    } else {
      current = [notice.competenceMonth];
    }
    if (current.length > longest.length) longest = [...current];
  }

  return {
    ticker: normalizedTicker,
    approvedObservations: notices.length,
    firstCompetence: notices[0].competenceMonth,
    lastCompetence: notices[notices.length - 1].competenceMonth,
    missingMonths,
    longestContiguousMonths: longest,
    longestContiguousCount: longest.length,
    requiredContiguousCount: REQUIRED_CONTIGUOUS_COUNT,
    readyForStressDetection: longest.length >= REQUIRED_CONTIGUOUS_COUNT,
    detectorExecuted: false,
  };
}
