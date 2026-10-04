import { describe, expect, it } from "vitest";
import { byteBuffersEqual, shouldSubmitUtterance, type UtteranceResult } from "./listen";
import {
  CLICK_IGNORE_MS,
  MIN_SPEECH_MS,
  createVadState,
  tickVad,
  DEFAULT_VAD_CONFIG,
} from "./vad";

function utterance(partial: Partial<UtteranceResult>): UtteranceResult {
  return {
    blob: new Blob([Uint8Array.from([1, 2, 3])]),
    mimeType: "audio/webm",
    reason: "silence",
    speechSeen: true,
    ...partial,
  };
}

describe("shouldSubmitUtterance", () => {
  it("sends a Durdur stop even when VAD never marked speech", () => {
    expect(
      shouldSubmitUtterance(utterance({ reason: "manual", speechSeen: false })),
    ).toBe(true);
  });

  it("drops an empty Durdur stop", () => {
    expect(
      shouldSubmitUtterance(
        utterance({ reason: "manual", speechSeen: true, blob: new Blob() }),
      ),
    ).toBe(false);
  });

  it("drops a discarded recording", () => {
    expect(shouldSubmitUtterance(utterance({ reason: "discard" }))).toBe(false);
  });

  it("still requires detected speech when silence ends the take", () => {
    expect(shouldSubmitUtterance(utterance({ reason: "silence", speechSeen: false }))).toBe(
      false,
    );
    expect(shouldSubmitUtterance(utterance({ reason: "silence", speechSeen: true }))).toBe(
      true,
    );
  });
});

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
    let spoken = tickVad(createVadState(0), 0.002, t0 - 100);
    // 50 ms analyser ticks, as in the fallback path.
    for (let t = t0; t <= t0 + MIN_SPEECH_MS; t += 50) {
      spoken = tickVad(spoken.state, 0.2, t);
    }
    expect(spoken.state.speechSeen).toBe(true);
    const done = tickVad(
      spoken.state,
      0,
      spoken.state.lastLoudAt! + DEFAULT_VAD_CONFIG.silenceMs,
    );
    expect(done.decision).toBe("silence");
  });
});
