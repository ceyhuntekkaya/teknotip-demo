const DEFAULT_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "qwen2.5:14b";
const DEFAULT_NUM_CTX = 12288;
const DEFAULT_TIMEOUT_MS = 300_000;

export type OllamaConfig = {
  baseUrl: string;
  model: string;
  headers: Record<string, string>;
  timeoutMs: number;
  numCtx: number;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function basicAuthHeader(): string | undefined {
  const encoded = process.env.OLLAMA_BASIC_AUTH_B64?.trim();
  if (encoded) {
    return `Basic ${encoded}`;
  }

  const user = process.env.OLLAMA_BASIC_USER?.trim();
  if (!user) {
    return undefined;
  }

  const pass = process.env.OLLAMA_BASIC_PASS ?? "";
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

export function getOllamaConfig(): OllamaConfig {
  const baseUrl = (
    process.env.OLLAMA_URL?.trim() ||
    process.env.OLLAMA_HOST?.trim() ||
    DEFAULT_URL
  ).replace(/\/$/, "");

  const auth = basicAuthHeader();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth) {
    headers.Authorization = auth;
  }

  return {
    baseUrl,
    model: process.env.OLLAMA_MODEL?.trim() || DEFAULT_MODEL,
    headers,
    timeoutMs: parsePositiveInt(process.env.OLLAMA_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    numCtx: parsePositiveInt(process.env.OLLAMA_NUM_CTX, DEFAULT_NUM_CTX),
  };
}

export function ollamaChatUrl(config: OllamaConfig): string {
  return `${config.baseUrl}/api/chat`;
}
