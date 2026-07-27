import { NextRequest } from "next/server";
import { GET as handleGet } from "@/server/controllers/UserTopFiisController";

export async function GET(request: NextRequest) {
  return handleGet(request);
}
