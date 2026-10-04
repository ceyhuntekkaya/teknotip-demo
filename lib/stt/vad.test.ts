import { describe, expect, it } from "vitest";
import {
  CLICK_IGNORE_MS,
  DEFAULT_VAD_CONFIG,
  MAX_RECORD_MS,
  MIN_SPEECH_MS,
  RESUME_MS,
  SILENCE_MS,
  createVadState,
  isUsableTranscript,
  rmsFromByteTimeDomain,
  tickVad,
  type VadConfig,
  type VadTick,
} from "./vad";

const FRAME_MS = 20;
const QUIET = 0.002;
const LOUD = 0.2;

/** [rms, durationMs]; rms may be a function of the frame time. */
type Segment = [number | ((t: number) => number), number];

type Run = {
  ticks: VadTick[];
  /** Time of the first non-"continue" decision, or null. */
  stoppedAt: number | null;
  decision: VadTick["decision"];
  /** Time the last speech segment ended. */
  marks: number[];
};

/** Feeds 20 ms frames through tickVad, like the AudioWorklet meter. */
function simulate(segments: Segment[], config: VadConfig = DEFAULT_VAD_CONFIG): Run {
  let state = createVadState(0);
  const ticks: VadTick[] = [];
  const marks: number[] = [];
  let t = 0;
  for (const [rms, duration] of segments) {
    const end = t + duration;
    for (; t < end; t += FRAME_MS) {
      const value = typeof rms === "function" ? rms(t) : rms;
      const tick = tickVad(state, value, t + FRAME_MS, config);
      ticks.push(tick);
      state = tick.state;
      if (tick.decision !== "continue") {
        return { ticks, stoppedAt: t + FRAME_MS, decision: tick.decision, marks };
      }
    }
    marks.push(t);
  }
  return { ticks, stoppedAt: null, decision: "continue", marks };
}

/** Voiced speech: loud with a short dip between syllables. */
function speech(level: number, floor = QUIET) {
  return (t: number) => (t % 460 < 400 ? level : floor);
}

describe("rmsFromByteTimeDomain", () => {
  it("is ~0 for silence (all 128)", () => {
    const samples = Uint8Array.from({ length: 32 }, () => 128);
    expect(rmsFromByteTimeDomain(samples)).toBeCloseTo(0, 8);
  });

  it("is 1 for full-scale square-ish signal", () => {
    const samples = Uint8Array.from({ length: 4 }, (_, i) => (i % 2 === 0 ? 0 : 255));
    expect(rmsFromByteTimeDomain(samples)).toBeGreaterThan(0.99);
  });

  it("is 0 for an empty buffer", () => {
    expect(rmsFromByteTimeDomain(new Uint8Array())).toBe(0);
  });

  it("is ~0 for DC-biased silence (all 140)", () => {
    const samples = Uint8Array.from({ length: 32 }, () => 140);
    expect(rmsFromByteTimeDomain(samples)).toBeCloseTo(0, 8);
  });

  it("is ~0 when the analyser never wrote (all 0)", () => {
    expect(rmsFromByteTimeDomain(new Uint8Array(32))).toBeCloseTo(0, 8);
  });
});

