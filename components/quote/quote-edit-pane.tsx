"use client";

import { useEffect, useState } from "react";
import type {
  CustomerResponse,
  ProductResponse,
  QuoteLineAccessoryResponse,
  QuoteLineResponse,
  QuoteResponse,
} from "@/lib/api/generated/model";
import {
  ActionButton,
  Field,
  NumberInput,
  Select,
  TextArea,
  TextInput,
} from "@/components/catalog/fields";
import { formatTry } from "@/lib/catalog/price";
import {
  addProductLine,
  applyCustomer,
  catalogForLine,
  removeLine,
  replaceLine,
} from "@/lib/quote/document-edit";

function PriceInput({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (price: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  const commit = () => {
    setFocused(false);
    const next = Number(text);
    if (!Number.isFinite(next) || next < 0) {
      setText(String(value));
      return;
    }
    if (next === value) return;
    onCommit(next);
  };

  return (
    <NumberInput
      min={0}
      step="0.01"
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
      }}
      className="h-9 w-28"
    />
  );
}

export function QuoteEditPane({
  quote,
  products,
  customers,
  onChange,
}: {
  quote: QuoteResponse;
  products: ProductResponse[];
  customers: CustomerResponse[];
  onChange: (next: QuoteResponse) => void;
}) {
  const quoted = quote.quotedTo ?? {};
  const lines = quote.lines ?? [];

  const patchQuoted = (patch: Partial<NonNullable<QuoteResponse["quotedTo"]>>) => {
    onChange({ ...quote, quotedTo: { ...quoted, ...patch } });
  };

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4">
      <section className="grid gap-3 sm:grid-cols-2">
        <Field label="Müşteri kaydı">
          <Select
            value={quoted.customerId ?? ""}
            onChange={(event) => {
              const id = event.target.value;
              const customer = customers.find((item) => item.id === id) ?? null;
              onChange(applyCustomer(quote, customer));
            }}
          >
            <option value="">Elle gir</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.institution}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kurum">
          <TextInput
            value={quoted.institution ?? ""}
            onChange={(event) => patchQuoted({ institution: event.target.value })}
          />
        </Field>
        <Field label="Yetkili">
          <TextInput
            value={quoted.contactPerson ?? ""}
            onChange={(event) => patchQuoted({ contactPerson: event.target.value })}
          />
        </Field>
        <Field label="Unvan">
          <TextInput
            value={quoted.title ?? ""}
            onChange={(event) => patchQuoted({ title: event.target.value })}
          />
        </Field>
        <Field label="Telefon">
          <TextInput
            value={quoted.phone ?? ""}
            onChange={(event) => patchQuoted({ phone: event.target.value })}
          />
        </Field>
        <Field label="E-posta">
          <TextInput
            value={quoted.email ?? ""}
            onChange={(event) => patchQuoted({ email: event.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Adres">
            <TextArea
              value={quoted.address ?? ""}
              onChange={(event) => patchQuoted({ address: event.target.value })}
            />
          </Field>
        </div>
        <Field label="İndirim">
          <NumberInput
            min={0}
            step="0.01"
            value={quote.priceSummary?.discount ?? 0}
            onChange={(event) =>
              onChange({
                ...quote,
                priceSummary: {
                  ...quote.priceSummary,
                  discount: Number(event.target.value) || 0,
                },
              })
            }
          />
        </Field>
        <Field label="KDV %">
          <NumberInput
            min={0}
            step="0.01"
            value={quote.priceSummary?.taxRatePercent ?? 20}
            onChange={(event) =>
              onChange({
                ...quote,
                priceSummary: {
                  ...quote.priceSummary,
                  taxRatePercent: Number(event.target.value) || 0,
                },
              })
            }
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Ek bilgi">
            <TextArea
              value={quote.additionalInformation ?? ""}
              onChange={(event) =>
                onChange({ ...quote, additionalInformation: event.target.value })
              }
            />
          </Field>
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="font-display text-lg tracking-wide">Satırlar</h3>
          <Field label="Katalogdan ekle">
            <Select
              value=""
              onChange={(event) => {
                const product = products.find((item) => item.id === event.target.value);
                if (product) onChange(addProductLine(quote, product));
              }}
            >
              <option value="">Ürün seç</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.code} · {product.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-[var(--steel)]">Henüz satır yok.</p>
        ) : (
          lines.map((line, index) => (
            <LineEditor
              key={line.id ?? `line-${index}`}
              line={line}
              product={catalogForLine(products, line)}
              onChange={(next) => onChange(replaceLine(quote, index, next))}
              onRemove={() => onChange(removeLine(quote, index))}
            />
          ))
        )}
      </section>
    </div>
  );
}

