// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";

export function middleware(req: NextRequest) {
    const res = NextResponse.next();

    // Verifica se o cookie já existe
    const existingCookie = req.cookies.get("anonId");
    if (!existingCookie) {
        const anonId = uuidv4();
        res.cookies.set("anonId", anonId, {
            httpOnly: true,
            // Para localhost, secure precisa ser false
            secure: process.env.NODE_ENV === "production",
            // "lax" funciona bem para localhost
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 365, // 1 ano
        });
        console.log("Cookie anonId criado:", anonId);
    } else {
        // console.log("Cookie anonId já existe:", existingCookie.value);
    }

    return res;
}

// Aplica o middleware em todas as rotas
export const config = { matcher: "/:path*" };
