import voiceJson from "@/app/data/voice.json";
import { DEFAULT_VAD_CONFIG, SPEECH_RMS, type VadConfig } from "./vad";

export type VoiceFile = {
  silenceSeconds?: number;
  speechRms?: number;
};

const FALLBACK_SILENCE_SECONDS = 4;

export function readSilenceSeconds(raw: unknown): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value <= 0) return FALLBACK_SILENCE_SECONDS;
  return value;
}

export function readSpeechRms(raw: unknown): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value <= 0) return SPEECH_RMS;
  return value;
}

export const voiceSettings = {
  silenceSeconds: readSilenceSeconds((voiceJson as VoiceFile).silenceSeconds),
  speechRms: readSpeechRms((voiceJson as VoiceFile).speechRms),
};

export function formatSilenceSeconds(seconds = voiceSettings.silenceSeconds): string {
  return seconds.toLocaleString("tr-TR");
}

export function voiceVadConfig(): VadConfig {
  return {
    ...DEFAULT_VAD_CONFIG,
    silenceMs: Math.round(voiceSettings.silenceSeconds * 1000),
    speechRms: voiceSettings.speechRms,
  };
}
