export function parseDisplayedPercentage(value: unknown) {
  const compact = String(value ?? "")
    .trim()
    .replace(/%\s*$/, "")
    .replace(/[\s\u00a0\u202f]/g, "");
  if (!compact || !/^[+-]?\d[\d.,]*$/.test(compact)) return null;

  const sign = compact.startsWith("-") ? -1 : 1;
  const unsigned = compact.replace(/^[+-]/, "");
  const commaIndex = unsigned.lastIndexOf(",");
  const dotIndex = unsigned.lastIndexOf(".");
  const hasComma = commaIndex >= 0;
  const hasDot = dotIndex >= 0;

  let normalized: string;
  if (hasComma && hasDot) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    const decimalIndex = unsigned.lastIndexOf(decimalSeparator);
    const integerGroups = unsigned.slice(0, decimalIndex).split(thousandsSeparator);
    const decimalPart = unsigned.slice(decimalIndex + 1);
    const validThousands = /^\d{1,3}$/.test(integerGroups[0] || "")
      && integerGroups.slice(1).every((group) => /^\d{3}$/.test(group));
    if (!validThousands || !/^\d+$/.test(decimalPart)) return null;
    const integerPart = integerGroups.join("");
    normalized = `${integerPart}.${decimalPart}`;
  } else if (hasComma || hasDot) {
    const separator = hasComma ? "," : ".";
    const parts = unsigned.split(separator);
    if (parts.some((part) => !/^\d+$/.test(part))) return null;
    if (parts.length === 2) {
      normalized = `${parts[0]}.${parts[1]}`;
    } else if (parts.slice(1).every((part) => part.length === 3)) {
      normalized = parts.join("");
    } else {
      if (!parts.slice(1, -1).every((part) => part.length === 3)) return null;
      const decimalPart = parts.at(-1)!;
      const integerPart = parts.slice(0, -1).join("");
      normalized = `${integerPart}.${decimalPart}`;
    }
  } else {
    normalized = unsigned;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? sign * parsed : null;
}
