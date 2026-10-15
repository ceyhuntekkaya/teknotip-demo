"use client";

import {
  ActionButton,
  Field,
  NumberInput,
  Select,
  TextArea,
  TextInput,
} from "@/components/catalog/fields";
import { ProductImageField } from "@/components/catalog/product-image-field";
import type { ProductPropertyRequest, ProductRequest } from "@/lib/api/generated/model";
import { ProductPropertyRequestType } from "@/lib/api/generated/model";

export function productDraftError(draft: ProductRequest): string | null {
  if (!draft.code.trim() || !draft.name.trim()) return "Kod ve ad zorunludur.";
  if ((draft.properties ?? []).some((item) => !item.name.trim())) {
    return "Özellik adı boş olamaz.";
  }
  return null;
}

export function productPayload(draft: ProductRequest): ProductRequest {
  return {
    ...draft,
    accessories: (draft.accessories ?? []).filter((item) => item.name.trim()),
  };
}

export function ProductForm({
  draft,
  onChange,
  onImageChange,
  imagePending = false,
  error,
  saved = false,
  saving = false,
  onSave,
  onDelete,
  updatedAt,
}: {
  draft: ProductRequest;
  onChange: (next: Partial<ProductRequest>) => void;
  onImageChange: (image: string) => void;
  imagePending?: boolean;
  error?: string | null;
  saved?: boolean;
  saving?: boolean;
  onSave: () => void;
  onDelete?: () => void;
  updatedAt?: string;
}) {
  const patchProperty = (index: number, next: Partial<ProductPropertyRequest>) => {
    const properties = [...(draft.properties ?? [])];
    properties[index] = { ...properties[index], ...next };
    onChange({ properties });
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kod">
          <TextInput
            value={draft.code}
            onChange={(event) => onChange({ code: event.target.value })}
            required
          />
        </Field>
        <Field label="Ad">
          <TextInput
            value={draft.name}
            onChange={(event) => onChange({ name: event.target.value })}
            required
          />
        </Field>
        <Field label="Fiyat">
          <NumberInput
            min={0}
            step="0.01"
            value={draft.price}
            onChange={(event) => onChange({ price: Number(event.target.value) || 0 })}
          />
        </Field>
        <Field label="Kategori">
          <TextInput
            value={draft.category ?? ""}
            onChange={(event) => onChange({ category: event.target.value })}
          />
        </Field>
        <ProductImageField
          image={draft.image}
          pendingProduct={imagePending}
          onChange={onImageChange}
        />
      </div>
      <Field label="Açıklama">
        <TextArea
          value={draft.description ?? ""}
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </Field>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg tracking-wide">Özellikler</h2>
          <ActionButton
            onClick={() =>
              onChange({
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
          <article key={`property-${index}`} className="grid gap-3 border border-[var(--rule)] p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
              <Field label="Ad">
                <TextInput
                  value={property.name}
                  onChange={(event) => patchProperty(index, { name: event.target.value })}
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
                  <option value={ProductPropertyRequestType.SINGLE_CHOICE}>Tek seçim</option>
                  <option value={ProductPropertyRequestType.MULTIPLE_CHOICE}>Çoklu seçim</option>
                </Select>
              </Field>
              <div className="flex items-end">
                <ActionButton
                  tone="danger"
                  onClick={() =>
                    onChange({
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
                  patchProperty(index, { values: event.target.value.split("\n") })
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
              onChange({
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
                onChange({ accessories });
              }}
            />
            <ActionButton
              tone="danger"
              onClick={() =>
                onChange({
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
      {saved ? <p className="text-sm text-[var(--steel)]">Kaydedildi.</p> : null}
      <div className="flex flex-wrap gap-2">
        <ActionButton tone="heat" disabled={saving} onClick={onSave}>
          Kaydet
        </ActionButton>
        {onDelete ? (
          <ActionButton tone="danger" onClick={onDelete}>
            Sil
          </ActionButton>
        ) : null}
      </div>
      {updatedAt ? (
        <p className="text-xs text-[var(--steel)]">Son güncelleme: {updatedAt}</p>
      ) : null}
    </div>
  );
}
