import { GET as handleGet } from "@/server/controllers/UserMonitoredFiiController";

export async function GET() {
  return handleGet();
}
