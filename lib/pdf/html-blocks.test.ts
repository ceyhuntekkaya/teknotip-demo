import { describe, expect, it } from "vitest";
import { applyTermTokens, parseHtmlBlocks } from "@/lib/pdf/html-blocks";

describe("parseHtmlBlocks", () => {
  it("reads paragraphs and strong text", () => {
    expect(parseHtmlBlocks("<p><strong>1. ÖDEME</strong></p><p>PEŞİN</p>")).toEqual([
      { type: "p", children: [{ type: "strong", children: [{ type: "text", text: "1. ÖDEME" }] }] },
      { type: "p", children: [{ type: "text", text: "PEŞİN" }] },
    ]);
  });

  it("reads lists and line breaks", () => {
    expect(parseHtmlBlocks("<ul><li>bir<br>iki</li><li><em>üç</em></li></ul>")).toEqual([
      {
        type: "ul",
        items: [
          [
            { type: "text", text: "bir" },
            { type: "br" },
            { type: "text", text: "iki" },
          ],
          [{ type: "em", children: [{ type: "text", text: "üç" }] }],
        ],
      },
    ]);
  });

  it("accepts editor aliases", () => {
    expect(parseHtmlBlocks("<div><b>kalın</b></div>")).toEqual([
      { type: "p", children: [{ type: "strong", children: [{ type: "text", text: "kalın" }] }] },
    ]);
  });
});

describe("applyTermTokens", () => {
  it("fills rate and date", () => {
    expect(applyTermTokens("%{rate} — {date}", { rate: "20", date: "01.11.2026" })).toBe(
      "%20 — 01.11.2026",
    );
  });
});
