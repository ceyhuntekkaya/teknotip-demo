const API_FILES = "/backend/v1/files/";

const STORED_IMAGE =
  /^(\d{4})\/(\d{2})\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.(jpg|png)$/;

/** application.yml içindeki storage.image-max-bytes ile aynı sınır. */
export const MAX_PRODUCT_IMAGE_BYTES = 15 * 1024 * 1024;

export function productImageSrc(image?: string | null): string | null {
  const trimmed = image?.trim() ?? "";
  if (!trimmed || trimmed.includes("placeholder")) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const relative = storedImagePath(trimmed);
  if (!relative) return null;
  return `${API_FILES}${relative}`;
}

export function isStoredProductImage(image?: string | null): boolean {
  return storedImagePath(image?.trim() ?? "") !== null;
}

function storedImagePath(value: string): string | null {
  const stripped = value
    .replace(/^\/backend\/v1\/files\//, "")
    .replace(/^\/v1\/files\//, "")
    .replace(/^\/+/, "");
  return STORED_IMAGE.test(stripped) ? stripped : null;
}