function LineEditor({
  line,
  product,
  onChange,
  onRemove,
}: {
  line: QuoteLineResponse;
  product?: ProductResponse;
  onChange: (line: QuoteLineResponse) => void;
  onRemove: () => void;
}) {
  const properties = line.properties ?? [];
  const accessories = line.accessories ?? [];

  return (
    <article className="grid gap-3 border border-[var(--rule)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-display text-lg uppercase tracking-[0.08em]">
            {line.name}
          </h4>
          <p className="font-mono text-xs text-[var(--steel)]">{line.code}</p>
        </div>
        <ActionButton tone="danger" onClick={onRemove}>
          Satırı sil
        </ActionButton>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Adet">
          <NumberInput
            min={1}
            value={line.quantity ?? 1}
            onChange={(event) =>
              onChange({ ...line, quantity: Math.max(1, Number(event.target.value) || 1) })
            }
          />
        </Field>
        <Field label="Birim fiyat">
          <PriceInput
            value={line.price ?? line.basePrice ?? 0}
            onCommit={(price) => onChange({ ...line, price, lineTotal: undefined })}
          />
        </Field>
        <p className="self-end font-mono text-sm text-[var(--heat)]">
          {formatTry(line.lineTotal ?? 0)}
        </p>
      </div>

      {properties.map((property, propertyIndex) => {
        const catalogProperty = product?.properties?.find(
          (item) => item.id === property.productPropertyId,
        );
        const options = catalogProperty?.values ?? [];
        return (
          <div key={property.id ?? `prop-${propertyIndex}`} className="grid gap-2 sm:grid-cols-[1fr_8rem]">
            <Field label={property.name ?? "Özellik"}>
              {options.length ? (
                <Select
                  value={property.values ?? ""}
                  onChange={(event) => {
                    const next = [...properties];
                    next[propertyIndex] = { ...property, values: event.target.value };
                    onChange({ ...line, properties: next, lineTotal: undefined });
                  }}
                >
                  <option value="">Seçilmedi</option>
                  {options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              ) : (
                <TextInput
                  value={property.values ?? ""}
                  onChange={(event) => {
                    const next = [...properties];
                    next[propertyIndex] = { ...property, values: event.target.value };
                    onChange({ ...line, properties: next, lineTotal: undefined });
                  }}
                />
              )}
            </Field>
            <Field label="Fiyat">
              <PriceInput
                value={property.price ?? 0}
                onCommit={(price) => {
                  const next = [...properties];
                  next[propertyIndex] = { ...property, price };
                  onChange({ ...line, properties: next, lineTotal: undefined });
                }}
              />
            </Field>
          </div>
        );
      })}

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <p className="font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
            Aksesuarlar
          </p>
          {product?.accessories?.length ? (
            <Select
              value=""
              onChange={(event) => {
                const accessory = product.accessories?.find(
                  (item) => item.id === event.target.value,
                );
                if (!accessory) return;
                const next: QuoteLineAccessoryResponse[] = [
                  ...accessories,
                  {
                    productAccessoryId: accessory.id,
                    name: accessory.name,
                    quantity: 1,
                    price: 0,
                  },
                ];
                onChange({ ...line, accessories: next, lineTotal: undefined });
              }}
            >
              <option value="">Aksesuar ekle</option>
              {product.accessories.map((accessory) => (
                <option key={accessory.id} value={accessory.id}>
                  {accessory.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
        {accessories.map((accessory, accessoryIndex) => (
          <div key={accessory.id ?? `acc-${accessoryIndex}`} className="flex flex-wrap items-end gap-2">
            <span className="flex-1 text-sm">{accessory.name}</span>
            <NumberInput
              min={1}
              value={accessory.quantity ?? 1}
              className="h-9 w-20"
              onChange={(event) => {
                const next = [...accessories];
                next[accessoryIndex] = {
                  ...accessory,
                  quantity: Math.max(1, Number(event.target.value) || 1),
                };
                onChange({ ...line, accessories: next, lineTotal: undefined });
              }}
            />
            <PriceInput
              value={accessory.price ?? 0}
              onCommit={(price) => {
                const next = [...accessories];
                next[accessoryIndex] = { ...accessory, price };
                onChange({ ...line, accessories: next, lineTotal: undefined });
              }}
            />
            <ActionButton
              tone="danger"
              onClick={() =>
                onChange({
                  ...line,
                  accessories: accessories.filter((_, i) => i !== accessoryIndex),
                  lineTotal: undefined,
                })
              }
            >
              Sil
            </ActionButton>
          </div>
        ))}
      </div>
    </article>
  );
}
