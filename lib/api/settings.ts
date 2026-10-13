import { customFetch } from "@/lib/api/fetcher";
import type { ApiError } from "@/lib/api/generated/model";

export type SttSettings = {
  id: string;
  baseUrl: string;
  language: string;
  timeoutMs: number;
  active: boolean;
};

export type SttSettingsInput = {
  baseUrl: string;
  language: string;
  timeoutMs: number;
};

export type OllamaSettings = {
  id: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  numCtx: number;
  numPredict: number;
  keepAlive: string;
  basicUser: string;
  basicPass: string;
  organizeTimeoutMs: number;
  active: boolean;
};

export type OllamaSettingsInput = {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  numCtx: number;
  numPredict: number;
  keepAlive: string;
  basicUser: string;
  basicPass: string;
  organizeTimeoutMs: number;
};

export type AiSettings = {
  stt: SttSettings[];
  llm: {
    ollama: OllamaSettings[];
  };
};

type ApiResult<T> = {
  data: T | ApiError;
  status: number;
  headers: Headers;
};

export function isAiSettings(data: unknown): data is AiSettings {
  if (!data || typeof data !== "object" || !("stt" in data) || !("llm" in data)) {
    return false;
  }
  const settings = data as AiSettings;
  return Array.isArray(settings.stt) && Array.isArray(settings.llm?.ollama);
}

export function activeOf<T extends { active: boolean }>(items: T[]): T | undefined {
  return items.find((item) => item.active);
}

async function send<T>(url: string, method: string, body?: unknown): Promise<ApiResult<T>> {
  return customFetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function getAiSettings(): Promise<ApiResult<AiSettings>> {
  return customFetch(`/backend/v1/settings/ai`);
}

export function createSttSettings(body: SttSettingsInput) {
  return send<AiSettings>(`/backend/v1/settings/ai/stt`, "POST", body);
}

export function updateSttSettings(id: string, body: SttSettingsInput) {
  return send<AiSettings>(`/backend/v1/settings/ai/stt/${id}`, "PUT", body);
}

export function deleteSttSettings(id: string) {
  return send<AiSettings>(`/backend/v1/settings/ai/stt/${id}`, "DELETE");
}

export function activateSttSettings(id: string) {
  return send<AiSettings>(`/backend/v1/settings/ai/stt/${id}/active`, "POST");
}

export function createOllamaSettings(body: OllamaSettingsInput) {
  return send<AiSettings>(`/backend/v1/settings/ai/ollama`, "POST", body);
}

export function updateOllamaSettings(id: string, body: OllamaSettingsInput) {
  return send<AiSettings>(`/backend/v1/settings/ai/ollama/${id}`, "PUT", body);
}

export function deleteOllamaSettings(id: string) {
  return send<AiSettings>(`/backend/v1/settings/ai/ollama/${id}`, "DELETE");
}

export function activateOllamaSettings(id: string) {
  return send<AiSettings>(`/backend/v1/settings/ai/ollama/${id}/active`, "POST");
}

export type BrandTerms = {
  brand: "TEKNOTIP" | "OPTOSENSE" | "MILIMLAB";
  salesConditions?: string;
  validityDays?: number;
  delivery?: string;
  payment?: string;
  validation?: string;
  tradeTerms?: string;
  deliveryTime?: string;
  deliveryMode?: string;
  commercialTerms?: string;
  paymentTerms?: string;
  generalProvisions?: string;
};

export type BrandTermsInput = Omit<BrandTerms, "brand">;

export function isBrandTermsList(data: unknown): data is BrandTerms[] {
  return (
    Array.isArray(data) &&
    data.every(
      (item) =>
        !!item &&
        typeof item === "object" &&
        "brand" in item &&
        (item.brand === "TEKNOTIP" || item.brand === "OPTOSENSE" || item.brand === "MILIMLAB"),
    )
  );
}

export function getBrandTerms(): Promise<ApiResult<BrandTerms[]>> {
  return customFetch(`/backend/v1/settings/terms`);
}

export function updateBrandTerms(brand: BrandTerms["brand"], body: BrandTermsInput) {
  return send<BrandTerms>(`/backend/v1/settings/terms/${brand}`, "PUT", body);
}
