import type { ApiError, ApiFieldError } from "@/lib/api/generated/model";

const FIELD_LABELS: Record<string, string> = {
  code: "Kod",
  name: "Ad",
  price: "Fiyat",
  text: "Metin",
  category: "Kategori",
  description: "Açıklama",
  type: "Tür",
  contactPerson: "İlgili kişi",
  title: "Unvan",
  phone: "Telefon",
  email: "E-posta",
  institutionId: "Kurum",
};

export function apiErrorMessage(
  data: unknown,
  fallback = "İşlem başarısız oldu.",
): string {
  if (data && typeof data === "object" && "message" in data) {
    const message = (data as ApiError).message;
    if (typeof message === "string" && message.trim()) {
      const fields = apiFieldErrorList(data);
      if (fields.length > 0) {
        const details = fields
          .map((item) => `${fieldLabel(item.field)}: ${item.message}`)
          .join(" · ");
        return `${message.trim()} (${details})`;
      }
      return message.trim();
    }
  }
  return fallback;
}

/** Alan adı → ilk hata mesajı. İç içe alanlar (`properties[0].name`) kök anahtarla da eşleşir. */
export function apiFieldErrorMap(data: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of apiFieldErrorList(data)) {
    const field = item.field?.trim();
    const message = item.message?.trim();
    if (!field || !message) continue;
    if (!map[field]) map[field] = message;
    const root = field.split(/[.[\]]/, 1)[0];
    if (root && !map[root]) map[root] = message;
  }
  return map;
}

export function fieldError(
  errors: Record<string, string> | null | undefined,
  ...keys: string[]
): string | undefined {
  if (!errors) return undefined;
  for (const key of keys) {
    if (errors[key]) return errors[key];
  }
  return undefined;
}

export function fieldLabel(field?: string | null): string {
  if (!field) return "Alan";
  const root = field.split(/[.[\]]/, 1)[0] || field;
  return FIELD_LABELS[root] ?? FIELD_LABELS[field] ?? field;
}

export function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

function apiFieldErrorList(data: unknown): ApiFieldError[] {
  if (!data || typeof data !== "object" || !("fieldErrors" in data)) return [];
  const list = (data as ApiError).fieldErrors;
  return Array.isArray(list) ? list : [];
}
