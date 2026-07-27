import { NextRequest, NextResponse } from "next/server";
import {
    AlertConfigurationError,
} from "@/lib/alerts/AlertApplicationService";
import { alertApplicationService } from "@/lib/alerts";
import { publicError } from "@/lib/http/PublicError";
import { walletIdentityService } from "@/lib/users/WalletIdentityService";

const ALLOWED_FIELDS = new Set(["email", "fiiCode", "percentUp", "percentDown"]);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({})) as Record<string, unknown>;
        const authorization = await walletIdentityService.require(req, body.email);
        if (!authorization.ok) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
        const unexpected = Object.keys(body).filter((field) => !ALLOWED_FIELDS.has(field));
        if (unexpected.length) {
            return NextResponse.json(
                { error: "Payload contém campos não permitidos.", code: "unknown_fields" },
                { status: 400 },
            );
        }
        const result = await alertApplicationService.configure({
            email: authorization.identity.email,
            plan: authorization.identity.plan,
            user: authorization.identity.user,
        }, {
            fiiCode: body.fiiCode,
            percentUp: body.percentUp,
            percentDown: body.percentDown,
        });
        return NextResponse.json({
            success: true,
            plan: result.plan,
            monitoredCount: result.monitoredCount,
            limit: result.limit,
            ticker: result.ticker,
            idempotent: !result.created,
        }, { status: result.created ? 201 : 200 });
    } catch (error) {
        if (error instanceof AlertConfigurationError) {
            const response = publicError(error, "Não foi possível configurar o alerta.");
            return NextResponse.json({ error: response.message, code: response.code }, { status: response.status });
        }
        return NextResponse.json({ error: "Falha interna ao configurar o alerta." }, { status: 500 });
    }
}
