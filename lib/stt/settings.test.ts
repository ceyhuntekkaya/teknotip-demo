import { describe, expect, it } from "vitest";
import { formatSilenceSeconds, readSilenceSeconds, readSpeechRms, voiceSettings } from "./settings";

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

describe("readSpeechRms", () => {
  it("keeps a positive number", () => {
    expect(readSpeechRms(0.02)).toBe(0.02);
  });

  it("falls back when the value is missing or invalid", () => {
    expect(readSpeechRms(undefined)).toBe(0.02);
    expect(readSpeechRms(0)).toBe(0.02);
    expect(readSpeechRms(-1)).toBe(0.02);
    expect(readSpeechRms("abc")).toBe(0.02);
  });
});

describe("voiceSettings", () => {
  it("loads silenceSeconds and speechRms from app/data/voice.json", () => {
    expect(voiceSettings.silenceSeconds).toBe(1.2);
    expect(voiceSettings.speechRms).toBe(0.02);
    expect(formatSilenceSeconds()).toBe("1,2");
  });
});
