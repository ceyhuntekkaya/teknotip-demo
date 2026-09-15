export const ACCESS_COOKIE = "teknotip-access";
export const REFRESH_COOKIE = "teknotip-refresh";

export const ACCESS_MAX_AGE_SECONDS = 60 * 60;
export const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function tokenCookieOptions(maxAgeSeconds: number) {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: maxAgeSeconds,
  };
}
