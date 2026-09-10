import { describe, expect, it } from "vitest";
import { isDemoLogin, normalizeDemoSecret } from "./demo";

describe("demo login", () => {
  it("accepts the fixed Turkish credentials", () => {
    expect(isDemoLogin("teknotıp", "teknotıp")).toBe(true);
  });

  it("accepts ASCII i and extra spaces", () => {
    expect(isDemoLogin(" teknotip ", "teknotip")).toBe(true);
  });

  it("rejects other passwords", () => {
    expect(isDemoLogin("teknotıp", "yanlis")).toBe(false);
    expect(isDemoLogin("", "")).toBe(false);
  });

  it("folds Turkish dotted/dotless i the same way", () => {
    expect(normalizeDemoSecret("TEKNOTIP")).toBe("teknotip");
    expect(normalizeDemoSecret("teknotıp")).toBe("teknotip");
  });
});
