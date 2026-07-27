import { NextRequest, NextResponse } from "next/server";
import { walletIdentityService } from "@/lib/users/WalletIdentityService";

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const authorization = await walletIdentityService.require(request, body.email);
    if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    const monitored = Array.isArray(authorization.identity.user.data.monitored)
        ? authorization.identity.user.data.monitored
        : [];
    return NextResponse.json({
        email: authorization.identity.email,
        plan: authorization.identity.plan,
        monitored,
    });
}
