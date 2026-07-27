import { NextRequest } from "next/server";
import { GET as handleGet, POST as handlePost } from "@/server/controllers/WalletController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleGet();
}

export async function POST(request: NextRequest) {
  return handlePost(request);
}
