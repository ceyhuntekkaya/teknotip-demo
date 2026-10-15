"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ActionButton,
  Field,
  NumberInput,
  Select,
  TextArea,
  TextInput,
} from "@/components/catalog/fields";
import { HtmlEditor } from "@/components/html/html-editor";
import { FreeLineForm, LineEditor } from "@/components/quote/quote-edit-pane";
import type { SheetField, SheetIntent } from "@/components/quote/sheet/sheet-types";
import type {
  CustomerResponse,
  InstitutionResponse,
  ProductResponse,
  QuoteResponse,
  QuoteTerms,
} from "@/lib/api/generated/model";
import { companyTemplate } from "@/lib/pdf/company";
import { milimlabTemplate } from "@/lib/pdf/milimlab-template";
import { optosenseTemplate } from "@/lib/pdf/optosense-template";
import { customerLabel } from "@/lib/customer/display";
import {
  addFreeLine,
  addProductLine,
  applyCustomer,
  applyInstitution,
  catalogForLine,
  moveLine,
  nextFreeCode,
  patchQuotedTo,
  removeLine,
  replaceLine,
} from "@/lib/quote/document-edit";

export type QuickSession =
  | { kind: "add"; anchor: DOMRect }
  | { kind: "free" }
  | { kind: "catalog" }
  | { kind: "line"; index: number }
  | { kind: "delete"; index: number }
  | { kind: "date" }
  | { kind: "tax" }
  | { kind: "institution" }
  | { kind: "contact" }
  | { kind: "field"; field: SheetField };

export function sessionFromSheet(
  intent: Exclude<SheetIntent, { kind: "move-line" }>,
): QuickSession {
  switch (intent.kind) {
    case "add":
      return { kind: "add", anchor: intent.anchor };
    case "edit-line":
      return { kind: "line", index: intent.index };
    case "delete-line":
      return { kind: "delete", index: intent.index };
    case "edit-date":
      return { kind: "date" };
    case "edit-tax":
      return { kind: "tax" };
    case "edit-institution":
      return { kind: "institution" };
    case "edit-contact":
      return { kind: "contact" };
    case "edit-field":
      return { kind: "field", field: intent.field };
  }
}

const CARD_TITLE: Record<Exclude<QuickSession["kind"], "add" | "delete" | "field">, string> = {
  free: "Serbest Ekle",
  catalog: "Katalogdan ekle",
  line: "Ürünü düzenle",
  date: "Teklif tarihi",
  tax: "KDV oranı",
  institution: "İlgili kurum",
  contact: "Yetkili kişi",
};

const FIELD_TITLE: Record<SheetField, string> = {
  phone: "Telefon",
  email: "E-posta",
  address: "Adres",
  department: "Departman",
  discount: "İndirim",
  currency: "Para birimi",
  validity: "Geçerlilik",
  "sales-conditions": "Satış koşulları",
  "delivery-time": "Teslimat süresi",
  "delivery-mode": "Teslimat şekli",
  commercial: "Ticari koşullar",
  "payment-terms": "Ödeme koşulu",
  provisions: "Genel hükümler",
  delivery: "Teslimat",
  payment: "Ödeme",
  validation: "Geçerlilik",
  "trade-terms": "Ticari koşul",
};

