import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";

export function middleware(req: NextRequest) {
  const response = NextResponse.next();
  if (!req.cookies.get("anonId")) {
    response.cookies.set({
      name: "anonId",
      value: uuidv4(),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|api/fii).*)"],
};
