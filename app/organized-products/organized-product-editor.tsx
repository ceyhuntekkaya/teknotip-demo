"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createOrganizedProduct,
  deleteOrganizedProduct,
  transferOrganizedProduct,
  updateOrganizedProduct,
  type OrganizedProductPropertyRequest,
  type OrganizedProductRequest,
  type OrganizedProductResponse,
} from "@/lib/api/organized-products";
import {
  emptyOrganizedProductDraft,
  organizedProductToRequest,
} from "@/lib/api/organized-map";
import { apiErrorMessage, isSuccessStatus } from "@/lib/api/errors";
import {
  matchesQuery,
  organizedProductSearchValues,
} from "@/lib/search/matches-query";
import { SplitWorkspace } from "@/components/layout/split-workspace";
import { ListSearchInput } from "@/components/layout/list-search-input";
import { ProductImageField } from "@/components/catalog/product-image-field";
import {
  ActionButton,
  Field,
  NumberInput,
  Select,
  TextArea,
  TextInput,
} from "@/components/catalog/fields";

type Status = "idle" | "saving" | "saved" | "transferring" | "transferred" | "error";

export function OrganizedProductEditor({
  initialProducts,
  embedded = false,
}: {
  initialProducts: OrganizedProductResponse[];
  embedded?: boolean;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(
    initialProducts[0]?.id ?? "new",
  );
  const [draft, setDraft] = useState<OrganizedProductRequest>(() =>
    initialProducts[0]
      ? organizedProductToRequest(initialProducts[0])
      : emptyOrganizedProductDraft(),
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
      products.filter((item) =>
        matchesQuery(organizedProductSearchValues(item), query),
      ),
    [products, query],
  );
  const transferred = Boolean(selected?.transferred);

  const selectProduct = (product: OrganizedProductResponse | null) => {
    if (!product?.id) {
      setSelectedId("new");
      setDraft(emptyOrganizedProductDraft());
      setStatus("idle");
      setError(null);
      return;
    }
    setSelectedId(product.id);
    setDraft(organizedProductToRequest(product));
    setStatus("idle");
    setError(null);
  };

  useEffect(() => {
    if (selectedId === "new" || selectedId === null) return;
    if (filteredProducts.some((item) => item.id === selectedId)) return;
    if (filteredProducts[0]) selectProduct(filteredProducts[0]);
  }, [filteredProducts, selectedId]);

  const patch = (next: Partial<OrganizedProductRequest>) => {
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
    const response = await updateOrganizedProduct(productId, {
      ...organizedProductToRequest(current),
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
    const saved = response.data as OrganizedProductResponse;
    setProducts((list) =>
      list.map((item) =>
        item.id === saved.id ? { ...item, image: saved.image ?? "" } : item,
      ),
    );
  };

  const patchProperty = (
    index: number,
    next: Partial<OrganizedProductPropertyRequest>,
  ) => {
    const properties = [...(draft.properties ?? [])];
    properties[index] = { ...properties[index], ...next };
    patch({ properties });
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setError("Ad zorunludur.");
      setStatus("error");
      return;
    }
    setStatus("saving");
    setError(null);
    const payload: OrganizedProductRequest = {
      ...draft,
      code: draft.code?.trim() || undefined,
      properties: (draft.properties ?? []).filter((item) => item.name.trim()),
      accessories: (draft.accessories ?? []).filter((item) => item.name.trim()),
    };
    const response =
      selectedId && selectedId !== "new"
        ? await updateOrganizedProduct(selectedId, payload)
        : await createOrganizedProduct(payload);
    if (!isSuccessStatus(response.status)) {
      setError(apiErrorMessage(response.data));
      setStatus("error");
      return;
    }
    const saved = response.data as OrganizedProductResponse;
    setProducts((current) => {
      const without = current.filter((item) => item.id !== saved.id);
      return [...without, saved].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", "tr"),
      );
    });
    if (saved.id) {
      setSelectedId(saved.id);
      setDraft(organizedProductToRequest(saved));
    }
    setStatus("saved");
  };

  const remove = async () => {
    if (!selectedId || selectedId === "new") return;
    if (!window.confirm("Bu geçici ürünü silmek istiyor musunuz?")) return;
    const response = await deleteOrganizedProduct(selectedId);
    if (!isSuccessStatus(response.status)) {
      setError(apiErrorMessage(response.data));
      setStatus("error");
      return;
    }
    const remaining = products.filter((item) => item.id !== selectedId);
    setProducts(remaining);
    selectProduct(remaining[0] ?? null);
  };

  const transfer = async () => {
    if (!selectedId || selectedId === "new" || transferred) return;
    if (!draft.code?.trim() || !draft.name.trim()) {
      setError("Aktarım için kod ve ad zorunludur. Önce kaydedin.");
      setStatus("error");
      return;
    }
    if (!window.confirm("Bu geçici ürün asıl kataloga aktarılsın mı?")) return;
    setStatus("transferring");
    setError(null);

    const payload: OrganizedProductRequest = {
      ...draft,
      code: draft.code?.trim() || undefined,
      properties: (draft.properties ?? []).filter((item) => item.name.trim()),
      accessories: (draft.accessories ?? []).filter((item) => item.name.trim()),
    };
    const saveResponse = await updateOrganizedProduct(selectedId, payload);
    if (!isSuccessStatus(saveResponse.status)) {
      setError(apiErrorMessage(saveResponse.data));
      setStatus("error");
      return;
    }

    const response = await transferOrganizedProduct(selectedId);
    if (!isSuccessStatus(response.status)) {
      setError(apiErrorMessage(response.data));
      setStatus("error");
      return;
    }
    const saved = response.data as OrganizedProductResponse;
    setProducts((current) =>
      current.map((item) => (item.id === saved.id ? saved : item)),
    );
    setDraft(organizedProductToRequest(saved));
    setStatus("transferred");
  };

  return (
    <SplitWorkspace
      showHeader={!embedded}
      section="Geçici"
      title="Geçici Ürünler"
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
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {product.transferred ? <TransferredMark /> : null}
                    <span className="truncate">{product.name}</span>
                  </span>
                  {product.transferred ? (
                    <span className="shrink-0 font-display text-[10px] uppercase tracking-[0.14em] text-[var(--heat)]">
                      Aktarıldı
                    </span>
                  ) : null}
                </span>
                <span className="font-mono text-xs">{product.code || "—"}</span>
              </button>
            </li>
            ))
          )}
        </ul>
      }
    >
      <div className="mx-auto grid max-w-3xl gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kod">
            <TextInput
              value={draft.code ?? ""}
              onChange={(event) => patch({ code: event.target.value })}
            />
          </Field>
          <Field label="Ad">
            <TextInput
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
              required
            />
          </Field>
          <Field label="Fiyat">
            <NumberInput
              min={0}
              step="0.01"
              value={draft.price ?? 0}
              onChange={(event) =>
                patch({ price: Number(event.target.value) || 0 })
              }
            />
          </Field>
          <Field label="Kategori">
            <TextInput
              value={draft.category ?? ""}
              onChange={(event) => patch({ category: event.target.value })}
            />
          </Field>
          <ProductImageField
            image={draft.image}
            pendingProduct={selectedId === "new"}
            onChange={(image) => void applyImage(image)}
          />
        </div>
        <Field label="Açıklama">
          <TextArea
            value={draft.description ?? ""}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </Field>

        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg tracking-wide">Özellikler</h2>
            <ActionButton
              onClick={() =>
                patch({
                  properties: [
                    ...(draft.properties ?? []),
                    {
                      name: "",
                      type: "SINGLE_CHOICE",
                      values: [""],
                    },
                  ],
                })
              }
            >
              Özellik ekle
            </ActionButton>
          </div>
          {(draft.properties ?? []).map((property, index) => (
            <article
              key={`property-${index}`}
              className="grid gap-3 border border-[var(--rule)] p-4"
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
                <Field label="Ad">
                  <TextInput
                    value={property.name}
                    onChange={(event) =>
                      patchProperty(index, { name: event.target.value })
                    }
                  />
                </Field>
                <Field label="Tip">
                  <Select
                    value={property.type}
                    onChange={(event) =>
                      patchProperty(index, {
                        type: event.target
                          .value as OrganizedProductPropertyRequest["type"],
                      })
                    }
                  >
                    <option value="SINGLE_CHOICE">Tek seçim</option>
                    <option value="MULTIPLE_CHOICE">Çoklu seçim</option>
                  </Select>
                </Field>
                <div className="flex items-end">
                  <ActionButton
                    tone="danger"
                    onClick={() =>
                      patch({
                        properties: (draft.properties ?? []).filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      })
                    }
                  >
                    Sil
                  </ActionButton>
                </div>
              </div>
              <Field label="Değerler (satır satır)">
                <TextArea
                  value={(property.values ?? []).join("\n")}
                  onChange={(event) =>
                    patchProperty(index, {
                      values: event.target.value.split("\n"),
                    })
                  }
                />
              </Field>
            </article>
          ))}
        </div>

        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg tracking-wide">Aksesuarlar</h2>
            <ActionButton
              onClick={() =>
                patch({
                  accessories: [...(draft.accessories ?? []), { name: "" }],
                })
              }
            >
              Aksesuar ekle
            </ActionButton>
          </div>
          {(draft.accessories ?? []).map((accessory, index) => (
            <div key={`acc-${index}`} className="flex gap-3">
              <TextInput
                value={accessory.name}
                placeholder="Aksesuar adı"
                onChange={(event) => {
                  const accessories = [...(draft.accessories ?? [])];
                  accessories[index] = { name: event.target.value };
                  patch({ accessories });
                }}
              />
              <ActionButton
                tone="danger"
                onClick={() =>
                  patch({
                    accessories: (draft.accessories ?? []).filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })
                }
              >
                Sil
              </ActionButton>
            </div>
          ))}
        </div>

        {error ? <p className="text-sm text-[#8f2d1f]">{error}</p> : null}
        {status === "saved" ? (
          <p className="text-sm text-[var(--steel)]">Kaydedildi.</p>
        ) : null}
        {status === "transferred" || transferred ? (
          <p className="text-sm text-[var(--steel)]">
            Aktarıldı
            {selected?.productId
              ? ` · ürün id: ${selected.productId}`
              : null}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <ActionButton
            tone="heat"
            disabled={status === "saving" || status === "transferring" || imageSaving}
            onClick={() => void save()}
          >
            Kaydet
          </ActionButton>
          {selectedId && selectedId !== "new" ? (
            <>
              <ActionButton
                tone="heat"
                disabled={
                  transferred ||
                  status === "saving" ||
                  status === "transferring" ||
                  imageSaving
                }
                onClick={() => void transfer()}
              >
                Aktar
              </ActionButton>
              <ActionButton tone="danger" onClick={() => void remove()}>
                Sil
              </ActionButton>
            </>
          ) : null}
        </div>
        {selected?.updatedAt ? (
          <p className="text-xs text-[var(--steel)]">
            Son güncelleme: {selected.updatedAt}
          </p>
        ) : null}
      </div>
    </SplitWorkspace>
  );
}

function TransferredMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-[var(--heat)]"
      aria-label="Aktarıldı"
      role="img"
    >
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path
        d="M4.6 8.2 6.8 10.4 11.4 5.6"
        fill="none"
        stroke="var(--paper)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
