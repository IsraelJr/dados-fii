export type CalendarPeriod = Readonly<{ year: number; month: number }>;

export type QaDividendMonth = Readonly<{
  month: string;
  monthNumber: number;
  competence: string;
  value: string;
  numericValue: number;
  shortLabel: string;
  fullLabel: string;
}>;

const QA_VALUES = [
  { value: "47,00", numericValue: 47, shortLabel: "Jan", fullLabel: "Janeiro" },
  { value: "450,03", numericValue: 450.03, shortLabel: "Fev", fullLabel: "Fevereiro" },
  { value: "87,06", numericValue: 87.06, shortLabel: "Mar", fullLabel: "Março" },
  { value: "40,00", numericValue: 40, shortLabel: "Abr", fullLabel: "Abril" },
  { value: "50,00", numericValue: 50, shortLabel: "Mai", fullLabel: "Maio" },
  { value: "60,00", numericValue: 60, shortLabel: "Jun", fullLabel: "Junho" },
] as const;

export function saoPauloCalendarPeriod(now = new Date()): CalendarPeriod {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    timeZone: "America/Sao_Paulo",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  if (!Number.isInteger(year) || !Number.isInteger(month)) throw new Error("Calendário de QA indisponível.");
  return { year, month };
}

export function closedCurrentYearCompetences(period: CalendarPeriod) {
  if (!Number.isInteger(period.year) || !Number.isInteger(period.month) || period.month < 1 || period.month > 12) {
    throw new Error("Período de QA inválido.");
  }
  return Array.from({ length: period.month - 1 }, (_, index) => (
    `${period.year}-${String(index + 1).padStart(2, "0")}`
  ));
}

export function closedQaDividendMonths(period = saoPauloCalendarPeriod()): readonly QaDividendMonth[] {
  const closed = new Set(closedCurrentYearCompetences(period));
  return QA_VALUES.map((entry, index) => {
    const monthNumber = index + 1;
    return {
      ...entry,
      month: String(monthNumber),
      monthNumber,
      competence: `${period.year}-${String(monthNumber).padStart(2, "0")}`,
    };
  }).filter((entry) => closed.has(entry.competence));
}
