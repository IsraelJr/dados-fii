import { POST as handlePost } from "@/server/controllers/WalletRiskReportController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handlePost(request);
}
