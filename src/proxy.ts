import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
    const inboundCorrelationId = req.headers.get("x-correlation-id") || "";
    const correlationId = /^[A-Za-z0-9._-]{8,128}$/.test(inboundCorrelationId)
        ? inboundCorrelationId
        : crypto.randomUUID();
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-correlation-id", correlationId);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("x-correlation-id", correlationId);

    const existingCookie = req.cookies.get("anonId");
    if (!existingCookie) {
        res.cookies.set({
            name: "anonId",
            value: crypto.randomUUID(),
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
        });
    }

    return res;
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png).*)"],
};
