import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT_PTBR: Record<string, string> = { January: "Jan", February: "Fev", March: "Mar", April: "Abr", May: "Mai", June: "Jun", July: "Jul", August: "Ago", September: "Set", October: "Out", November: "Nov", December: "Dez" };

function labelFor(year: string, month: string) {
  return `${MONTHS_SHORT_PTBR[month] || month}/${String(year).slice(-2)}`;
}

function legacySnapshots(data: any) {
  const patrimony = data?.patrimony || {};
  const earnings = data?.earnings || {};
  const results: any[] = [];

  Object.entries(patrimony).forEach(([year, months]: any) => {
    if (!months || typeof months !== "object") return;
    Object.entries(months).forEach(([month, totalValue]: any) => {
      const monthIndex = MONTHS.indexOf(month);
      if (monthIndex < 0) return;
      results.push({
        monthKey: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
        year,
        month,
        label: labelFor(year, month),
        totalValue: Number(totalValue || 0),
        estimatedDividendIncome: Number(earnings?.[year]?.[month] || 0),
        source: "legacy_ios",
      });
    });
  });

  return results.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const anonId = cookieStore.get("anonId")?.value;

    if (!anonId) return NextResponse.json({ ok: true, snapshots: [] });

    const userRef = adminDb.collection("User").doc(anonId);
    const snapshot = await userRef.collection("WalletSnapshots").orderBy("monthKey", "asc").limit(60).get();
    const snapshots = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        monthKey: data.monthKey || doc.id,
        year: data.year,
        month: data.month,
        label: data.label,
        totalValue: Number(data.totalValue || 0),
        estimatedDividendIncome: Number(data.estimatedDividendIncome || 0),
        walletCount: Number(data.walletCount || 0),
        totalQuotas: Number(data.totalQuotas || 0),
        topWeightTicker: data.topWeightTicker || "",
        topIncomeTicker: data.topIncomeTicker || "",
        source: data.source || "monthly_job",
        closedAt: data.closedAt || "",
      };
    });

    if (snapshots.length) return NextResponse.json({ ok: true, snapshots });

    const userDoc = await userRef.get();
    return NextResponse.json({ ok: true, snapshots: userDoc.exists ? legacySnapshots(userDoc.data()) : [] });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Erro ao buscar snapshots." }, { status: 500 });
  }
}
