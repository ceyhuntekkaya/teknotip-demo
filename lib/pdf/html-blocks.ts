export type Inline =
  | { type: "text"; text: string }
  | { type: "br" }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] };

export type HtmlBlock =
  | { type: "p"; children: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | { type: "ol"; items: Inline[][] };

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const ALIASES: Record<string, string> = {
  b: "strong",
  i: "em",
  div: "p",
};

function decode(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, body: string) => {
    if (body.startsWith("#")) {
      const code =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : all;
    }
    return ENTITIES[body] ?? all;
  });
}

function alias(name: string): string {
  const lower = name.toLowerCase();
  return ALIASES[lower] ?? lower;
}

type Token =
  | { kind: "text"; text: string }
  | { kind: "open"; name: string }
  | { kind: "close"; name: string };

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>|[^<]+/g;
  for (const match of html.matchAll(pattern)) {
    if (match[2]) {
      const selfClosing = match[0].endsWith("/>") || alias(match[2]) === "br";
      const name = alias(match[2]);
      if (selfClosing && name === "br") {
        tokens.push({ kind: "open", name: "br" });
      } else if (match[1]) {
        tokens.push({ kind: "close", name });
      } else {
        tokens.push({ kind: "open", name });
      }
      continue;
    }
    tokens.push({ kind: "text", text: decode(match[0]) });
  }
  return tokens;
}

/**
 * Sınırlı koşul HTML'ini bloklara ayırır: p, br, strong, em, ul, ol, li.
 * Editörün ürettiği b, i ve div etiketleri de kabul edilir.
 */
export function parseHtmlBlocks(html: string): HtmlBlock[] {
  const blocks: HtmlBlock[] = [];
  let paragraph: Inline[] | null = null;
  let list: { ordered: boolean; items: Inline[][] } | null = null;
  let item: Inline[] | null = null;
  const marks: { wrap: "strong" | "em"; children: Inline[] }[] = [];

  const target = (): Inline[] => {
    const mark = marks[marks.length - 1];
    if (mark) return mark.children;
    if (item) return item;
    if (!paragraph) paragraph = [];
    return paragraph;
  };

  const closeParagraph = () => {
    if (!paragraph || paragraph.length === 0) {
      paragraph = null;
      return;
    }
    blocks.push({ type: "p", children: paragraph });
    paragraph = null;
  };

  const closeList = () => {
    if (item && list) list.items.push(item);
    item = null;
    if (!list) return;
    blocks.push(
      list.ordered ? { type: "ol", items: list.items } : { type: "ul", items: list.items },
    );
    list = null;
  };

  const flushMarks = () => {
    while (marks.length > 0) {
      const mark = marks.pop();
      if (!mark || mark.children.length === 0) continue;
      target().push({ type: mark.wrap, children: mark.children });
    }
  };

  for (const token of tokenize(html)) {
    if (token.kind === "text") {
      if (!token.text) continue;
      if (!token.text.trim() && !paragraph && !item && marks.length === 0) continue;
      target().push({ type: "text", text: token.text });
      continue;
    }

    if (token.kind === "open") {
      if (token.name === "br") {
        target().push({ type: "br" });
      } else if (token.name === "strong" || token.name === "em") {
        marks.push({ wrap: token.name, children: [] });
      } else if (token.name === "p") {
        if (item) {
          if (item.length > 0 && marks.length === 0) item.push({ type: "br" });
        } else {
          flushMarks();
          closeParagraph();
          paragraph = [];
        }
      } else if (token.name === "ul" || token.name === "ol") {
        flushMarks();
        closeParagraph();
        closeList();
        list = { ordered: token.name === "ol", items: [] };
      } else if (token.name === "li") {
        flushMarks();
        if (!list) list = { ordered: false, items: [] };
        if (item) list.items.push(item);
        item = [];
      }
      continue;
    }

    if (token.name === "strong" || token.name === "em") {
      const mark = marks.pop();
      if (!mark) continue;
      const node: Inline = { type: mark.wrap, children: mark.children };
      if (mark.wrap !== token.name) {
        for (const child of mark.children) target().push(child);
      } else if (mark.children.length > 0) {
        target().push(node);
      }
    } else if (token.name === "p") {
      if (!item) {
        flushMarks();
        closeParagraph();
      }
    } else if (token.name === "li") {
      flushMarks();
      if (item && list) list.items.push(item);
      item = null;
    } else if (token.name === "ul" || token.name === "ol") {
      flushMarks();
      closeList();
    }
  }

  flushMarks();
  closeParagraph();
  closeList();
  return blocks;
}

export function applyTermTokens(
  value: string,
  tokens: { rate?: string; date?: string },
): string {
  return value
    .replaceAll("{rate}", tokens.rate ?? "")
    .replaceAll("{date}", tokens.date ?? "");
}

export function textOr(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}
