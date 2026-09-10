const DEFAULT_URL = "https://speaking.stt.eltaexams.com";
const DEFAULT_LANGUAGE = "tr";
const DEFAULT_TIMEOUT_MS = 120_000;

export type SttConfig = {
  baseUrl: string;
  language: string;
  timeoutMs: number;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getSttConfig(): SttConfig {
  const language = process.env.STT_LANGUAGE?.trim() ?? DEFAULT_LANGUAGE;
  return {
    baseUrl: (process.env.STT_URL?.trim() || DEFAULT_URL).replace(/\/$/, ""),
    language,
    timeoutMs: parsePositiveInt(process.env.STT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}

export function sttTranscribeUrl(config: SttConfig): string {
  if (!config.language) {
    return `${config.baseUrl}/transcribe`;
  }
  return `${config.baseUrl}/transcribe/${config.language}`;
}
