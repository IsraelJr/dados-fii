import { NextRequest, NextResponse } from "next/server";
import { PremiumReportError } from "@/lib/reports/PremiumReportEngine";
import { publicError } from "@/lib/http/PublicError";
import { requirePremium } from "@/lib/premiumSecurity";
import { regulatoryDataService } from "@/lib/regulatoryDataService";
import { userWalletFrom } from "@/lib/userWallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ ticker: string }> };

function requestKey(request: NextRequest, uid: string) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return regulatoryDataService.requestFingerprint(["premium", uid, ip]);
}

async function generatePremium(request: NextRequest, context: RouteContext, holdings: Array<{ ticker: string; quotas: number }> = []) {
  const authorization = await requirePremium(request);
  if (!authorization.ok) {
    return NextResponse.json({ ok: false, error: authorization.error }, {
      status: authorization.status,
      headers: authorization.retryAfter ? { "Retry-After": String(authorization.retryAfter) } : undefined,
    });
  }
  try {
    const { ticker } = await context.params;
    const fingerprint = requestKey(request, authorization.identity.uid);
    const report = await regulatoryDataService.getPremiumReport(ticker, {
      requestKey: fingerprint,
      holdings,
      auditActor: `premium:${fingerprint}`,
      accessPlan: authorization.identity.plan,
    });
    if (!report) return NextResponse.json({ ok: false, error: "Fundo não encontrado." }, { status: 404 });
    return NextResponse.json(
      { ok: true, report, access: { plan: authorization.identity.plan } },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Audit-Event-Id": report.auditReceipt.eventId,
          "X-Correlation-Id": report.auditReceipt.correlationId,
        },
      },
    );
  } catch (error) {
    if (error instanceof PremiumReportError) {
      const response = publicError(error, "Não foi possível gerar o relatório Premium.");
      return NextResponse.json({ ok: false, error: response.message, code: response.code }, { status: response.status });
    }
    console.error("Premium fund report error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, error: "Não foi possível gerar o relatório Premium." }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return generatePremium(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const body = await request.json().catch(() => ({})) as { holdings?: unknown };
  return generatePremium(request, context, userWalletFrom(body.holdings));
}