describe("tickVad", () => {
  it("fires exactly silenceMs after speech in a quiet room", () => {
    const run = simulate([
      [QUIET, 400],
      [speech(LOUD), 1200],
      [QUIET, SILENCE_MS + 1000],
    ]);
    expect(run.decision).toBe("silence");
    const lastSpeech = run.ticks.findLast((tick) => tick.silentMs === 0)!;
    expect(run.stoppedAt! - lastSpeech.state.lastLoudAt!).toBe(SILENCE_MS);
    expect(run.stoppedAt! - run.marks[1]!).toBeLessThanOrEqual(SILENCE_MS);
  });

  it("confirms choppy speech whose 20 ms frames keep dipping", () => {
    // 60 ms voiced, 40 ms dip: never 250 ms above threshold in one piece.
    const choppy = (t: number) => (t % 100 < 60 ? LOUD : QUIET);
    const run = simulate([
      [QUIET, 400],
      [choppy, 1200],
      [QUIET, SILENCE_MS + 500],
    ]);
    expect(run.decision).toBe("silence");
    expect(run.stoppedAt! - run.marks[1]!).toBeLessThanOrEqual(SILENCE_MS);
  });

  it("confirms quiet speech from a low-gain mic (Safari)", () => {
    const run = simulate([
      [0.003, 400],
      [speech(0.03, 0.003), 1500],
      [0.003, SILENCE_MS + 500],
    ]);
    expect(run.decision).toBe("silence");
    expect(run.stoppedAt! - run.marks[1]!).toBeLessThanOrEqual(SILENCE_MS);
  });

  it("does not stop on silence if no speech was heard", () => {
    const run = simulate([[QUIET, SILENCE_MS + 2000]]);
    expect(run.decision).toBe("continue");
    expect(run.ticks.at(-1)!.state.speechSeen).toBe(false);
  });

  it("ignores a click in the opening window", () => {
    const run = simulate([
      [LOUD, CLICK_IGNORE_MS - 20],
      [QUIET, SILENCE_MS + 1000],
    ]);
    expect(run.decision).toBe("continue");
    expect(run.ticks.at(-1)!.state.speechSeen).toBe(false);
  });

  it("does not count a brief spike as speech", () => {
    const run = simulate([
      [QUIET, 400],
      [LOUD, MIN_SPEECH_MS - 40],
      [QUIET, SILENCE_MS + 1000],
    ]);
    expect(run.decision).toBe("continue");
    expect(run.ticks.at(-1)!.state.speechSeen).toBe(false);
  });

  it("fires in a steady noisy room (floor above the old fixed threshold)", () => {
    const noise = 0.06;
    expect(noise).toBeGreaterThan(DEFAULT_VAD_CONFIG.speechRms);
    const run = simulate([
      [noise, 2500],
      [speech(0.35, noise), 1500],
      [noise, SILENCE_MS + 3000],
    ]);
    expect(run.decision).toBe("silence");
    expect(run.stoppedAt! - run.marks[1]!).toBeLessThanOrEqual(SILENCE_MS);
  });

  it("adapts when noise starts mid-take", () => {
    const run = simulate([
      [QUIET, 400],
      [speech(0.3), 1000],
      [0.07, 10_000],
    ]);
    expect(run.decision).toBe("silence");
    // Floor needs at most one window to catch up with the new noise.
    expect(run.stoppedAt! - run.marks[1]!).toBeLessThanOrEqual(
      SILENCE_MS + DEFAULT_VAD_CONFIG.floorWindowMs,
    );
  });

  it("is not held open by noise flickering around the threshold", () => {
    const flicker = (t: number) => (Math.floor(t / 20) % 2 === 0 ? 0.04 : 0.05);
    const run = simulate([
      [flicker, 2500],
      [speech(0.3, 0.04), 1200],
      [flicker, SILENCE_MS + 3000],
    ]);
    expect(run.decision).toBe("silence");
    expect(run.stoppedAt! - run.marks[1]!).toBeLessThanOrEqual(SILENCE_MS);
  });

  it("does not let clicks and coughs after speech reset the timer", () => {
    const clicks = (t: number) => (t % 500 < 60 ? 0.4 : QUIET);
    const run = simulate([
      [QUIET, 400],
      [speech(LOUD), 1000],
      [QUIET, 300],
      [clicks, SILENCE_MS + 1000],
    ]);
    expect(run.decision).toBe("silence");
    expect(run.stoppedAt! - run.marks[1]!).toBeLessThanOrEqual(SILENCE_MS);
  });

  it("restarts the timer when speech really returns", () => {
    const run = simulate([
      [QUIET, 400],
      [speech(LOUD), 1000],
      [QUIET, SILENCE_MS - 500],
      [LOUD, RESUME_MS + 100],
      [QUIET, SILENCE_MS + 1000],
    ]);
    expect(run.decision).toBe("silence");
    expect(run.stoppedAt!).toBeGreaterThan(run.marks[3]!);
    expect(run.stoppedAt! - run.marks[3]!).toBeLessThanOrEqual(SILENCE_MS);
  });

  it("keeps a long sentence open across syllable gaps", () => {
    const run = simulate([
      [QUIET, 400],
      [speech(LOUD), 8000],
    ]);
    expect(run.decision).toBe("continue");
    expect(run.ticks.at(-1)!.state.speechSeen).toBe(true);
  });

  it("lets silence fire when the mic sits on a DC-biased floor", () => {
    const dcSilence = rmsFromByteTimeDomain(
      Uint8Array.from({ length: 32 }, () => 140),
    );
    const run = simulate([
      [QUIET, 400],
      [speech(LOUD), 800],
      [dcSilence, SILENCE_MS + 500],
    ]);
    expect(run.decision).toBe("silence");
  });

  it("stops at max duration even without speech", () => {
    const tick = tickVad(createVadState(0), QUIET, MAX_RECORD_MS);
    expect(tick.decision).toBe("max");
  });

  it("stops at max duration while speech never pauses", () => {
    const run = simulate([
      [QUIET, 400],
      [speech(LOUD), MAX_RECORD_MS + 1000],
    ]);
    expect(run.decision).toBe("max");
    expect(run.stoppedAt).toBe(MAX_RECORD_MS);
  });

  it("uses injected config thresholds", () => {
    const config = {
      ...DEFAULT_VAD_CONFIG,
      silenceMs: 100,
      minSpeechMs: 10,
      clickIgnoreMs: 0,
    };
    const run = simulate(
      [
        [QUIET, 200],
        [LOUD, 100],
        [QUIET, 500],
      ],
      config,
    );
    expect(run.decision).toBe("silence");
    expect(run.stoppedAt! - run.marks[1]!).toBe(100);
  });
});

describe("isUsableTranscript", () => {
  it("rejects empty, tiny, and known Whisper junk", () => {
    expect(isUsableTranscript("")).toBe(false);
    expect(isUsableTranscript(" ")).toBe(false);
    expect(isUsableTranscript(".")).toBe(false);
    expect(isUsableTranscript("you")).toBe(false);
    expect(isUsableTranscript("Altyazı M.K.")).toBe(false);
  });

  it("accepts a real Turkish phrase", () => {
    expect(isUsableTranscript("CVD fırın olsun")).toBe(true);
    expect(isUsableTranscript("evet")).toBe(true);
  });
});
