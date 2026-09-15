import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/lib/api/config";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from "@/lib/auth/cookies";
import { clearAuthCookies, setAuthCookies } from "@/lib/auth/session";

export async function POST() {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    await clearAuthCookies();
    return NextResponse.json(
      { message: "Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın." },
      { status: 401 },
    );
  }

  const response = await fetch(`${apiBaseUrl()}/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const data = (await response.json()) as {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    message?: string;
  };

  if (!response.ok) {
    await clearAuthCookies();
    return NextResponse.json(data, { status: response.status });
  }

  await setAuthCookies(data);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const jar = await cookies();
  return NextResponse.json({
    authed: Boolean(jar.get(ACCESS_COOKIE)?.value || jar.get(REFRESH_COOKIE)?.value),
  });
}
