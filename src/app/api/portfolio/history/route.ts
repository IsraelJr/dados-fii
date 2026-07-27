import {
  DELETE as handleDelete,
  GET as handleGet,
  PATCH as handlePatch,
  POST as handlePost,
} from "@/server/controllers/PortfolioHistoryController";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handleGet;
export const POST = handlePost;
export const PATCH = handlePatch;
export const DELETE = handleDelete;
