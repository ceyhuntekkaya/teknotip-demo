export const ACCESS_COOKIE = "teknotip-access";
export const REFRESH_COOKIE = "teknotip-refresh";

/** Tarayıcılar çerezi ~400 günde keser; JWT süresiz olsa da oturum çerezi bu kadar durur. */
export const ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;
export const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

export function tokenCookieOptions(maxAgeSeconds: number) {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== "false",
    maxAge: maxAgeSeconds,
  };
}