import { NextResponse } from "next/server";
import { POST as handleManualPost } from "@/server/controllers/WalletRiskReportManualPromptController";
import { walletRiskReportManualFallbackEnabled } from "@/lib/reports/WalletRiskReportAutomationPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!walletRiskReportManualFallbackEnabled()) {
    return NextResponse.json({
      ok: false,
      error: "O modo manual do relatório está preservado, mas desabilitado enquanto a geração automática estiver ativa.",
      code: "WALLET_RISK_REPORT_MANUAL_DISABLED",
    }, { status: 503 });
  }

  return handleManualPost(request);
}
