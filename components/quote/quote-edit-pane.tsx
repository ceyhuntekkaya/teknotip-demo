"use client";

import { useEffect, useState } from "react";
import type {
  CustomerResponse,
  InstitutionResponse,
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
import { formatQuoteAmount } from "@/lib/money";
import { customerLabel } from "@/lib/customer/display";
import {
  addFreeLine,
  addProductLine,
  applyCustomer,
  applyInstitution,
  catalogForLine,
  customerLinkState,
  isManualLine,
  moveLine,
  nextFreeCode,
  patchQuotedTo,
  removeLine,
  replaceLine,
} from "@/lib/quote/document-edit";

const LINK_BADGE = {
  contact: { label: "Kayıtlı müşteriye bağlı", tone: "bg-emerald-50 text-emerald-700" },
  institution: { label: "Kurum bağlı, kişi kayıtsız", tone: "bg-amber-50 text-amber-700" },
  none: { label: "Kayıt dışı", tone: "bg-neutral-100 text-neutral-600" },
} as const;

function CustomerLinkBadge({ quote }: { quote: QuoteResponse }) {
  const badge = LINK_BADGE[customerLinkState(quote)];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.tone}`}
      title="Teklifin müşteri raporlarında bulunabilmesi bu bağlantıya göredir."
    >
      {badge.label}
    </span>
  );
}

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
  institutions,
  onChange,
  onAddManualToCatalog,
  onSaveInstitution,
  onSaveContact,
}: {
  quote: QuoteResponse;
  products: ProductResponse[];
  customers: CustomerResponse[];
  institutions: InstitutionResponse[];
  onChange: (next: QuoteResponse) => void;
  onAddManualToCatalog?: (line: QuoteLineResponse, index: number) => void;
  onSaveInstitution?: () => void;
  onSaveContact?: () => void;
}) {
  const [freeOpen, setFreeOpen] = useState(false);
  const quoted = quote.quotedTo ?? {};
  const lines = quote.lines ?? [];
  // Kurum seçiliyse yalnızca o kurumun kişileri; başka kurumun kişisi bağlanamaz.
  const contactOptions = quoted.institutionId
    ? customers.filter((customer) => customer.institution?.id === quoted.institutionId)
    : customers;
  const showInstitutionSave =
    !!quoted.institution?.trim() && !quoted.institutionId && !!onSaveInstitution;
  const showContactSave =
    !!(quoted.contactPerson?.trim() || quoted.greetingName?.trim()) &&
    !quoted.customerId &&
    !!onSaveContact;

  const patchQuoted = (patch: Partial<NonNullable<QuoteResponse["quotedTo"]>>) => {
    onChange(patchQuotedTo(quote, patch));
  };

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-4">
      <section className="grid gap-3 sm:grid-cols-2">
        <Field label="Teklif tarihi">
          <TextInput
            type="date"
            value={quote.quotedDate ?? ""}
            onChange={(event) =>
              onChange({
                ...quote,
                quotedDate: event.target.value || undefined,
              })
            }
          />
        </Field>
        <div className="flex items-center justify-end sm:justify-start">
          <CustomerLinkBadge quote={quote} />
        </div>
        <Field label="Kurum kaydı">
          <Select
            value={quoted.institutionId ?? ""}
            onChange={(event) => {
              const id = event.target.value;
              const institution = institutions.find((item) => item.id === id) ?? null;
              onChange(applyInstitution(quote, institution));
            }}
          >
            <option value="">Elle gir</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="İrtibat kişisi kaydı">
          <Select
            value={quoted.customerId ?? ""}
            onChange={(event) => {
              const id = event.target.value;
              const customer = customers.find((item) => item.id === id) ?? null;
              onChange(applyCustomer(quote, customer));
            }}
          >
            <option value="">Elle gir</option>
            {contactOptions.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customerLabel(customer)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Teklif verilen kurum">
          <div className="flex gap-2">
            <TextInput
              value={quoted.institution ?? ""}
              onChange={(event) => patchQuoted({ institution: event.target.value })}
            />
            {showInstitutionSave ? (
              <ActionButton className="shrink-0" title="Kurumu kaydet" onClick={onSaveInstitution}>
                + Kaydet
              </ActionButton>
            ) : null}
          </div>
        </Field>
        <Field label="İlgili kişi">
          <div className="flex gap-2">
            <TextInput
              value={quoted.contactPerson ?? ""}
              onChange={(event) => patchQuoted({ contactPerson: event.target.value })}
            />
            {showContactSave ? (
              <ActionButton className="shrink-0" title="Kişiyi kaydet" onClick={onSaveContact}>
                + Kaydet
              </ActionButton>
            ) : null}
          </div>
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
          <div className="flex flex-wrap items-end gap-3">
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
            <ActionButton
              tone={freeOpen ? "heat" : "default"}
              onClick={() => setFreeOpen((open) => !open)}
            >
              Serbest Ekle
            </ActionButton>
          </div>
        </div>

        {freeOpen ? (
          <FreeLineForm
            nextNo={lines.length + 1}
            suggestedCode={nextFreeCode(lines)}
            onAdd={(input) => {
              onChange(addFreeLine(quote, input));
            }}
            onCancel={() => setFreeOpen(false)}
          />
        ) : null}

        {lines.length === 0 ? (
          <p className="text-sm text-[var(--steel)]">Henüz satır yok.</p>
        ) : (
          lines.map((line, index) => (
            <LineEditor
              key={line.id ?? `line-${index}`}
              line={line}
              index={index}
              total={lines.length}
              currency={quote.currency}
              product={catalogForLine(products, line)}
              onChange={(next) => onChange(replaceLine(quote, index, next))}
              onRemove={() => onChange(removeLine(quote, index))}
              onMove={(direction) => onChange(moveLine(quote, index, direction))}
              onAutoCode={() =>
                onChange(
                  replaceLine(quote, index, {
                    ...line,
                    code: nextFreeCode(lines.filter((_, itemIndex) => itemIndex !== index)),
                  }),
                )
              }
              onAddToCatalog={
                onAddManualToCatalog
                  ? () => onAddManualToCatalog(line, index)
                  : undefined
              }
            />
          ))
        )}
      </section>
    </div>
  );
}

function FreeLineForm({
  nextNo,
  suggestedCode,
  onAdd,
  onCancel,
}: {
  nextNo: number;
  suggestedCode: string;
  onAdd: (input: { code?: string; name: string; quantity?: number; price?: number }) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const qty = Math.max(1, Math.trunc(Number(quantity)) || 1);
  const unit = Number(unitPrice);
  const total = (Number.isFinite(unit) && unit >= 0 ? unit : 0) * qty;

  const submit = () => {
    if (!name.trim()) {
      setError("Ürün adı zorunludur.");
      return;
    }
    onAdd({
      code,
      name,
      quantity: qty,
      price: Number.isFinite(unit) && unit >= 0 ? unit : 0,
    });
    setCode("");
    setName("");
    setQuantity("1");
    setUnitPrice("0");
    setError(null);
  };

  return (
    <article className="grid gap-3 border border-[var(--heat)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-display text-lg tracking-wide">Serbest satır</h4>
        <p className="font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
          Katalog dışı
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="No">
          <TextInput value={String(nextNo)} readOnly />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Ürün kodu">
            <div className="flex gap-2">
              <TextInput
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Boş bırakılabilir"
              />
              <ActionButton
                onClick={() => setCode(suggestedCode)}
                className="shrink-0"
              >
                Otomatik ata
              </ActionButton>
            </div>
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label="Ad">
            <TextArea
              value={name}
              rows={5}
              className="min-h-32"
              placeholder="Ürün adı ve açıklaması"
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError(null);
              }}
            />
          </Field>
        </div>
        <Field label="Adet">
          <NumberInput
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </Field>
        <Field label="Birim fiyat">
          <NumberInput
            min={0}
            step="0.01"
            value={unitPrice}
            onChange={(event) => setUnitPrice(event.target.value)}
          />
        </Field>
        <Field label="Fiyat">
          <NumberInput
            min={0}
            step="0.01"
            value={Number.isFinite(total) ? String(total) : "0"}
            onChange={(event) => {
              const nextTotal = Number(event.target.value);
              if (!Number.isFinite(nextTotal) || nextTotal < 0) return;
              setUnitPrice(String(nextTotal / qty));
            }}
          />
        </Field>
      </div>
      {error ? <p className="text-sm text-[#8f2d1f]">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <ActionButton onClick={onCancel}>Vazgeç</ActionButton>
        <ActionButton tone="heat" onClick={submit}>
          Ekle
        </ActionButton>
      </div>
    </article>
  );
}

function LineEditor({
  line,
  index,
  total,
  currency,
  product,
  onChange,
  onRemove,
  onMove,
  onAutoCode,
  onAddToCatalog,
}: {
  line: QuoteLineResponse;
  index: number;
  total: number;
  currency?: string;
  product?: ProductResponse;
  onChange: (line: QuoteLineResponse) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  onAutoCode: () => void;
  onAddToCatalog?: () => void;
}) {
  const properties = line.properties ?? [];
  const accessories = line.accessories ?? [];
  const manual = isManualLine(line);
  const quantity = line.quantity ?? 1;
  const unitPrice = line.price ?? line.basePrice ?? 0;
  const lineTotal = line.lineTotal ?? unitPrice * quantity;

  return (
    <article className="grid gap-3 border border-[var(--rule)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <ReorderButtons
            index={index}
            total={total}
            onMove={onMove}
          />
          <div>
            {manual ? (
              <p className="font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
                Elle eklenen · No {index + 1}
              </p>
            ) : (
              <>
                <h4 className="font-display text-lg uppercase tracking-[0.08em]">
                  {index + 1}. {line.name}
                </h4>
                <p className="font-mono text-xs text-[var(--steel)]">{line.code}</p>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {manual && onAddToCatalog ? (
            <ActionButton title="Kataloga ekle" onClick={onAddToCatalog}>
              + Katalog
            </ActionButton>
          ) : null}
          <ActionButton tone="danger" onClick={onRemove}>
            Satırı sil
          </ActionButton>
        </div>
      </div>

      {manual ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="No">
            <TextInput value={String(index + 1)} readOnly />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Ürün kodu">
              <div className="flex gap-2">
                <TextInput
                  value={line.code ?? ""}
                  onChange={(event) => onChange({ ...line, code: event.target.value })}
                />
                <ActionButton onClick={onAutoCode} className="shrink-0">
                  Otomatik ata
                </ActionButton>
              </div>
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label="Ad">
              <TextArea
                value={line.name ?? ""}
                rows={5}
                className="min-h-32"
                onChange={(event) => onChange({ ...line, name: event.target.value })}
              />
            </Field>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Adet">
          <NumberInput
            min={1}
            value={quantity}
            onChange={(event) =>
              onChange({
                ...line,
                quantity: Math.max(1, Number(event.target.value) || 1),
                lineTotal: undefined,
              })
            }
          />
        </Field>
        <Field label="Birim fiyat">
          <PriceInput
            value={unitPrice}
            onCommit={(price) => onChange({ ...line, price, lineTotal: undefined })}
          />
        </Field>
        {manual ? (
          <Field label="Fiyat">
            <PriceInput
              value={lineTotal}
              onCommit={(total) =>
                onChange({
                  ...line,
                  price: total / Math.max(1, quantity),
                  lineTotal: undefined,
                })
              }
            />
          </Field>
        ) : (
          <p className="self-end font-mono text-sm text-[var(--heat)]">
            {formatQuoteAmount(lineTotal, currency)}
          </p>
        )}
      </div>

      {!manual && properties.map((property, propertyIndex) => {
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

      {!manual ? (
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
      ) : null}
    </article>
  );
}

function ReorderButtons({
  index,
  total,
  onMove,
}: {
  index: number;
  total: number;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-label="Yukarı taşı"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        className="grid h-7 w-7 place-items-center border border-[var(--rule)] text-[var(--charcoal)] transition-colors hover:border-[var(--charcoal)] disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronIcon direction="up" />
      </button>
      <button
        type="button"
        aria-label="Aşağı taşı"
        disabled={index === total - 1}
        onClick={() => onMove(1)}
        className="grid h-7 w-7 place-items-center border border-t-0 border-[var(--rule)] text-[var(--charcoal)] transition-colors hover:border-[var(--charcoal)] disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronIcon direction="down" />
      </button>
    </div>
  );
}

function ChevronIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={`h-3.5 w-3.5 ${direction === "down" ? "rotate-180" : ""}`}
    >
      <path
        d="M8 4.5 2.8 10.2h10.4L8 4.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
