import { isAuthPath, resolveApiUrl } from "./config";
import { getServerAuth } from "./runtime-auth";

type FetchResult<T> = T & {
  data: unknown;
  status: number;
  headers: Headers;
};

type RefreshResult = {
  ok: boolean;
  /** Server-side refresh: cookie yazılamadığı için retry bu token ile yapılır. */
  accessToken?: string;
};

export async function customFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  return request<T>(url, options, false);
}

async function request<T>(
  url: string,
  options: RequestInit | undefined,
  retried: boolean,
  accessOverride?: string,
): Promise<T> {
  const init = await withAuthHeaders(options, accessOverride);
  const response = await fetch(resolveApiUrl(url), init);

  if (response.status === 401 && !retried && !isAuthPath(url)) {
    const refreshed = await refreshSession();
    if (refreshed.ok) {
      return request<T>(url, options, true, refreshed.accessToken);
    }
  }

  const body = [204, 205, 304].includes(response.status)
    ? null
    : await response.text();
  let data: unknown = {};
  if (body) {
    try {
      data = JSON.parse(body);
    } catch {
      data = { message: body.slice(0, 240) };
    }
  }
  return { data, status: response.status, headers: response.headers } as FetchResult<T>;
}

async function withAuthHeaders(
  init?: RequestInit,
  accessOverride?: string,
): Promise<RequestInit> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Authorization")) {
    const token =
      accessOverride ?? (await getServerAuth()?.getAccessToken());
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return {
    ...init,
    headers,
    credentials: init?.credentials ?? "same-origin",
  };
}

/**
 * Server Component render sırasında cookie yazılamaz/silinemez
 * (Next.js: yalnızca Server Action / Route Handler).
 * Cookie güncellemesi login/logout action ve /api/auth/refresh'te kalır.
 */
async function refreshSession(): Promise<RefreshResult> {
  const auth = getServerAuth();
  if (auth) {
    const refreshToken = await auth.getRefreshToken();
    if (!refreshToken) {
      return { ok: false };
    }
    const response = await fetch(resolveApiUrl("/backend/v1/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      return { ok: false };
    }
    const data = (await response.json()) as { accessToken?: string };
    return { ok: Boolean(data.accessToken), accessToken: data.accessToken };
  }

  if (typeof window === "undefined") {
    return { ok: false };
  }

  const response = await fetch("/api/auth/refresh", { method: "POST" });
  // Cookie Route Handler'da güncellendi; retry proxy üzerinden yeni token'ı alır.
  return { ok: response.ok };
}
