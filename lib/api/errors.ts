import type { ApiError } from "@/lib/api/generated/model";

export function apiErrorMessage(
  data: unknown,
  fallback = "İşlem başarısız oldu.",
): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as ApiError).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
}

export function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}
