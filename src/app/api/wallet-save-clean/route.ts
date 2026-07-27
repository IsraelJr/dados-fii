import { POST as handlePost } from "@/server/controllers/WalletSaveCleanController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handlePost(request);
}
