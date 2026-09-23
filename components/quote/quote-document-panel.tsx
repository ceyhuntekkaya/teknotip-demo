"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/catalog/fields";
import {
  QuotePdfPanel,
  quotePdfFilename,
} from "@/components/pdf/quote-pdf-panel";
import { QuoteEditPane } from "@/components/quote/quote-edit-pane";
import { QuoteReminderForm } from "@/components/quote/quote-reminder-form";
import type {
  CustomerResponse,
  InstitutionResponse,
  ProductResponse,
  QuoteResponse,
} from "@/lib/api/generated/model";
import { formatQuoteAddOn, formatQuoteAmount } from "@/lib/money";
import { displayQuotedDate } from "@/lib/pdf/format";
import {
  isQuoteActionReady,
  QUOTE_ACTION_READY_HINT,
} from "@/lib/quote/action-ready";

export function QuoteDocumentPanel({
  quote,
  products,
  customers,
  institutions,
  saving = false,
  emptyHint = "Düzenlemeden ürün ekleyin veya soldan bir teklif seçin.",
  defaultView = "quote",
  editHref,
  onChange,
  onCreateVersion,
  onSelectVersion,
  onToggleConverted,
  onDelete,
}: {
  quote: QuoteResponse | null;
  products: ProductResponse[];
  customers: CustomerResponse[];
  institutions: InstitutionResponse[];
  saving?: boolean;
  emptyHint?: string;
  defaultView?: "quote" | "edit";
  editHref?: string;
  onChange?: (next: QuoteResponse) => void;
  onCreateVersion?: () => void;
  onSelectVersion?: (id: string) => void;
  onToggleConverted?: () => void;
  onDelete?: () => void;
}) {
  const router = useRouter();
  const [pdfQuote, setPdfQuote] = useState<QuoteResponse | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [rightView, setRightView] = useState<"quote" | "edit">(defaultView);
  const [remindOpen, setRemindOpen] = useState(false);
  const [showImages, setShowImages] = useState(false);

  const showingPdf = pdfQuote !== null;
  const editing = rightView === "edit";
  const canEdit = Boolean(onChange || editHref);
  const detailedPrices = quote?.priceDetails !== false;

  const setPriceMode = (detailed: boolean) => {
    if (!quote || !onChange || detailedPrices === detailed) return;
    const next = { ...quote, priceDetails: detailed };
    onChange(next);
    setPdfQuote((current) => (current ? next : current));
  };
  const lines = quote?.lines ?? [];
  const summary = quote?.priceSummary;
  const actionReady = isQuoteActionReady(quote);
  const actionHint = actionReady ? undefined : QUOTE_ACTION_READY_HINT;

  useEffect(() => {
    if (!actionReady) setRemindOpen(false);
  }, [actionReady]);

  const handlePdfUrl = useCallback((url: string | null) => {
    setPdfUrl(url);
  }, []);

  const closePdf = () => {
    setPdfQuote(null);
    setPdfUrl(null);
  };

  return (
    <section className="flex min-h-[24rem] flex-col overflow-hidden border border-[var(--rule)] bg-[var(--paper)] lg:h-full lg:min-h-0">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-[var(--rule)] px-4 py-3">
        <div className="grid gap-2">
          <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
            Belge
          </p>
          <h2 className="font-display text-2xl leading-none tracking-wide">
            {editing ? "Düzenleme" : "Teklif"}
          </h2>
          {quote ? (
            <div className="flex flex-wrap gap-2">
              {onChange ? (
                <div className="flex" role="group" aria-label="PDF fiyat görünümü">
                  {(
                    [
                      { detailed: false, label: "Tek Fiyat" },
                      { detailed: true, label: "Detaylı Fiyat" },
                    ] as const
                  ).map((option) => {
                    const active = detailedPrices === option.detailed;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPriceMode(option.detailed)}
                        className={`h-8 border px-2.5 font-display text-[12px] uppercase tracking-[0.12em] ${
                          active
                            ? "border-[var(--heat)] bg-[var(--heat)] text-[var(--paper)]"
                            : "border-[var(--rule)] text-[var(--charcoal)] hover:border-[var(--charcoal)]"
                        } ${option.detailed ? "" : "border-r-0"}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <div className="flex" role="group" aria-label="PDF görsel görünümü">
                {(
                  [
                    { images: false, label: "Görselsiz" },
                    { images: true, label: "Görselli" },
                  ] as const
                ).map((option) => {
                  const active = showImages === option.images;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setShowImages(option.images)}
                      className={`h-8 border px-2.5 font-display text-[12px] uppercase tracking-[0.12em] ${
                        active
                          ? "border-[var(--heat)] bg-[var(--heat)] text-[var(--paper)]"
                          : "border-[var(--rule)] text-[var(--charcoal)] hover:border-[var(--charcoal)]"
                      } ${option.images ? "" : "border-r-0"}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {(quote?.versions?.length ?? 0) > 1 ? (
            <div className="flex flex-wrap gap-1">
              {(quote?.versions ?? []).map((version) => {
                const active = version.id === quote?.id;
                return (
                  <button
                    key={version.id ?? String(version.versionNumber)}
                    type="button"
                    disabled={!onSelectVersion || !version.id || active}
                    onClick={() => version.id && onSelectVersion?.(version.id)}
                    className={`grid h-8 min-w-8 place-items-center border px-2 font-display text-sm ${
                      active
                        ? "border-[var(--heat)] bg-[var(--heat)] text-[var(--paper)]"
                        : "border-[var(--rule)] text-[var(--charcoal)] hover:border-[var(--charcoal)]"
                    } disabled:cursor-default`}
                  >
                    {version.versionNumber}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className="font-mono text-xs text-[var(--steel)]">
            {saving ? "Kaydediliyor…" : quote?.quoteNumber || "—"}
            {quote?.convertedToSale ? " · Satış" : ""}
          </p>
          {showingPdf && pdfQuote ? (
            <>
              {pdfUrl ? (
                <a
                  href={pdfUrl}
                  download={quotePdfFilename(pdfQuote.quoteNumber ?? "teklif")}
                  className="inline-flex h-9 items-center justify-center border border-transparent px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--steel)] hover:text-[var(--charcoal)]"
                >
                  İndir
                </a>
              ) : null}
              <ActionButton type="button" onClick={closePdf}>
                Geri Dön
              </ActionButton>
            </>
          ) : (
            <>
              {quote?.id ? (
                <ActionButton
                  type="button"
                  tone={remindOpen ? "heat" : "default"}
                  disabled={!actionReady}
                  title={actionHint}
                  onClick={() => setRemindOpen((open) => !open)}
                >
                  Hatırlat
                </ActionButton>
              ) : null}
              {onToggleConverted ? (
                <ActionButton
                  type="button"
                  disabled={
                    !quote ||
                    saving ||
                    (!quote.convertedToSale && !actionReady)
                  }
                  title={
                    quote?.convertedToSale || actionReady
                      ? undefined
                      : QUOTE_ACTION_READY_HINT
                  }
                  onClick={onToggleConverted}
                >
                  {quote?.convertedToSale ? "Satıştan Çıkar" : "Satışa Dönüştü"}
                </ActionButton>
              ) : null}
              {onCreateVersion ? (
                <ActionButton
                  type="button"
                  disabled={!quote || saving || !actionReady}
                  title={actionHint}
                  onClick={onCreateVersion}
                >
                  Versiyon Üret
                </ActionButton>
              ) : null}
              <ActionButton
                type="button"
                disabled={!quote || !canEdit}
                onClick={() => {
                  if (editHref) {
                    router.push(editHref);
                    return;
                  }
                  setRightView((current) =>
                    current === "edit" ? "quote" : "edit",
                  );
                }}
              >
                {editing && !editHref
                  ? "Teklif Görünümü"
                  : "Düzenleme Görünümü"}
              </ActionButton>
              {onDelete ? (
                <ActionButton
                  type="button"
                  tone="danger"
                  disabled={saving}
                  onClick={onDelete}
                >
                  Sil
                </ActionButton>
              ) : null}
              <ActionButton
                tone="heat"
                type="button"
                disabled={!quote || lines.length === 0}
                onClick={() => quote && setPdfQuote(quote)}
              >
                PDF Yap
              </ActionButton>
            </>
          )}
        </div>
      </header>

      {remindOpen && quote?.id && actionReady && !showingPdf ? (
        <QuoteReminderForm key={quote.id} quoteId={quote.id} />
      ) : null}

      {showingPdf && pdfQuote ? (
        <QuotePdfPanel
          quote={pdfQuote}
          products={products}
          showImages={showImages}
          onUrl={handlePdfUrl}
        />
      ) : editing && quote && onChange ? (
        <QuoteEditPane
          quote={quote}
          products={products}
          customers={customers}
          institutions={institutions}
          onChange={onChange}
        />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {!quote ? (
              <p className="grid place-items-center px-6 py-16 text-center text-sm text-[var(--steel)]">
                {emptyHint}
              </p>
            ) : (
              <div className="grid gap-4">
                <QuotePartySummary quote={quote} />
                {lines.length === 0 ? (
                  <p className="grid place-items-center px-6 py-12 text-center text-sm text-[var(--steel)]">
                    {emptyHint}
                  </p>
                ) : (
                  lines.map((line, index) => (
                  <article
                    key={line.id ?? `line-${index}`}
                    className="border border-[var(--rule)]"
                  >
                    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <h3
                          className={
                            line.productId
                              ? "font-display text-lg uppercase tracking-[0.08em]"
                              : "whitespace-pre-wrap text-sm leading-snug"
                          }
                        >
                          {line.name}
                        </h3>
                        <p className="text-sm text-[var(--steel)]">
                          {line.code || "—"} · {line.quantity ?? 1} adet
                          {line.productId ? "" : " · Elle eklenen"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-[11px] uppercase tracking-[0.14em] text-[var(--steel)]">
                          Birim
                        </p>
                        <p className="font-mono text-sm text-[var(--heat)]">
                          {formatQuoteAmount(line.price ?? line.basePrice ?? 0, quote.currency)}
                        </p>
                        <p className="font-mono text-xs text-[var(--steel)]">
                          {formatQuoteAmount(line.lineTotal ?? 0, quote.currency)}
                        </p>
                      </div>
                    </div>
                    {(line.properties ?? []).length ? (
                      <div className="border-t border-[var(--rule)] px-3 py-2">
                        <ul className="grid gap-1">
                          {(line.properties ?? []).map((property, propertyIndex) => (
                            <li
                              key={property.id ?? `p-${propertyIndex}`}
                              className="flex items-baseline justify-between gap-3 text-sm"
                            >
                              <span>
                                {property.name}: {property.values || "—"}
                              </span>
                              {property.price ? (
                                <span className="font-mono text-[11px] text-[var(--heat)]">
                                  {formatQuoteAddOn(property.price, quote.currency)}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {(line.accessories ?? []).length ? (
                      <div className="border-t border-[var(--rule)] px-3 py-2">
                        <ul className="grid gap-1">
                          {(line.accessories ?? []).map((accessory, accessoryIndex) => (
                            <li
                              key={accessory.id ?? `a-${accessoryIndex}`}
                              className="flex items-baseline justify-between gap-3 text-sm"
                            >
                              <span>
                                {accessory.name} × {accessory.quantity ?? 1}
                              </span>
                              {accessory.price ? (
                                <span className="font-mono text-[11px] text-[var(--heat)]">
                                  {formatQuoteAddOn(accessory.price, quote.currency)}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </article>
                ))
                )}
              </div>
            )}
          </div>

          <footer className="grid shrink-0 grid-cols-[1fr_auto] items-end gap-4 bg-[var(--soot)] px-4 py-3 text-[var(--paper)]">
            <div className="grid gap-1 text-[11px] uppercase tracking-[0.16em] text-[var(--heat-soft)]">
              <span>Ara {formatQuoteAmount(summary?.subtotal ?? 0, quote?.currency)}</span>
              <span>
                KDV %{summary?.taxRatePercent ?? 20}{" "}
                {formatQuoteAmount(summary?.tax ?? 0, quote?.currency)}
              </span>
            </div>
            <div className="text-right">
              <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--heat-soft)]">
                Genel toplam
              </p>
              <p className="kiln-readout font-mono text-3xl leading-none text-[var(--heat-soft)]">
                {formatQuoteAmount(summary?.totalAfterTax ?? 0, quote?.currency)}
              </p>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}

function QuotePartySummary({ quote }: { quote: QuoteResponse }) {
  const quoted = quote.quotedTo ?? {};
  const person = quoted.contactPerson?.trim() || quoted.greetingName?.trim() || "";
  const fields = [
    {
      label: "Teklif verilen kurum",
      value: quoted.institution?.trim() || "—",
    },
    {
      label: "İlgili kişi",
      value: person || "—",
    },
    {
      label: "Teklif tarihi",
      value: displayQuotedDate(quote.quotedDate),
    },
  ];

  return (
    <dl className="grid gap-3 border border-[var(--rule)] p-4 sm:grid-cols-3">
      {fields.map((field) => (
        <div key={field.label} className="grid gap-1">
          <dt className="font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
            {field.label}
          </dt>
          <dd className="text-sm leading-snug">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}
