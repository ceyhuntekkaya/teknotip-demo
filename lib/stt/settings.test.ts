import { describe, expect, it } from "vitest";
import { readSilenceSeconds, voiceSettings } from "./settings";

describe("readSilenceSeconds", () => {
  it("keeps a positive number", () => {
    expect(readSilenceSeconds(1.5)).toBe(1.5);
    expect(readSilenceSeconds(4)).toBe(4);
  });

  it("falls back when the value is missing or invalid", () => {
    expect(readSilenceSeconds(undefined)).toBe(4);
    expect(readSilenceSeconds(0)).toBe(4);
    expect(readSilenceSeconds(-2)).toBe(4);
    expect(readSilenceSeconds("abc")).toBe(4);
  });
});

describe("voiceSettings", () => {
  it("loads silenceSeconds from app/data/voice.json", () => {
    expect(voiceSettings.silenceSeconds).toBeGreaterThan(0);
  });
});
