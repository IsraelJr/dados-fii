import { DELETE as deleteSession, POST as createSession } from "@/server/controllers/WalletFirebaseSessionController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createSession;
export const DELETE = deleteSession;
