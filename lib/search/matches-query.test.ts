import { describe, expect, it } from "vitest";
import { matchesQuery } from "@/lib/search/matches-query";

describe("matchesQuery", () => {
  it("matches when the query is empty", () => {
    expect(matchesQuery(["ODTÜ"], "  ")).toBe(true);
  });

  it("matches a substring case-insensitively", () => {
    expect(matchesQuery(["CVD FIRIN"], "fır")).toBe(true);
    expect(matchesQuery(["Ayşe"], "ayşe")).toBe(true);
  });

  it("handles Turkish dotted and dotless i", () => {
    expect(matchesQuery(["İstanbul"], "istan")).toBe(true);
    expect(matchesQuery(["Iğdır"], "ığd")).toBe(true);
  });

  it("returns false when no field matches", () => {
    expect(matchesQuery(["ODTÜ", "Ayşe"], "vakum")).toBe(false);
  });

  it("ignores empty fields", () => {
    expect(matchesQuery([undefined, "", "  ", "Kayseri"], "kays")).toBe(true);
  });
});
