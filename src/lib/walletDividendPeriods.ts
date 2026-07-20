export type MonthKeyItem = {
  monthKey: string;
};

export function monthKeyForDate(referenceDate = new Date()) {
  return `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Dividend rankings and aggregates only use completed calendar months.
 * The current month can exist provisionally in localStorage, but it must not
 * change historical summaries before the monthly snapshot is closed.
 */
export function closedMonthItems<T extends MonthKeyItem>(items: T[], referenceDate = new Date()) {
  const currentMonth = monthKeyForDate(referenceDate);
  return items.filter((item) => /^\d{4}-\d{2}$/.test(item.monthKey) && item.monthKey < currentMonth);
}
