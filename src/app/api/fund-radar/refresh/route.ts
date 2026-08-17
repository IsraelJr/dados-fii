import { REFRESH } from "@/server/controllers/FundRadarController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return REFRESH(request);
}
