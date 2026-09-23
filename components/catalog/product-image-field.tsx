"use client";

import { useRef, useState } from "react";
import { uploadProductImage } from "@/lib/api/files";
import {
  isStoredProductImage,
  MAX_PRODUCT_IMAGE_BYTES,
  productImageSrc,
} from "@/lib/files/product-image";
import { ActionButton } from "@/components/catalog/fields";

const MAX_LABEL = `${Math.round(MAX_PRODUCT_IMAGE_BYTES / (1024 * 1024))} MB`;

export function ProductImageField({
  image,
  onChange,
  disabled = false,
  pendingProduct = false,
}: {
  image?: string | null;
  onChange: (image: string) => void;
  disabled?: boolean;
  pendingProduct?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = productImageSrc(image);
  const external = Boolean(image?.trim()) && !isStoredProductImage(image);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.type && file.type !== "image/jpeg" && file.type !== "image/png") {
      setError("Yalnızca JPEG veya PNG yüklenebilir.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      setError(`Görsel en fazla ${MAX_LABEL} olabilir.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const id = ++requestId.current;
    setUploading(true);
    setError(null);
    try {
      const path = await uploadProductImage(file);
      if (requestId.current !== id) return;
      onChange(path);
    } catch (caught) {
      if (requestId.current !== id) return;
      setError(caught instanceof Error ? caught.message : "Görsel yüklenemedi.");
    } finally {
      if (requestId.current === id) setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="grid gap-1.5 sm:col-span-2">
      <span className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
        Görsel
      </span>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid h-28 w-36 place-items-center overflow-hidden border border-[var(--rule)] bg-[var(--mist)]">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="Ürün görseli" className="h-full w-full object-contain" />
          ) : (
            <span className="px-2 text-center text-xs text-[var(--steel)]">Görsel yok</span>
          )}
        </div>
        <div className="grid gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            disabled={disabled || uploading}
            onChange={(event) => void upload(event.target.files?.[0])}
            className="sr-only"
          />
          <ActionButton
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Yükleniyor" : "Dosya seç"}
          </ActionButton>
          {image?.trim() ? (
            <ActionButton
              tone="danger"
              disabled={disabled || uploading}
              onClick={() => {
                setError(null);
                onChange("");
              }}
            >
              Kaldır
            </ActionButton>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-[var(--steel)]">
        {uploading
          ? "Yükleniyor…"
          : pendingProduct
            ? `JPEG veya PNG, en fazla ${MAX_LABEL}. Görsel, ürün ilk kayıtta saklanır.`
            : `JPEG veya PNG, en fazla ${MAX_LABEL}.`}
      </p>
      {external ? (
        <p className="text-xs text-[var(--steel)]">
          Kayıtlı görsel harici bir adres. Yeni dosya yüklendiğinde onun yerini alır.
        </p>
      ) : null}
      {error ? <p className="text-sm text-[#8f2d1f]">{error}</p> : null}
    </div>
  );
}
