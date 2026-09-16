import "server-only";
import { cookies } from "next/headers";
import { bindServerAuth } from "@/lib/api/runtime-auth";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE_SECONDS,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_SECONDS,
  tokenCookieOptions,
} from "./cookies";

export async function setAuthCookies(tokens: {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}): Promise<void> {
  const jar = await cookies();
  if (tokens.accessToken) {
    const accessMaxAge =
      tokens.expiresIn && tokens.expiresIn > 0
        ? tokens.expiresIn
        : ACCESS_MAX_AGE_SECONDS;
    jar.set(
      ACCESS_COOKIE,
      tokens.accessToken,
      tokenCookieOptions(accessMaxAge),
    );
  }
  if (tokens.refreshToken) {
    jar.set(
      REFRESH_COOKIE,
      tokens.refreshToken,
      tokenCookieOptions(REFRESH_MAX_AGE_SECONDS),
    );
  }
}

export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value;
}

bindServerAuth({
  getAccessToken,
  getRefreshToken,
  setAuthCookies,
  clearAuthCookies,
});
