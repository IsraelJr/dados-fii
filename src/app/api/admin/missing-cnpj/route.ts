import { NextRequest, NextResponse } from "next/server";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest, body: any) {
  const expected = process.env.ADMIN_UPDATE_SECRET || process.env.CRON_SECRET;
  return Boolean(expected && (req.headers.get("x-admin-secret") === expected || body?.secret === expected || req.nextUrl.searchParams.get("secret") === expected));
}

async function listMissingCnpj(limit: number, cursor?: string) {
  return regulatoryDataService.listMissingCnpj(limit, cursor);
}

export async function GET(req: NextRequest) {
  try {
    if (!authorized(req, {})) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 500), 1), 1000);
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const result = await listMissingCnpj(limit, cursor);

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao listar FIIs sem CNPJ." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!authorized(req, body)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const limit = Math.min(Math.max(Number(body.limit || 500), 1), 1000);
    const cursor = body.cursor ? String(body.cursor) : undefined;
    const result = await listMissingCnpj(limit, cursor);

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro ao listar FIIs sem CNPJ." }, { status: 500 });
  }
}
