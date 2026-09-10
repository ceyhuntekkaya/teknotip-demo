import { describe, expect, it } from "vitest";
import {
  CLICK_IGNORE_MS,
  DEFAULT_VAD_CONFIG,
  MAX_RECORD_MS,
  MIN_SPEECH_MS,
  SILENCE_MS,
  createVadState,
  isUsableTranscript,
  rmsFromByteTimeDomain,
  tickVad,
} from "./vad";

const LOUD = 0.2;
const QUIET = 0.001;

function confirmSpeech(start: number) {
  const loudAt = start + CLICK_IGNORE_MS;
  const first = tickVad(createVadState(start), LOUD, loudAt);
  return tickVad(first.state, LOUD, loudAt + MIN_SPEECH_MS);
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
});

describe("tickVad", () => {
  it("does not stop after 4s if no speech was heard", () => {
    let state = createVadState(0);
    const tick = tickVad(state, QUIET, SILENCE_MS + 500);
    expect(tick.decision).toBe("continue");
    expect(tick.state.speechSeen).toBe(false);
  });

  it("ignores a click in the opening window", () => {
    let state = createVadState(0);
    const duringClick = tickVad(state, LOUD, CLICK_IGNORE_MS - 10);
    expect(duringClick.state.speechSeen).toBe(false);
    expect(duringClick.state.loudStartedAt).toBeNull();
    const later = tickVad(duringClick.state, QUIET, SILENCE_MS + 1000);
    expect(later.decision).toBe("continue");
  });

  it("does not count a brief spike as speech", () => {
    let state = createVadState(0);
    const t0 = CLICK_IGNORE_MS;
    const spike = tickVad(state, LOUD, t0);
    const tooShort = tickVad(spike.state, LOUD, t0 + MIN_SPEECH_MS - 20);
    expect(tooShort.state.speechSeen).toBe(false);
    const quiet = tickVad(tooShort.state, QUIET, t0 + MIN_SPEECH_MS);
    expect(quiet.state.speechSeen).toBe(false);
    const later = tickVad(quiet.state, QUIET, t0 + MIN_SPEECH_MS + SILENCE_MS);
    expect(later.decision).toBe("continue");
  });

  it("stops after speech plus 4s of silence", () => {
    const speaking = confirmSpeech(1_000);
    expect(speaking.state.speechSeen).toBe(true);
    expect(speaking.decision).toBe("continue");
    const silent = tickVad(
      speaking.state,
      QUIET,
      speaking.state.lastLoudAt! + SILENCE_MS,
    );
    expect(silent.decision).toBe("silence");
  });

  it("resets the silence timer when speech returns", () => {
    const spoken = confirmSpeech(0);
    const lastLoud = spoken.state.lastLoudAt!;
    const pause = tickVad(spoken.state, QUIET, lastLoud + SILENCE_MS - 200);
    expect(pause.decision).toBe("continue");
    const again = tickVad(pause.state, LOUD, lastLoud + SILENCE_MS - 100);
    expect(again.decision).toBe("continue");
    const tooSoon = tickVad(
      again.state,
      QUIET,
      again.state.lastLoudAt! + SILENCE_MS - 1,
    );
    expect(tooSoon.decision).toBe("continue");
    const done = tickVad(again.state, QUIET, again.state.lastLoudAt! + SILENCE_MS);
    expect(done.decision).toBe("silence");
  });

  it("stops at max duration even without speech", () => {
    const tick = tickVad(createVadState(0), QUIET, MAX_RECORD_MS);
    expect(tick.decision).toBe("max");
  });

  it("stops at max duration when the signal never drops", () => {
    const spoken = confirmSpeech(0);
    const noisy = tickVad(spoken.state, LOUD, MAX_RECORD_MS);
    expect(noisy.decision).toBe("max");
  });

  it("uses injected config thresholds", () => {
    const config = {
      ...DEFAULT_VAD_CONFIG,
      silenceMs: 100,
      minSpeechMs: 10,
      clickIgnoreMs: 0,
    };
    const rising = tickVad(createVadState(0), LOUD, 0, config);
    const spoken = tickVad(rising.state, LOUD, 10, config);
    expect(spoken.state.speechSeen).toBe(true);
    const done = tickVad(spoken.state, QUIET, 110, config);
    expect(done.decision).toBe("silence");
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