export function QuoteQuickEdit({
  session,
  quote,
  products,
  customers,
  institutions,
  onSession,
  onClose,
  onChange,
  onAddManualToCatalog,
  onSaveInstitution,
  onSaveContact,
}: {
  session: QuickSession;
  quote: QuoteResponse;
  products: ProductResponse[];
  customers: CustomerResponse[];
  institutions: InstitutionResponse[];
  onSession: (session: QuickSession) => void;
  onClose: () => void;
  onChange: (next: QuoteResponse) => void;
  onAddManualToCatalog?: (index: number) => void;
  onSaveInstitution?: () => void;
  onSaveContact?: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (session.kind !== "add") return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(".sheet-add")) return;
      onClose();
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [session, onClose]);

  useEffect(() => {
    if (session.kind !== "line" && session.kind !== "delete") return;
    if (!quote.lines?.[session.index]) onClose();
  }, [session, quote.lines, onClose]);

  if (session.kind === "add") {
    if (!mounted) return null;
    const { top, left } = menuPosition(session.anchor);
    return createPortal(
      <div
        ref={menuRef}
        role="menu"
        aria-label="Ürün ekle"
        className="quote-quick-card fixed z-50 w-44 border border-[var(--rule)] bg-white p-1 shadow-[0_16px_40px_-12px_rgb(15_23_42/0.55)]"
        style={{ top, left }}
      >
        <p className="px-2.5 pb-1 pt-1.5 font-display text-[10px] uppercase tracking-[0.18em] text-[var(--steel)]">
          Ürün ekle
        </p>
        <MenuItem label="Serbest" onClick={() => onSession({ kind: "free" })} />
        <MenuItem label="Katalog" onClick={() => onSession({ kind: "catalog" })} />
      </div>,
      document.body,
    );
  }

  if (!mounted) return null;

  if (session.kind === "delete") {
    const line = quote.lines?.[session.index];
    const name = line?.name?.split("\n")[0]?.trim() || line?.code || "Bu ürün";
    return (
      <QuickLayer onClose={onClose}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quote-delete-title"
          className="quote-quick-card w-full max-w-sm border border-[var(--rule)] bg-[var(--paper)] p-4"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
            Onay
          </p>
          <h3 id="quote-delete-title" className="mt-1 font-display text-xl tracking-wide">
            Ürünü sil
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-[var(--charcoal)]">
            <span className="font-medium">{name}</span> tekliften silinsin mi?
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <ActionButton onClick={onClose}>Vazgeç</ActionButton>
            <ActionButton
              tone="danger"
              onClick={() => {
                onChange(removeLine(quote, session.index));
                onClose();
              }}
            >
              Sil
            </ActionButton>
          </div>
        </div>
      </QuickLayer>
    );
  }

  const lines = quote.lines ?? [];
  const title = session.kind === "field" ? FIELD_TITLE[session.field] : CARD_TITLE[session.kind];

  return (
    <QuickLayer onClose={onClose}>
    <aside
      role="dialog"
      aria-modal="true"
      aria-labelledby="quote-quick-title"
      className="quote-quick-card flex max-h-[min(40rem,calc(100dvh-2rem))] w-full max-w-xl flex-col overflow-hidden border border-[var(--rule)] bg-white"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--rule)] px-4 py-3">
        <h3 id="quote-quick-title" className="font-display text-lg tracking-wide">
          {title}
        </h3>
        <ActionButton tone="ghost" onClick={onClose}>
          Kapat
        </ActionButton>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {session.kind === "free" ? (
          <FreeLineForm
            bare
            nextNo={lines.length + 1}
            suggestedCode={nextFreeCode(lines)}
            onCancel={onClose}
            onAdd={(input) => {
              onChange(addFreeLine(quote, input));
              onClose();
            }}
          />
        ) : null}

        {session.kind === "catalog" ? (
          <Field label="Katalogdan ekle">
            <Select
              value=""
              onChange={(event) => {
                const product = products.find((item) => item.id === event.target.value);
                if (!product) return;
                onChange(addProductLine(quote, product));
                onClose();
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
        ) : null}

        {session.kind === "line" && lines[session.index] ? (
          <LineEditor
            bare
            key={lines[session.index]?.id ?? `line-${session.index}`}
            line={lines[session.index]}
            index={session.index}
            total={lines.length}
            currency={quote.currency}
            product={catalogForLine(products, lines[session.index])}
            onChange={(next) => onChange(replaceLine(quote, session.index, next))}
            onRemove={() => {
              onChange(removeLine(quote, session.index));
              onClose();
            }}
            onMove={(direction) => {
              onChange(moveLine(quote, session.index, direction));
              const target = session.index + direction;
              if (target >= 0 && target < lines.length) onSession({ kind: "line", index: target });
            }}
            onAutoCode={() =>
              onChange(
                replaceLine(quote, session.index, {
                  ...lines[session.index],
                  code: nextFreeCode(lines.filter((_, itemIndex) => itemIndex !== session.index)),
                }),
              )
            }
            onAddToCatalog={
              onAddManualToCatalog ? () => onAddManualToCatalog(session.index) : undefined
            }
          />
        ) : null}

        {session.kind === "date" ? (
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
        ) : null}

        {session.kind === "tax" ? (
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
        ) : null}

        {session.kind === "institution" ? (
          <InstitutionFields
            quote={quote}
            institutions={institutions}
            onChange={onChange}
            onSave={onSaveInstitution}
          />
        ) : null}

        {session.kind === "contact" ? (
          <ContactFields
            quote={quote}
            customers={customers}
            onChange={onChange}
            onSave={onSaveContact}
          />
        ) : null}

        {session.kind === "field" ? (
          <FieldEditor quote={quote} field={session.field} onChange={onChange} />
        ) : null}
      </div>
    </aside>
    </QuickLayer>
  );
}

