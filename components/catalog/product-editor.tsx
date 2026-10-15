"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "@/lib/api/generated/endpoints/products/products";
import type { ProductRequest, ProductResponse } from "@/lib/api/generated/model";
import { apiErrorMessage, isSuccessStatus } from "@/lib/api/errors";
import { emptyProductDraft, productToRequest } from "@/lib/api/map";
import { matchesQuery, productSearchValues } from "@/lib/search/matches-query";
import { SplitWorkspace } from "@/components/layout/split-workspace";
import { ListSearchInput } from "@/components/layout/list-search-input";
import { RelatedQuotesPanel } from "@/components/quote/related-quotes-panel";
import {
  ProductForm,
  productDraftError,
  productPayload,
} from "@/components/catalog/product-form";
import { ActionButton } from "@/components/catalog/fields";

type Status = "idle" | "saving" | "saved" | "error";

export function ProductEditor({ initialProducts }: { initialProducts: ProductResponse[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(
    initialProducts[0]?.id ?? "new",
  );
  const [draft, setDraft] = useState<ProductRequest>(() =>
    initialProducts[0] ? productToRequest(initialProducts[0]) : emptyProductDraft(),
  );
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [imageSaving, setImageSaving] = useState(false);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => products.find((item) => item.id === selectedId) ?? null,
    [products, selectedId],
  );
  const filteredProducts = useMemo(
    () =>
      products.filter((item) => matchesQuery(productSearchValues(item), query)),
    [products, query],
  );

  const selectProduct = (product: ProductResponse | null) => {
    if (!product?.id) {
      setSelectedId("new");
      setDraft(emptyProductDraft());
      return;
    }
    setSelectedId(product.id);
    setDraft(productToRequest(product));
    setStatus("idle");
    setError(null);
  };

  useEffect(() => {
    if (selectedId === "new" || selectedId === null) return;
    if (filteredProducts.some((item) => item.id === selectedId)) return;
    if (filteredProducts[0]) selectProduct(filteredProducts[0]);
  }, [filteredProducts, selectedId]);

  const patch = (next: Partial<ProductRequest>) => {
    setDraft((current) => ({ ...current, ...next }));
    setStatus("idle");
  };

  const applyImage = async (image: string) => {
    patch({ image });
    if (!selectedId || selectedId === "new") return;
    const productId = selectedId;
    const current = products.find((item) => item.id === productId);
    if (!current) return;
    setProducts((list) =>
      list.map((item) => (item.id === productId ? { ...item, image } : item)),
    );
    setImageSaving(true);
    const response = await updateProduct(productId, {
      ...productToRequest(current),
      image,
    });
    setImageSaving(false);
    if (!isSuccessStatus(response.status)) {
      setProducts((list) =>
        list.map((item) =>
          item.id === productId ? { ...item, image: current.image ?? "" } : item,
        ),
      );
      if (selectedIdRef.current === productId) {
        setDraft((item) => ({ ...item, image: current.image ?? "" }));
        setError(apiErrorMessage(response.data));
        setStatus("error");
      }
      return;
    }
    const saved = response.data as ProductResponse;
    setProducts((list) =>
      list.map((item) =>
        item.id === saved.id ? { ...item, image: saved.image ?? "" } : item,
      ),
    );
  };

  const save = async () => {
    const problem = productDraftError(draft);
    if (problem) {
      setError(problem);
      setStatus("error");
      return;
    }
    setStatus("saving");
    setError(null);
    const payload: ProductRequest = productPayload(draft);
    const response =
      selectedId && selectedId !== "new"
        ? await updateProduct(selectedId, payload)
        : await createProduct(payload);
    if (!isSuccessStatus(response.status)) {
      setError(apiErrorMessage(response.data));
      setStatus("error");
      return;
    }
    const saved = response.data as ProductResponse;
    setProducts((current) => {
      const without = current.filter((item) => item.id !== saved.id);
      return [...without, saved].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", "tr"),
      );
    });
    if (saved.id) {
      setSelectedId(saved.id);
      setDraft(productToRequest(saved));
    }
    setStatus("saved");
  };

  const remove = async () => {
    if (!selectedId || selectedId === "new") return;
    if (!window.confirm("Bu ürünü silmek istiyor musunuz?")) return;
    const response = await deleteProduct(selectedId);
    if (!isSuccessStatus(response.status)) {
      setError(apiErrorMessage(response.data));
      setStatus("error");
      return;
    }
    const remaining = products.filter((item) => item.id !== selectedId);
    setProducts(remaining);
    selectProduct(remaining[0] ?? null);
  };

  return (
    <SplitWorkspace
      section="Katalog"
      title="Ürünler"
      listHeader={
        <div className="grid gap-2 border-b border-[var(--rule)] px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
              Liste
            </p>
            <ActionButton tone="heat" onClick={() => selectProduct(null)}>
              Yeni
            </ActionButton>
          </div>
          <ListSearchInput value={query} onChange={setQuery} />
        </div>
      }
      list={
        <ul>
          {filteredProducts.length === 0 ? (
            <li className="px-4 py-6 text-sm text-[var(--steel)]">
              Kayıt bulunamadı.
            </li>
          ) : (
            filteredProducts.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => selectProduct(product)}
                className={`flex w-full flex-col items-start gap-0.5 border-t border-[var(--rule)] px-4 py-3 text-left text-sm ${
                  selectedId === product.id
                    ? "bg-[var(--mist)] text-[var(--charcoal)]"
                    : "text-[var(--steel)] hover:text-[var(--charcoal)]"
                }`}
              >
                <span>{product.name}</span>
                <span className="font-mono text-xs">{product.code}</span>
              </button>
            </li>
            ))
          )}
        </ul>
      }
    >
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-2">
        <ProductForm
          draft={draft}
          onChange={patch}
          onImageChange={(image) => void applyImage(image)}
          imagePending={selectedId === "new"}
          error={error}
          saved={status === "saved"}
          saving={status === "saving" || imageSaving}
          onSave={() => void save()}
          onDelete={selectedId && selectedId !== "new" ? () => void remove() : undefined}
          updatedAt={selected?.updatedAt}
        />
        <RelatedQuotesPanel productId={selectedId !== "new" ? selected?.id : undefined} />
      </div>
    </SplitWorkspace>
  );
}
