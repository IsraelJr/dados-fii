import { NextRequest, NextResponse } from "next/server";
import {
  createPremiumDiscoveryRequest,
  PremiumDiscoveryService,
  PremiumDiscoveryValidationError,
  type PremiumDiscoveryEntitlement,
} from "@/lib/premium-discovery";
import { featureEnabled } from "@/lib/featureFlags";
import {
  resolvePremiumEntitlement,
  resolvePremiumRequestIdentity,
  type PremiumIdentity,
} from "@/lib/premiumSecurity";
import { FirestorePremiumDiscoveryRepository } from "@/server/repositories/FirestorePremiumDiscoveryRepository";

const repository = new FirestorePremiumDiscoveryRepository();
const service = new PremiumDiscoveryService(repository);

function unavailable() {
  return NextResponse.json({
    ok: false,
    code: "PREMIUM_DISCOVERY_DISABLED",
    error: "A descoberta Premium está temporariamente indisponível.",
  }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
}

function authorizationError(result: Awaited<ReturnType<typeof resolvePremiumRequestIdentity>>) {
  if (result.ok) return null;
  return NextResponse.json({ ok: false, error: result.error }, {
    status: result.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function discoveryEntitlement(identity: PremiumIdentity | null): PremiumDiscoveryEntitlement {
  if (!identity) return null;
  if (identity.role === "admin") return { access: "owner" };
  if (identity.accessSource === "beta" || identity.accessSource === "preview") return { access: "beta" };
  return { access: "premium" };
}

async function context(request: NextRequest) {
  const verified = await resolvePremiumRequestIdentity(request);
  const error = authorizationError(verified);
  if (error || !verified.ok) return { error } as const;
  const entitlement = await resolvePremiumEntitlement(verified.identity);
  return {
    error: null,
    subject: { uid: verified.identity.uid, email: verified.identity.email },
    entitlement: discoveryEntitlement(entitlement),
  } as const;
}

export async function GET(request: NextRequest) {
  if (!featureEnabled("ENABLE_PREMIUM_DISCOVERY", false)) return unavailable();
  try {
    const resolved = await context(request);
    if (resolved.error) return resolved.error;
    const origin = createPremiumDiscoveryRequest({
      origin: request.nextUrl.searchParams.get("origin") || "premium_page",
      motivation: "portfolio_analysis",
    }).origin;
    const status = await service.status(resolved.subject, resolved.entitlement, origin);
    return NextResponse.json({ ok: true, status }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof PremiumDiscoveryValidationError) {
      return NextResponse.json({ ok: false, code: "INVALID_PREMIUM_DISCOVERY", error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível consultar o beta Premium." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!featureEnabled("ENABLE_PREMIUM_DISCOVERY", false)) return unavailable();
  try {
    const resolved = await context(request);
    if (resolved.error) return resolved.error;
    const body = await request.json().catch(() => ({}));
    const discoveryRequest = createPremiumDiscoveryRequest(body);
    const status = await service.requestAccess(resolved.subject, resolved.entitlement, discoveryRequest);
    return NextResponse.json({ ok: true, status }, {
      status: status.interestRequested ? 201 : 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof PremiumDiscoveryValidationError) {
      return NextResponse.json({ ok: false, code: "INVALID_PREMIUM_DISCOVERY", error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Não foi possível registrar seu interesse no beta." }, { status: 500 });
  }
}
