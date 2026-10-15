"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/catalog/fields";
import {
  ProductForm,
  productDraftError,
  productPayload,
} from "@/components/catalog/product-form";
import {
  getProductById,
  updateProduct,
} from "@/lib/api/generated/endpoints/products/products";
import type { ProductRequest, ProductResponse } from "@/lib/api/generated/model";
import { apiErrorMessage, isSuccessStatus } from "@/lib/api/errors";
import { productToRequest } from "@/lib/api/map";

export function ProductUpdateModal({
  productId,
  onClose,
  onSaved,
}: {
  productId: string;
  onClose: () => void;
  onSaved: (product: ProductResponse) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProductRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await getProductById(productId);
      if (cancelled) return;
      if (response.status !== 200) {
        setError(apiErrorMessage(response.data, "Ürün yüklenemedi."));
        setLoading(false);
        return;
      }
      setDraft(productToRequest(response.data));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const save = async () => {
    if (!draft) return;
    const problem = productDraftError(draft);
    if (problem) {
      setError(problem);
      setSaved(false);
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    const response = await updateProduct(productId, productPayload(draft));
    setSaving(false);
    if (!isSuccessStatus(response.status)) {
      setError(apiErrorMessage(response.data, "Ürün güncellenemedi."));
      return;
    }
    const product = response.data as ProductResponse;
    setDraft(productToRequest(product));
    setSaved(true);
    router.refresh();
    onSaved(product);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto border border-[var(--rule)] bg-[var(--paper)] p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
              Katalog
            </p>
            <h3 className="font-display text-2xl tracking-wide">Ürünü güncelle</h3>
          </div>
          <ActionButton onClick={onClose}>Kapat</ActionButton>
        </div>
        {loading || !draft ? (
          <p className="text-sm text-[var(--steel)]">
            {error ?? "Ürün yükleniyor…"}
          </p>
        ) : (
          <ProductForm
            draft={draft}
            onChange={(next) => {
              setDraft((current) => (current ? { ...current, ...next } : current));
              setSaved(false);
              setError(null);
            }}
            onImageChange={(image) => {
              setDraft((current) => (current ? { ...current, image } : current));
              setSaved(false);
            }}
            error={error}
            saved={saved}
            saving={saving}
            onSave={() => void save()}
          />
        )}
      </div>
    </div>
  );
}
