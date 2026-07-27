import { NextResponse } from "next/server";
import { POST as handlePdfPost } from "@/server/controllers/WalletRiskReportPdfController";
import { POST as handleStatusPost } from "@/server/controllers/WalletRiskReportStatusController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const statusResponse = await handleStatusPost(request.clone());
  const status = await statusResponse.clone().json().catch(() => ({}));

  if (!statusResponse.ok) return statusResponse;
  if (!status?.hasCurrentReport || status?.generationMode !== "automatic_openai") {
    return NextResponse.json({
      ok: false,
      error: "Gere o relatório automático antes de baixar o PDF.",
      code: "WALLET_RISK_REPORT_AUTOMATIC_REQUIRED",
    }, { status: 409 });
  }

  return handlePdfPost(request);
}
