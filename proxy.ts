import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DEMO_SESSION_COOKIE } from "@/lib/auth/demo";

export function proxy(request: NextRequest) {
  const authed = request.cookies.get(DEMO_SESSION_COOKIE)?.value === "1";
  const { pathname } = request.nextUrl;
  const isPrivate =
    pathname.startsWith("/teklif") || pathname.startsWith("/data-json");

  if (isPrivate && !authed) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (pathname === "/" && authed) {
    return NextResponse.redirect(new URL("/teklif", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/teklif/:path*", "/data-json/:path*"],
};
