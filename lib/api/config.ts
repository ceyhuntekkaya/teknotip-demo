export const API_PROXY_PREFIX = "/backend";

export function apiBaseUrl(): string {
  return process.env.API_URL?.replace(/\/$/, "") ?? "http://localhost:8080/api";
}

export function resolveApiUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (typeof window !== "undefined") {
    return url;
  }
  const path = url.startsWith(API_PROXY_PREFIX)
    ? url.slice(API_PROXY_PREFIX.length)
    : url;
  return `${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function isAuthPath(url: string): boolean {
  return /\/v1\/auth\/(login|refresh)(?:\?|$)/.test(url);
}
