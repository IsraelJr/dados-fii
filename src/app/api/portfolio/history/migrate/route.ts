import { POST as handlePost } from "@/server/controllers/PortfolioHistoryMigrationController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handlePost;
