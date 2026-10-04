/** Fallback if app/data/voice.json is missing or invalid. */
export const SILENCE_MS = 4000;
/**
 * Lowest speech threshold (quiet room). Raised automatically in noise via the
 * floor, so it can sit low enough for quiet mics (Safari with noise
 * suppression and no AGC reads speech around 0.02–0.04).
 */
export const SPEECH_RMS = 0.02;
/** Level-bar scale; independent of the detection threshold. */
const LEVEL_RMS = 0.045;
export const MIN_SPEECH_MS = 250;
export const MAX_RECORD_MS = 60_000;
export const CLICK_IGNORE_MS = 200;
/** After a pause, sound must last this long to restart the silence timer. */
export const RESUME_MS = 150;
/** Dips shorter than this do not break a speech run (syllable gaps). */
export const HANG_MS = 150;
/** Noise floor = lowest frame RMS seen over this window. */
export const FLOOR_WINDOW_MS = 2000;
const FLOOR_BUCKET_MS = 100;
/** Speech starts above floor × ON_RATIO and ends below floor × OFF_RATIO. */
export const ON_RATIO = 3;
export const OFF_RATIO = 2;
/** In a quiet room the end threshold sits below the start threshold. */
const RELEASE_FACTOR = 0.6;

export type VadConfig = {
  silenceMs: number;
  speechRms: number;
  minSpeechMs: number;
  maxRecordMs: number;
  clickIgnoreMs: number;
  resumeMs: number;
  hangMs: number;
  floorWindowMs: number;
  onRatio: number;
  offRatio: number;
};

export const DEFAULT_VAD_CONFIG: VadConfig = {
  silenceMs: SILENCE_MS,
  speechRms: SPEECH_RMS,
  minSpeechMs: MIN_SPEECH_MS,
  maxRecordMs: MAX_RECORD_MS,
  clickIgnoreMs: CLICK_IGNORE_MS,
  resumeMs: RESUME_MS,
  hangMs: HANG_MS,
  floorWindowMs: FLOOR_WINDOW_MS,
  onRatio: ON_RATIO,
  offRatio: OFF_RATIO,
};

type FloorBucket = { at: number; min: number };

export type VadState = {
  startedAt: number;
  speechSeen: boolean;
  /** Start of the current run above speechOn (used before speech is confirmed). */
  loudStartedAt: number | null;
  lastOnAt: number | null;
  /** Start of the current run above speechOff (used after speech is confirmed). */
  activeStartedAt: number | null;
  lastOffAt: number | null;
  /** Last moment counted as speech. The silence timer runs from here. */
  lastLoudAt: number | null;
  floorBuckets: FloorBucket[];
};

export type VadDecision = "continue" | "silence" | "max";

export type VadThresholds = {
  floor: number;
  speechOn: number;
  speechOff: number;
};

export type VadTick = {
  state: VadState;
  decision: VadDecision;
  level: number;
  thresholds: VadThresholds;
  /** Time since the last speech; 0 before any speech. */
  silentMs: number;
};

export function createVadState(now: number): VadState {
  return {
    startedAt: now,
    speechSeen: false,
    loudStartedAt: null,
    lastOnAt: null,
    activeStartedAt: null,
    lastOffAt: null,
    lastLoudAt: null,
    floorBuckets: [],
  };
}

/**
 * RMS before subtracting the frame mean (DC bias).
 *
 * getByteTimeDomainData centers silence at 128, but some devices / AGC
 * leave silence sitting at e.g. 140. Treating 128 as zero then reads a
 * steady RMS ~0.09 — above SPEECH_RMS — so lastLoudAt never ages and
 * the 2s silence timer never fires.
 *
 * An unwritten analyser buffer (all 0) used to read as RMS 1.0; removing
 * the mean makes that 0 as well.
 */
export function rmsFromByteTimeDomain(samples: Uint8Array): number {
  if (samples.length === 0) return 0;
  let mean = 0;
  for (let i = 0; i < samples.length; i += 1) {
    mean += samples[i] ?? 128;
  }
  mean /= samples.length;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const normalized = ((samples[i] ?? 128) - mean) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / samples.length);
}

export function rmsToLevel(rms: number, speechRms = LEVEL_RMS): number {
  return Math.min(1, rms / (speechRms * 4));
}

