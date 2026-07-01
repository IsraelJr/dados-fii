import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const revalidate = 21600;

const CACHE_SECONDS = 6 * 60 * 60;

function parseDate(value: unknown) {
  const [day, month, year] = String(value || "").split("/").map(Number);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
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

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function weekEndFrom(date: Date) {
  const end = new Date(date);
  const day = end.getDay();
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  end.setDate(end.getDate() + daysUntilSunday);
  end.setHours(23, 59, 59, 999);
  return end;
}

function sevenDaysAgoFrom(date: Date) {
  const start = new Date(date);
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const year = Number(url.searchParams.get("year") || new Date().getFullYear());
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 500), 1), 2000);
    const today = startOfToday();
    const weekEnd = weekEndFrom(today);
    const recentStart = sevenDaysAgoFrom(today);
    const currentMonthNumber = today.getMonth() + 1;

    const snapshot = await adminDb.collection("Fiis").limit(limit).get();
    const events: any[] = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data() || {};
      const ticker = String(data.code || doc.id || "").toUpperCase();
      const earnings = data[`earnings${year}`] || {};

      Object.entries(earnings).forEach(([month, info]: any) => {
        const paymentDate = parseDate(info?.payment_date);
        if (!paymentDate) return;

        const dateWith = parseDate(info?.date_with);
        const amountText = formatDividend(info?.earnings);
        const paymentMonthNumber = paymentDate.getMonth() + 1;
        const isFuture = paymentDate >= today;
        const isThisWeek = paymentDate >= today && paymentDate <= weekEnd;
        const isRecentPaid = paymentDate >= recentStart && paymentDate < today;
        const isCurrentMonth = paymentMonthNumber === currentMonthNumber;

        events.push({
          ticker,
          socialReason: data.socialReason || data.name || "",
          segment: data.segment_new || data.segment || "",
          month,
          monthNumber: paymentMonthNumber,
          paymentDate: info?.payment_date || "",
          paymentDateKey: dateKey(paymentDate),
          dateWith: info?.date_with || "",
          dateWithKey: dateWith ? dateKey(dateWith) : null,
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
          weekStart: dateKey(today),
          weekEnd: dateKey(weekEnd),
          paidRecentlyStart: dateKey(recentStart),
          paidRecentlyEnd: dateKey(today),
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
