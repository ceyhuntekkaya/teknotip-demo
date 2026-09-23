import type {
  ProductResponse,
  QuoteLineResponse,
  QuoteResponse,
} from "@/lib/api/generated/model";
import { productImageSrc } from "@/lib/files/product-image";
import { assetUrl } from "@/lib/pdf/format";

/** Prefer a usable line image; otherwise fall back to the live catalog product. */
export function resolveLineImageSrc(
  line: QuoteLineResponse,
  productsById?: Map<string, ProductResponse>,
): string | null {
  const fromLine = productImageSrc(line.image);
  if (fromLine) return fromLine;

  const productId = line.productId?.trim();
  if (!productId || !productsById) return null;
  return productImageSrc(productsById.get(productId)?.image);
}

export function lineImageKey(line: QuoteLineResponse, index: number): string {
  return line.id?.trim() || `line-${index}`;
}

export async function prefetchQuoteImages(
  quote: QuoteResponse,
  products: ProductResponse[],
  origin: string,
): Promise<Record<string, string>> {
  const productsById = new Map(
    products
      .filter((product) => product.id)
      .map((product) => [product.id as string, product]),
  );
  const entries = await Promise.all(
    (quote.lines ?? []).map(async (line, index) => {
      const src = resolveLineImageSrc(line, productsById);
      if (!src) return null;
      const dataUrl = await fetchAsDataUrl(assetUrl(origin, src));
      if (!dataUrl) return null;
      return [lineImageKey(line, index), dataUrl] as const;
    }),
  );

  const result: Record<string, string> = {};
  for (const entry of entries) {
    if (entry) result[entry[0]] = entry[1];
  }
  return result;
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const mime =
      sniffImageMime(bytes) ??
      normalizeImageMime(response.headers.get("content-type"));
    if (!mime) return null;
    const typed = new Blob([buffer], { type: mime });
    return await blobToDataUrl(typed);
  } catch {
    return null;
  }
}

function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  return null;
}

function normalizeImageMime(header: string | null): string | null {
  const value = header?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (value === "image/jpeg" || value === "image/jpg") return "image/jpeg";
  if (value === "image/png") return "image/png";
  return null;
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = reader.result;
      resolve(typeof value === "string" ? value : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}
