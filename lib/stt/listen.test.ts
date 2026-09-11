import { describe, expect, it } from "vitest";
import { byteBuffersEqual } from "./listen";
import {
  CLICK_IGNORE_MS,
  MIN_SPEECH_MS,
  createVadState,
  tickVad,
  DEFAULT_VAD_CONFIG,
} from "./vad";

describe("byteBuffersEqual", () => {
  it("is true only when every sample matches", () => {
    const a = Uint8Array.from([128, 129, 130]);
    expect(byteBuffersEqual(a, Uint8Array.from([128, 129, 130]))).toBe(true);
    expect(byteBuffersEqual(a, Uint8Array.from([128, 129, 131]))).toBe(false);
    expect(byteBuffersEqual(a, Uint8Array.from([128, 129]))).toBe(false);
  });
});

describe("frozen analyser frames vs VAD", () => {
  it("lets silence fire if a stuck loud buffer is treated as rms 0", () => {
    const t0 = CLICK_IGNORE_MS;
    const rising = tickVad(createVadState(0), 0.2, t0);
    const spoken = tickVad(rising.state, 0.2, t0 + MIN_SPEECH_MS);
    expect(spoken.state.speechSeen).toBe(true);
    const done = tickVad(
      spoken.state,
      0,
      spoken.state.lastLoudAt! + DEFAULT_VAD_CONFIG.silenceMs,
    );
    expect(done.decision).toBe("silence");
  });
});
