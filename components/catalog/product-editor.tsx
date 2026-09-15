"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "@/lib/api/generated/endpoints/products/products";
import type {
  ProductPropertyRequest,
  ProductRequest,
  ProductResponse,
} from "@/lib/api/generated/model";
import { ProductPropertyRequestType } from "@/lib/api/generated/model";
import { apiErrorMessage, isSuccessStatus } from "@/lib/api/errors";
import { emptyProductDraft, productToRequest } from "@/lib/api/map";
import { LogoutButton } from "@/components/auth/logout-button";
import {
  ActionButton,
  Field,
  NumberInput,
  Select,
  TextArea,
  TextInput,
} from "@/components/catalog/fields";

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

  const selected = useMemo(
    () => products.find((item) => item.id === selectedId) ?? null,
    [products, selectedId],
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

  const patch = (next: Partial<ProductRequest>) => {
    setDraft((current) => ({ ...current, ...next }));
    setStatus("idle");
  };

  const patchProperty = (index: number, next: Partial<ProductPropertyRequest>) => {
    const properties = [...(draft.properties ?? [])];
    properties[index] = { ...properties[index], ...next };
    patch({ properties });
  };

  const save = async () => {
    if (!draft.code.trim() || !draft.name.trim()) {
      setError("Kod ve ad zorunludur.");
      setStatus("error");
      return;
    }
    setStatus("saving");
    setError(null);
    const payload: ProductRequest = {
      ...draft,
      properties: (draft.properties ?? []).filter((item) => item.name.trim()),
      accessories: (draft.accessories ?? []).filter((item) => item.name.trim()),
    };
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
    <div className="grid min-h-full flex-1 grid-rows-[auto_1fr]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] px-5 py-3">
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
            TeknoTip · Katalog
          </p>
          <h1 className="font-display text-2xl leading-none tracking-wide">Ürünler</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          <Link
            href="/musteriler"
            className="inline-flex h-9 items-center px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--steel)] hover:text-[var(--charcoal)]"
          >
            Müşteriler
          </Link>
          <Link
            href="/quotes"
            className="inline-flex h-9 items-center px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--steel)] hover:text-[var(--charcoal)]"
          >
            Teklifler
          </Link>
          <Link
            href="/teklif"
            className="inline-flex h-9 items-center px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--steel)] hover:text-[var(--charcoal)]"
          >
            Teklif
          </Link>
          <LogoutButton />
        </nav>
      </header>

      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[16rem_1fr]">
        <aside className="min-h-0 overflow-y-auto border-b border-[var(--rule)] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
              Liste
            </p>
            <ActionButton tone="heat" onClick={() => selectProduct(null)}>
              Yeni
            </ActionButton>
          </div>
          <ul className="grid">
            {products.map((product) => (
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
            ))}
          </ul>
        </aside>

        <section className="min-h-0 overflow-y-auto p-5">
          <div className="mx-auto grid max-w-3xl gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kod">
                <TextInput
                  value={draft.code}
                  onChange={(event) => patch({ code: event.target.value })}
                  required
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
                  value={draft.price}
                  onChange={(event) => patch({ price: Number(event.target.value) || 0 })}
                />
              </Field>
              <Field label="Kategori">
                <TextInput
                  value={draft.category ?? ""}
                  onChange={(event) => patch({ category: event.target.value })}
                />
              </Field>
              <Field label="Görsel URL">
                <TextInput
                  value={draft.image ?? ""}
                  onChange={(event) => patch({ image: event.target.value })}
                />
              </Field>
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
                          type: ProductPropertyRequestType.SINGLE_CHOICE,
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
                            type: event.target.value as ProductPropertyRequest["type"],
                          })
                        }
                      >
                        <option value={ProductPropertyRequestType.SINGLE_CHOICE}>
                          Tek seçim
                        </option>
                        <option value={ProductPropertyRequestType.MULTIPLE_CHOICE}>
                          Çoklu seçim
                        </option>
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
            <div className="flex flex-wrap gap-2">
              <ActionButton tone="heat" disabled={status === "saving"} onClick={() => void save()}>
                Kaydet
              </ActionButton>
              {selectedId && selectedId !== "new" ? (
                <ActionButton tone="danger" onClick={() => void remove()}>
                  Sil
                </ActionButton>
              ) : null}
            </div>
            {selected?.updatedAt ? (
              <p className="text-xs text-[var(--steel)]">
                Son güncelleme: {selected.updatedAt}
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
