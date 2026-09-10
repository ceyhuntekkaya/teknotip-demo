import voiceJson from "@/app/data/voice.json";
import { DEFAULT_VAD_CONFIG, type VadConfig } from "./vad";

export type VoiceFile = {
  silenceSeconds?: number;
};

const FALLBACK_SILENCE_SECONDS = 4;

export function readSilenceSeconds(raw: unknown): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value <= 0) return FALLBACK_SILENCE_SECONDS;
  return value;
}

export const voiceSettings = {
  silenceSeconds: readSilenceSeconds((voiceJson as VoiceFile).silenceSeconds),
};

export function voiceVadConfig(): VadConfig {
  return {
    ...DEFAULT_VAD_CONFIG,
    silenceMs: Math.round(voiceSettings.silenceSeconds * 1000),
  };
}
