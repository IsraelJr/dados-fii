import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const revalidate = 21600;

const CACHE_SECONDS = 6 * 60 * 60;
const TIME_ZONE = "America/Sao_Paulo";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseBrazilianDateKey(value: unknown) {
  const [day, month, year] = String(value || "").split("/").map(Number);
  if (!day || !month || !year) return null;
  return dateKeyFromParts(year, month, day);
}

function saoPauloTodayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const mapped = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${mapped.year}-${mapped.month}-${mapped.day}`;
}

function dateFromKey(key: string) {
  return new Date(`${key}T12:00:00-03:00`);
}

function addDaysKey(key: string, days: number) {
  const date = dateFromKey(key);
  date.setUTCDate(date.getUTCDate() + days);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const mapped = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${mapped.year}-${mapped.month}-${mapped.day}`;
}

function currentWeekWindow(todayKey: string) {
  const day = dateFromKey(todayKey).getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  const daysUntilSunday = day === 0 ? 0 : 7 - day;

  return {
    start: addDaysKey(todayKey, -daysFromMonday),
    end: addDaysKey(todayKey, daysUntilSunday),
  };
}

function parseCurrency(value: unknown) {
  if (typeof value === "number") return value;
  return Number(
    String(value || "0")
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim()
  ) || 0;
}

function formatDividend(value: unknown) {
  const parsed = parseCurrency(value);
  if (!parsed) return "";
  return `R$ ${parsed.toFixed(3).replace(".", ",")}`;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const todayKey = saoPauloTodayKey();
    const todayYear = Number(todayKey.slice(0, 4));
    const currentMonthNumber = Number(todayKey.slice(5, 7));
    const year = Number(url.searchParams.get("year") || todayYear);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 500), 1), 2000);
    const currentWeek = currentWeekWindow(todayKey);
    const recentStartKey = addDaysKey(todayKey, -7);

    const snapshot = await adminDb.collection("Fiis").limit(limit).get();
    const events: any[] = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      const ticker = String(data.code || doc.id || "").toUpperCase();
      const earnings = data[`earnings${year}`] || {};

      Object.entries(earnings).forEach(([month, info]: any) => {
        const paymentDateKey = parseBrazilianDateKey(info?.payment_date);
        if (!paymentDateKey) return;

        const dateWithKey = parseBrazilianDateKey(info?.date_with);
        const amountText = formatDividend(info?.earnings);
        const paymentMonthNumber = Number(paymentDateKey.slice(5, 7));
        const isFuture = paymentDateKey >= todayKey;
        const isThisWeek = paymentDateKey >= todayKey && paymentDateKey <= currentWeek.end;
        const isRecentPaid = paymentDateKey >= recentStartKey && paymentDateKey < todayKey;
        const isCurrentMonth = paymentMonthNumber === currentMonthNumber;

        events.push({
          ticker,
          socialReason: data.socialReason || data.name || "",
          segment: data.segment_new || data.segment || "",
          month,
          monthNumber: paymentMonthNumber,
          paymentDate: info?.payment_date || "",
          paymentDateKey,
          dateWith: info?.date_with || "",
          dateWithKey,
          earnings: amountText,
          isFuture,
          isThisWeek,
          isRecentPaid,
          isCurrentMonth,
        });
      });
    });

    events.sort((a, b) => a.paymentDateKey.localeCompare(b.paymentDateKey) || a.ticker.localeCompare(b.ticker));

    const weekPayments = events.filter((event) => event.isThisWeek).slice(0, 80);
    const nextEvents = weekPayments;
    const paidRecently = events.filter((event) => event.isRecentPaid).reverse().slice(0, 80);
    const currentMonth = events.filter((event) => event.isCurrentMonth);

    return NextResponse.json(
      {
        ok: true,
        year,
        total: events.length,
        weekPayments,
        nextEvents,
        paidRecently,
        currentMonth,
        windows: {
          today: todayKey,
          currentWeekStart: currentWeek.start,
          currentWeekEnd: currentWeek.end,
          weekPaymentStart: todayKey,
          weekPaymentEnd: currentWeek.end,
          paidRecentlyStart: recentStartKey,
          paidRecentlyEnd: addDaysKey(todayKey, -1),
          weekStart: todayKey,
          weekEnd: currentWeek.end,
        },
        updatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao carregar calendário." }, { status: 500 });
  }
}
