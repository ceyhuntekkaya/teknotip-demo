import type { Catalog, Product } from "@/lib/catalog/types";
import type { QuoteDraft } from "./types";
import { normalizeText, tokenSet } from "./resolve/text";

const DEFAULT_K = 5;

function productTokens(product: Product): string[] {
  const parts = [
    product.name,
    product.code ?? "",
    ...(product.aliases ?? []),
    ...product.models.map((model) => model.name),
    ...product.models.map((model) => model.code ?? ""),
  ];
  return tokenSet(parts.join(" "));
}

function lexicalScore(product: Product, query: string): number {
  const q = normalizeText(query);
  if (!q) return 0;
  const tokens = tokenSet(q);
  const hay = productTokens(product);
  if (!tokens.length || !hay.length) return 0;
  let hits = 0;
  for (const token of tokens) {
    if (hay.some((item) => item === token || item.includes(token) || token.includes(item))) {
      hits += 1;
    }
  }
  const name = normalizeText(product.name);
  const aliasHit = (product.aliases ?? []).some((alias) => normalizeText(alias) === q);
  const codeHit = product.code ? normalizeText(product.code).replace(/[\s-]/g, "") === q.replace(/[\s-]/g, "") : false;
  let score = hits / tokens.length;
  if (name === q || aliasHit || codeHit) score = 1;
  else if (name.includes(q) || q.includes(name)) score = Math.max(score, 0.85);
  return score;
}

export function retrieveProducts(
  catalog: Catalog,
  draft: QuoteDraft,
  query: string,
  k = DEFAULT_K,
): Product[] {
  const byId = new Map<string, Product>();
  for (const line of draft.items) {
    const product = catalog.find((item) => item.id === line.productId);
    if (product) byId.set(product.id, product);
  }
  const ranked = catalog
    .map((product) => ({ product, score: lexicalScore(product, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  for (const item of ranked) {
    byId.set(item.product.id, item.product);
  }
  if (!byId.size) {
    return catalog.slice(0, k);
  }
  return [...byId.values()];
}