/**
 * Minimum statistics: the quietest 100 ms bucket of the last floorWindowMs.
 * Gaps between syllables fall to the room noise, so the floor holds during
 * speech, while a steady fan/AC hum lifts it within the window.
 */
function nextFloorBuckets(
  buckets: FloorBucket[],
  rms: number,
  now: number,
  windowMs: number,
): FloorBucket[] {
  const at = Math.floor(now / FLOOR_BUCKET_MS) * FLOOR_BUCKET_MS;
  const kept = buckets.filter((bucket) => bucket.at > now - windowMs);
  const last = kept[kept.length - 1];
  if (last && last.at === at) {
    kept[kept.length - 1] = { at, min: Math.min(last.min, rms) };
  } else {
    kept.push({ at, min: rms });
  }
  return kept;
}

export function vadThresholds(
  floorBuckets: FloorBucket[],
  config: VadConfig = DEFAULT_VAD_CONFIG,
): VadThresholds {
  const floor = floorBuckets.length
    ? Math.min(...floorBuckets.map((bucket) => bucket.min))
    : 0;
  return {
    floor,
    speechOn: Math.max(config.speechRms, floor * config.onRatio),
    speechOff: Math.max(config.speechRms * RELEASE_FACTOR, floor * config.offRatio),
  };
}

/**
 * One VAD step. `now` must be monotonic (audio clock or performance.now()).
 *
 * - Speech is confirmed by `minSpeechMs` above speechOn.
 * - While speaking, anything above speechOff keeps the run alive; dips up
 *   to `hangMs` are bridged.
 * - After a pause, only `resumeMs` of continuous sound above speechOff
 *   restarts the timer, so clicks and coughs cannot hold the take open.
 * - "silence" fires exactly `silenceMs` after the last counted speech.
 */
export function tickVad(
  state: VadState,
  rms: number,
  now: number,
  config: VadConfig = DEFAULT_VAD_CONFIG,
): VadTick {
  const floorBuckets = nextFloorBuckets(
    state.floorBuckets,
    rms,
    now,
    config.floorWindowMs,
  );
  const thresholds = vadThresholds(floorBuckets, config);
  const level = rmsToLevel(rms);
  const elapsed = now - state.startedAt;

  const ignoreClick = elapsed < config.clickIgnoreMs;
  const aboveOn = !ignoreClick && rms >= thresholds.speechOn;
  const aboveOff = !ignoreClick && rms >= thresholds.speechOff;
  let { speechSeen, loudStartedAt, lastOnAt, activeStartedAt, lastOffAt, lastLoudAt } =
    state;

  // A run survives dips up to hangMs: 20 ms frames of real speech flicker
  // below the threshold between syllables.
  if (aboveOn) {
    if (loudStartedAt === null || lastOnAt === null || now - lastOnAt > config.hangMs) {
      loudStartedAt = now;
    }
    lastOnAt = now;
  } else if (lastOnAt === null || now - lastOnAt > config.hangMs) {
    loudStartedAt = null;
  }
  if (aboveOff) {
    if (activeStartedAt === null || lastOffAt === null || now - lastOffAt > config.hangMs) {
      activeStartedAt = now;
    }
    lastOffAt = now;
  } else if (lastOffAt === null || now - lastOffAt > config.hangMs) {
    activeStartedAt = null;
  }

  if (!speechSeen) {
    if (aboveOn && loudStartedAt !== null && now - loudStartedAt >= config.minSpeechMs) {
      speechSeen = true;
      lastLoudAt = now;
    }
  } else if (aboveOff && activeStartedAt !== null) {
    const speaking = lastLoudAt !== null && now - lastLoudAt < config.hangMs;
    if (speaking || now - activeStartedAt >= config.resumeMs) {
      lastLoudAt = now;
    }
  }

  const next: VadState = {
    startedAt: state.startedAt,
    speechSeen,
    loudStartedAt,
    lastOnAt,
    activeStartedAt,
    lastOffAt,
    lastLoudAt,
    floorBuckets,
  };
  const silentMs = speechSeen && lastLoudAt !== null ? now - lastLoudAt : 0;

  let decision: VadDecision = "continue";
  if (speechSeen && silentMs >= config.silenceMs) decision = "silence";
  else if (elapsed >= config.maxRecordMs) decision = "max";

  return { state: next, decision, level, thresholds, silentMs };
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
