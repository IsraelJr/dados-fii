import { NextRequest, NextResponse } from "next/server";
import { regulatoryDataService } from "@/lib/regulatoryDataService";
import { internalAuthError, requireAdminOrCron } from "@/lib/security/InternalRequestAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function listMissingCnpj(limit: number, cursor?: string) {
  return regulatoryDataService.listMissingCnpj(limit, cursor);
}

export async function GET(req: NextRequest) {
  try {
    const authorization = await requireAdminOrCron(req, { scope: "missing-cnpj" });
    if (!authorization.ok) return internalAuthError(authorization);

    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 500), 1), 1000);
    const cursor = req.nextUrl.searchParams.get("cursor") || undefined;
    const result = await listMissingCnpj(limit, cursor);

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao listar FIIs sem CNPJ." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authorization = await requireAdminOrCron(req, { scope: "missing-cnpj" });
    if (!authorization.ok) return internalAuthError(authorization);
    const body = await req.json().catch(() => ({}));

    const limit = Math.min(Math.max(Number(body.limit || 500), 1), 1000);
    const cursor = body.cursor ? String(body.cursor) : undefined;
    const result = await listMissingCnpj(limit, cursor);

    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao listar FIIs sem CNPJ." }, { status: 500 });
  }
}
