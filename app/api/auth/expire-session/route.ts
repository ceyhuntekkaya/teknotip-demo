import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  tokenCookieOptions,
} from "@/lib/auth/cookies";

/** Geçersiz oturumu silip login (ana sayfa) ekranına döner. */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url));
  const expired = tokenCookieOptions(0);
  response.cookies.set(ACCESS_COOKIE, "", expired);
  response.cookies.set(REFRESH_COOKIE, "", expired);
  return response;
}
