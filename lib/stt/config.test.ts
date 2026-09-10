import { afterEach, describe, expect, it } from "vitest";
import { getSttConfig, sttTranscribeUrl } from "./config";

const keys = ["STT_URL", "STT_LANGUAGE", "STT_TIMEOUT_MS"] as const;

afterEach(() => {
  for (const key of keys) {
    delete process.env[key];
  }
});

describe("stt config", () => {
  it("defaults to the public Whisper service in Turkish", () => {
    const config = getSttConfig();
    expect(config.baseUrl).toBe("https://speaking.stt.eltaexams.com");
    expect(config.language).toBe("tr");
    expect(sttTranscribeUrl(config)).toBe(
      "https://speaking.stt.eltaexams.com/transcribe/tr",
    );
  });

  it("uses auto-detect when language is empty", () => {
    process.env.STT_LANGUAGE = "";
    const config = getSttConfig();
    expect(sttTranscribeUrl(config)).toBe(
      "https://speaking.stt.eltaexams.com/transcribe",
    );
  });

  it("strips a trailing slash from STT_URL", () => {
    process.env.STT_URL = "https://speaking.stt.eltaexams.com/";
    process.env.STT_LANGUAGE = "en";
    const config = getSttConfig();
    expect(sttTranscribeUrl(config)).toBe(
      "https://speaking.stt.eltaexams.com/transcribe/en",
    );
  });
});
