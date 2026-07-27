import { NextRequest } from "next/server";
import { POST as handlePost } from "@/server/controllers/SearchController";

export async function POST(request: NextRequest) {
  return handlePost(request);
}
