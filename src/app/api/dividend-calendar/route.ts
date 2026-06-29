import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const year = Number(url.searchParams.get("year") || new Date().getFullYear());
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 500), 1), 2000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
        const isFuture = paymentDate >= today;
        const isCurrentMonth = MONTHS[paymentDate.getMonth()] === MONTHS[new Date().getMonth()];

        events.push({
          ticker,
          socialReason: data.socialReason || data.name || "",
          segment: data.segment_new || data.segment || "",
          month,
          monthNumber: paymentDate.getMonth() + 1,
          paymentDate: info?.payment_date || "",
          paymentDateKey: dateKey(paymentDate),
          dateWith: info?.date_with || "",
          dateWithKey: dateWith ? dateKey(dateWith) : null,
          earnings: amountText,
          isFuture,
          isCurrentMonth,
        });
      });
    });

    events.sort((a, b) => a.paymentDateKey.localeCompare(b.paymentDateKey) || a.ticker.localeCompare(b.ticker));

    const todayKey = dateKey(today);
    const nextEvents = events.filter((event) => event.paymentDateKey >= todayKey).slice(0, 80);
    const paidRecently = events.filter((event) => event.paymentDateKey < todayKey).slice(-80).reverse();
    const currentMonth = events.filter((event) => event.isCurrentMonth);

    return NextResponse.json({
      ok: true,
      year,
      total: events.length,
      nextEvents,
      paidRecently,
      currentMonth,
      updatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao carregar calendário." }, { status: 500 });
  }
}
