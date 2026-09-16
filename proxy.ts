import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookies";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const authed = Boolean(access || refresh);

  if (pathname.startsWith("/backend")) {
    const headers = new Headers(request.headers);
    if (access) {
      headers.set("Authorization", `Bearer ${access}`);
    }
    return NextResponse.next({ request: { headers } });
  }

  const isPrivate =
    pathname.startsWith("/teklif") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/quotes") ||
    pathname.startsWith("/data-json") ||
    pathname.startsWith("/musteriler") ||
    pathname.startsWith("/temp-product-transfer");

  if (isPrivate && !authed) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (pathname === "/" && authed) {
    return NextResponse.redirect(new URL("/teklif", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/teklif/:path*",
    "/products/:path*",
    "/quotes/:path*",
    "/data-json/:path*",
    "/musteriler/:path*",
    "/temp-product-transfer",
    "/temp-product-transfer/:path*",
    "/backend/:path*",
  ],
};