function currencyCode(currency?: string | null) {
  const code = (currency ?? "TRY").trim().toUpperCase();
  if (code === "TL" || code === "TRY") return "TRY";
  if (code === "USD" || code === "EUR" || code === "GBP") return code;
  return "TRY";
}

function patchTerms(quote: QuoteResponse, patch: Partial<QuoteTerms>): QuoteResponse {
  return { ...quote, terms: { ...quote.terms, ...patch } };
}

function shownText(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function FieldEditor({
  quote,
  field,
  onChange,
}: {
  quote: QuoteResponse;
  field: SheetField;
  onChange: (next: QuoteResponse) => void;
}) {
  const quoted = quote.quotedTo ?? {};
  const terms = quote.terms ?? {};
  const ml = milimlabTemplate.texts;
  const os = optosenseTemplate.texts.footer;

  const quotedText = (key: "phone" | "email" | "address" | "department", label: string, multiline = false) => (
    <Field label={label}>
      {multiline ? (
        <TextArea
          value={quoted[key] ?? ""}
          onChange={(event) => onChange(patchQuotedTo(quote, { [key]: event.target.value }))}
        />
      ) : (
        <TextInput
          value={quoted[key] ?? ""}
          onChange={(event) => onChange(patchQuotedTo(quote, { [key]: event.target.value }))}
        />
      )}
    </Field>
  );

  const termText = (
    key:
      | "deliveryTime"
      | "deliveryMode"
      | "commercialTerms"
      | "paymentTerms"
      | "delivery"
      | "payment"
      | "validation"
      | "tradeTerms",
    label: string,
    fallback: string,
    hint?: string,
    multiline = false,
  ) => {
    const value = shownText(terms[key], fallback);
    const control = multiline ? (
      <TextArea
        value={value}
        onChange={(event) => onChange(patchTerms(quote, { [key]: event.target.value }))}
      />
    ) : (
      <TextInput
        value={value}
        onChange={(event) => onChange(patchTerms(quote, { [key]: event.target.value }))}
      />
    );
    return (
      <Field label={label}>
        {control}
        {hint ? <p className="mt-1 text-xs text-[var(--steel)]">{hint}</p> : null}
      </Field>
    );
  };

  switch (field) {
    case "phone":
      return quotedText("phone", "Telefon");
    case "email":
      return quotedText("email", "E-posta");
    case "address":
      return quotedText("address", "Adres", true);
    case "department":
      return quotedText("department", "Departman");
    case "currency":
      return (
        <Field label="Para birimi">
          <Select
            value={currencyCode(quote.currency)}
            onChange={(event) => onChange({ ...quote, currency: event.target.value })}
          >
            <option value="TRY">TL</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </Select>
        </Field>
      );
    case "discount":
      return (
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
      );
    case "validity":
      return (
        <Field label="Geçerlilik (gün)">
          <NumberInput
            min={0}
            max={3650}
            value={terms.validityDays ?? milimlabTemplate.terms.validityDays}
            onChange={(event) => {
              const raw = event.target.value;
              onChange(
                patchTerms(quote, { validityDays: raw === "" ? undefined : Number(raw) }),
              );
            }}
          />
        </Field>
      );
    case "sales-conditions":
      return (
        <div className="grid gap-3">
          <Field label="Geçerlilik (gün)">
            <NumberInput
              min={0}
              max={3650}
              value={terms.validityDays ?? companyTemplate.terms.validityDays}
              onChange={(event) => {
                const raw = event.target.value;
                onChange(
                  patchTerms(quote, { validityDays: raw === "" ? undefined : Number(raw) }),
                );
              }}
            />
          </Field>
          <Field label="Genel satış koşulları">
            <HtmlEditor
              value={terms.salesConditions ?? ""}
              onChange={(salesConditions) => onChange(patchTerms(quote, { salesConditions }))}
            />
            <p className="mt-1 text-xs text-[var(--steel)]">
              Boş bırakılırsa standart koşullar kalır. {"{rate}"} KDV oranı, {"{date}"} geçerlilik
              gününden hesaplanan tarihtir.
            </p>
          </Field>
        </div>
      );
    case "delivery-time":
      return termText("deliveryTime", "Teslimat süresi", ml.deliveryTime);
    case "delivery-mode":
      return termText("deliveryMode", "Teslimat şekli", ml.deliveryMode);
    case "commercial":
      return termText(
        "commercialTerms",
        "Ticari koşullar",
        ml.commercialBody,
        "{rate} teklifin KDV oranıyla değişir.",
      );
    case "payment-terms":
      return termText("paymentTerms", "Ödeme koşulu", ml.paymentBody);
    case "provisions":
      return (
        <Field label="Genel hükümler">
          <HtmlEditor
            value={terms.generalProvisions ?? ""}
            onChange={(generalProvisions) => onChange(patchTerms(quote, { generalProvisions }))}
          />
          <p className="mt-1 text-xs text-[var(--steel)]">
            Boş bırakılırsa standart notlar kullanılır.
          </p>
        </Field>
      );
    case "delivery":
      return termText("delivery", "Teslimat", os.delivery);
    case "payment":
      return termText("payment", "Ödeme", os.payment, undefined, true);
    case "validation":
      return termText("validation", "Geçerlilik", os.validation);
    case "trade-terms":
      return termText("tradeTerms", "Ticari koşul", os.terms);
  }
}

function QuickLayer({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="flex h-9 w-full items-center rounded-md px-2.5 text-left text-sm text-[var(--charcoal)] hover:bg-[var(--mist)]"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function menuPosition(anchor: DOMRect) {
  const width = 176;
  const height = 96;
  const left = Math.min(Math.max(8, anchor.right - width), window.innerWidth - width - 8);
  const below = anchor.bottom + 8;
  const top = below + height > window.innerHeight - 8 ? Math.max(8, anchor.top - height - 8) : below;
  return { top, left };
}

function InstitutionFields({
  quote,
  institutions,
  onChange,
  onSave,
}: {
  quote: QuoteResponse;
  institutions: InstitutionResponse[];
  onChange: (next: QuoteResponse) => void;
  onSave?: () => void;
}) {
  const quoted = quote.quotedTo ?? {};
  const showSave = !!quoted.institution?.trim() && !quoted.institutionId && !!onSave;
  return (
    <div className="grid gap-3">
      <Field label="Kurum kaydı">
        <Select
          value={quoted.institutionId ?? ""}
          onChange={(event) => {
            const institution = institutions.find((item) => item.id === event.target.value) ?? null;
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
      <Field label="Teklif verilen kurum">
        <div className="flex gap-2">
          <TextInput
            value={quoted.institution ?? ""}
            onChange={(event) => onChange(patchQuotedTo(quote, { institution: event.target.value }))}
          />
          {showSave ? (
            <ActionButton className="shrink-0" title="Kurumu kaydet" onClick={onSave}>
              + Kaydet
            </ActionButton>
          ) : null}
        </div>
      </Field>
      <Field label="Adres">
        <TextArea
          value={quoted.address ?? ""}
          onChange={(event) => onChange(patchQuotedTo(quote, { address: event.target.value }))}
        />
      </Field>
    </div>
  );
}

function ContactFields({
  quote,
  customers,
  onChange,
  onSave,
}: {
  quote: QuoteResponse;
  customers: CustomerResponse[];
  onChange: (next: QuoteResponse) => void;
  onSave?: () => void;
}) {
  const quoted = quote.quotedTo ?? {};
  const contactOptions = quoted.institutionId
    ? customers.filter((customer) => customer.institution?.id === quoted.institutionId)
    : customers;
  const showSave =
    !!(quoted.contactPerson?.trim() || quoted.greetingName?.trim()) && !quoted.customerId && !!onSave;

  return (
    <div className="grid gap-3">
      <Field label="İrtibat kişisi kaydı">
        <Select
          value={quoted.customerId ?? ""}
          onChange={(event) => {
            const customer = customers.find((item) => item.id === event.target.value) ?? null;
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
      <Field label="İlgili kişi">
        <div className="flex gap-2">
          <TextInput
            value={quoted.contactPerson ?? ""}
            onChange={(event) =>
              onChange(patchQuotedTo(quote, { contactPerson: event.target.value }))
            }
          />
          {showSave ? (
            <ActionButton className="shrink-0" title="Kişiyi kaydet" onClick={onSave}>
              + Kaydet
            </ActionButton>
          ) : null}
        </div>
      </Field>
      <Field label="Departman">
        <TextInput
          value={quoted.department ?? ""}
          onChange={(event) => onChange(patchQuotedTo(quote, { department: event.target.value }))}
        />
      </Field>
      <Field label="Unvan">
        <TextInput
          value={quoted.title ?? ""}
          onChange={(event) => onChange(patchQuotedTo(quote, { title: event.target.value }))}
        />
      </Field>
      <Field label="Telefon">
        <TextInput
          value={quoted.phone ?? ""}
          onChange={(event) => onChange(patchQuotedTo(quote, { phone: event.target.value }))}
        />
      </Field>
      <Field label="E-posta">
        <TextInput
          value={quoted.email ?? ""}
          onChange={(event) => onChange(patchQuotedTo(quote, { email: event.target.value }))}
        />
      </Field>
    </div>
  );
}
