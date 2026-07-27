import { POST as handleAutomaticPost } from "@/server/controllers/WalletRiskReportController";
import { POST as handleManualPost } from "@/server/controllers/WalletRiskReportManualPromptController";
import { walletRiskReportManualFallbackEnabled } from "@/lib/reports/WalletRiskReportAutomationPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (walletRiskReportManualFallbackEnabled()) return handleManualPost(request);
  return handleAutomaticPost(request);
}
