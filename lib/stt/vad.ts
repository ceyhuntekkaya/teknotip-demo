/** Fallback if app/data/voice.json is missing or invalid. */
export const SILENCE_MS = 4000;
export const SPEECH_RMS = 0.045;
export const MIN_SPEECH_MS = 250;
export const MAX_RECORD_MS = 60_000;
export const CLICK_IGNORE_MS = 200;

export type VadConfig = {
  silenceMs: number;
  speechRms: number;
  minSpeechMs: number;
  maxRecordMs: number;
  clickIgnoreMs: number;
};

export const DEFAULT_VAD_CONFIG: VadConfig = {
  silenceMs: SILENCE_MS,
  speechRms: SPEECH_RMS,
  minSpeechMs: MIN_SPEECH_MS,
  maxRecordMs: MAX_RECORD_MS,
  clickIgnoreMs: CLICK_IGNORE_MS,
};

export type VadState = {
  startedAt: number;
  speechSeen: boolean;
  loudStartedAt: number | null;
  lastLoudAt: number | null;
};

export type VadDecision = "continue" | "silence" | "max";

export type VadTick = {
  state: VadState;
  decision: VadDecision;
  level: number;
};

export function createVadState(now: number): VadState {
  return {
    startedAt: now,
    speechSeen: false,
    loudStartedAt: null,
    lastLoudAt: null,
  };
}

export function rmsFromByteTimeDomain(samples: Uint8Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const normalized = ((samples[i] ?? 128) - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / samples.length);
}

export function rmsToLevel(rms: number, speechRms = SPEECH_RMS): number {
  return Math.min(1, rms / (speechRms * 4));
}

export function tickVad(
  state: VadState,
  rms: number,
  now: number,
  config: VadConfig = DEFAULT_VAD_CONFIG,
): VadTick {
  const elapsed = now - state.startedAt;
  if (elapsed >= config.maxRecordMs) {
    return { state, decision: "max", level: rmsToLevel(rms, config.speechRms) };
  }

  const ignoreClick = elapsed < config.clickIgnoreMs;
  const loud = !ignoreClick && rms >= config.speechRms;
  let { speechSeen, loudStartedAt, lastLoudAt } = state;

  if (loud) {
    if (loudStartedAt === null) loudStartedAt = now;
    if (speechSeen || now - loudStartedAt >= config.minSpeechMs) {
      speechSeen = true;
      lastLoudAt = now;
    }
  } else {
    loudStartedAt = null;
  }

  const next: VadState = {
    startedAt: state.startedAt,
    speechSeen,
    loudStartedAt,
    lastLoudAt,
  };
  const silenced =
    speechSeen && lastLoudAt !== null && now - lastLoudAt >= config.silenceMs;

  return {
    state: next,
    decision: silenced ? "silence" : "continue",
    level: rmsToLevel(rms, config.speechRms),
  };
}

const JUNK_TRANSCRIPTS = new Set([
  ".",
  "..",
  "...",
  "you",
  "thank you",
  "thank you.",
  "thanks for watching",
  "altyazı m.k.",
  "altyazı mk",
  "altyazı m.k",
]);

export function isUsableTranscript(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  const normalized = trimmed.toLocaleLowerCase("tr").replace(/\s+/g, " ");
  if (JUNK_TRANSCRIPTS.has(normalized)) return false;
  const letters = normalized.replace(/[^\p{L}\p{N}]+/gu, "");
  return letters.length >= 2;
}
