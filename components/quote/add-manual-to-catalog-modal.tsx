"use client";

import { useState } from "react";
import {
  ActionButton,
  Field,
  NumberInput,
  Select,
  TextArea,
  TextInput,
} from "@/components/catalog/fields";
import { parseProductFromText } from "@/lib/api/catalog-addons";
import { createProduct } from "@/lib/api/generated/endpoints/products/products";
import type {
  ProductPropertyRequest,
  ProductRequest,
  ProductResponse,
  QuoteLineResponse,
} from "@/lib/api/generated/model";
import { ProductPropertyRequestType } from "@/lib/api/generated/model";
import {
  apiErrorMessage,
  apiFieldErrorMap,
  fieldError,
  isSuccessStatus,
} from "@/lib/api/errors";
import { emptyProductDraft } from "@/lib/api/map";

function moneyOrUndefined(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value * 100) / 100;
}

export function AddManualToCatalogModal({
  line,
  onClose,
  onSaved,
}: {
  line: QuoteLineResponse;
  onClose: () => void;
  onSaved: (product: ProductResponse) => void;
}) {
  const [draft, setDraft] = useState<ProductRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearField = (...keys: string[]) => {
    setFieldErrors((current) => {
      const next = { ...current };
      for (const key of keys) delete next[key];
      return next;
    });
  };

  const patch = (next: Partial<ProductRequest>) => {
    setDraft((current) => (current ? { ...current, ...next } : current));
    clearField(...Object.keys(next));
    setError(null);
  };

  const applyApiFailure = (data: unknown, fallback: string) => {
    setFieldErrors(apiFieldErrorMap(data));
    setError(apiErrorMessage(data, fallback));
  };

  const startParse = async () => {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const code = line.code?.trim();
      const price = moneyOrUndefined(line.price ?? line.basePrice);
      const response = await parseProductFromText({
        text: line.name ?? "",
        ...(code ? { code } : {}),
        ...(price != null ? { price } : {}),
      });
      if (!isSuccessStatus(response.status)) {
        applyApiFailure(response.data, "Metin ayrıştırılamadı.");
        return;
      }
      const parsed = response.data as ProductRequest;
      setDraft({
        ...emptyProductDraft(),
        ...parsed,
        code: (parsed.code ?? line.code ?? "").trim(),
        price: moneyOrUndefined(parsed.price ?? line.price ?? line.basePrice) ?? 0,
        properties: parsed.properties ?? [],
        accessories: parsed.accessories ?? [],
      });
    } catch {
      setError("Ayrıştırma servisine bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    const local: Record<string, string> = {};
    if (!draft.code?.trim()) local.code = "Ürün kodu zorunludur.";
    if (!draft.name?.trim()) local.name = "Ürün adı zorunludur.";
    if (Object.keys(local).length > 0) {
      setFieldErrors(local);
      setError("Lütfen işaretli alanları düzeltin.");
      return;
    }
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const response = await createProduct({
        ...draft,
        code: draft.code.trim(),
        name: draft.name.trim(),
        price: moneyOrUndefined(draft.price) ?? 0,
      });
      if (!isSuccessStatus(response.status)) {
        applyApiFailure(response.data, "Ürün kaydedilemedi.");
        return;
      }
      onSaved(response.data as ProductResponse);
    } catch {
      setError("Ürün kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const codeError = fieldError(fieldErrors, "code");
  const nameError = fieldError(fieldErrors, "name");
  const priceError = fieldError(fieldErrors, "price");
  const textError = fieldError(fieldErrors, "text");
  const categoryError = fieldError(fieldErrors, "category");
  const descriptionError = fieldError(fieldErrors, "description");
  const propertiesError = fieldError(fieldErrors, "properties");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto border border-[var(--rule)] bg-[var(--paper)] p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
              Katalog
            </p>
            <h3 className="font-display text-2xl tracking-wide">Kataloga ekle</h3>
          </div>
          <ActionButton onClick={onClose}>Kapat</ActionButton>
        </div>

        {!draft ? (
          <div className="grid gap-4">
            <p className="text-sm text-[var(--steel)]">
              Elle girilen metin katalog formatına ayrıştırılacak. Sonuçta
              düzenleme yapabilir, kaydetmeyebilirsiniz.
            </p>
            <Field label="Ayrıştırılacak metin" error={textError}>
              <pre className="whitespace-pre-wrap border border-[var(--rule)] bg-[var(--paper)] p-3 text-sm">
                {line.name}
              </pre>
            </Field>
            {error ? (
              <p className="rounded-sm bg-[#fdf2f0] px-3 py-2 text-sm text-[#8f2d1f] ring-1 ring-[#8f2d1f]/40">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <ActionButton tone="heat" disabled={loading} onClick={() => void startParse()}>
                {loading ? "Ayrıştırılıyor…" : "Ayrıştır"}
              </ActionButton>
              <ActionButton onClick={onClose}>Vazgeç</ActionButton>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kod" error={codeError}>
                <TextInput
                  value={draft.code}
                  onChange={(event) => patch({ code: event.target.value })}
                  required
                  aria-invalid={Boolean(codeError)}
                />
              </Field>
              <Field label="Ad" error={nameError}>
                <TextInput
                  value={draft.name}
                  onChange={(event) => patch({ name: event.target.value })}
                  required
                  aria-invalid={Boolean(nameError)}
                />
              </Field>
              <Field label="Fiyat" error={priceError}>
                <NumberInput
                  min={0}
                  step="0.01"
                  value={draft.price}
                  onChange={(event) => patch({ price: Number(event.target.value) || 0 })}
                  aria-invalid={Boolean(priceError)}
                />
              </Field>
              <Field label="Kategori" error={categoryError}>
                <TextInput
                  value={draft.category ?? ""}
                  onChange={(event) => patch({ category: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Açıklama" error={descriptionError}>
              <TextArea
                value={draft.description ?? ""}
                onChange={(event) => patch({ description: event.target.value })}
              />
            </Field>

            <div
              className={`grid gap-3 ${
                propertiesError
                  ? "rounded-sm bg-[#fdf2f0] p-3 ring-1 ring-[#8f2d1f]/55"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <h4
                  className={`font-display text-lg tracking-wide ${
                    propertiesError ? "text-[#8f2d1f]" : ""
                  }`}
                >
                  Özellikler
                </h4>
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
              {propertiesError ? (
                <p className="text-xs text-[#8f2d1f]">{propertiesError}</p>
              ) : null}
              {(draft.properties ?? []).map((property, index) => (
                <article key={`p-${index}`} className="grid gap-3 border border-[var(--rule)] p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
                    <Field
                      label="Ad"
                      error={fieldError(
                        fieldErrors,
                        `properties[${index}].name`,
                        "properties.name",
                      )}
                    >
                      <TextInput
                        value={property.name}
                        onChange={(event) => {
                          const properties = [...(draft.properties ?? [])];
                          properties[index] = { ...property, name: event.target.value };
                          patch({ properties });
                          clearField(`properties[${index}].name`, "properties");
                        }}
                      />
                    </Field>
                    <Field label="Tip">
                      <Select
                        value={property.type}
                        onChange={(event) => {
                          const properties = [...(draft.properties ?? [])];
                          properties[index] = {
                            ...property,
                            type: event.target.value as ProductPropertyRequest["type"],
                          };
                          patch({ properties });
                        }}
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
                  <Field
                    label="Değerler (satır satır)"
                    error={fieldError(
                      fieldErrors,
                      `properties[${index}].values`,
                      "properties.values",
                    )}
                  >
                    <TextArea
                      value={(property.values ?? []).join("\n")}
                      onChange={(event) => {
                        const properties = [...(draft.properties ?? [])];
                        properties[index] = {
                          ...property,
                          values: event.target.value.split("\n"),
                        };
                        patch({ properties });
                        clearField(`properties[${index}].values`, "properties");
                      }}
                    />
                  </Field>
                </article>
              ))}
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <h4 className="font-display text-lg tracking-wide">Aksesuarlar</h4>
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
                <div key={`a-${index}`} className="flex gap-2">
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

            {error ? (
              <p className="rounded-sm bg-[#fdf2f0] px-3 py-2 text-sm text-[#8f2d1f] ring-1 ring-[#8f2d1f]/40">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <ActionButton tone="heat" disabled={saving} onClick={() => void save()}>
                {saving ? "Kaydediliyor…" : "Kataloga kaydet"}
              </ActionButton>
              <ActionButton onClick={onClose}>Vazgeç</ActionButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
