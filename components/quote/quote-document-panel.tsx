"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton } from "@/components/catalog/fields";
import {
  QuotePdfPanel,
  quotePdfFilename,
} from "@/components/pdf/quote-pdf-panel";
import { AddManualToCatalogModal } from "@/components/quote/add-manual-to-catalog-modal";
import { QuoteEditPane } from "@/components/quote/quote-edit-pane";
import { QuoteReminderForm } from "@/components/quote/quote-reminder-form";
import { QuoteSheet } from "@/components/quote/sheet/quote-sheet";
import {
  SavePartyModal,
  type SavePartyMode,
} from "@/components/quote/save-party-modal";
import type {
  CustomerResponse,
  InstitutionResponse,
  ProductResponse,
  QuoteLineResponse,
  QuoteResponse,
} from "@/lib/api/generated/model";
import {
  isQuoteActionReady,
  QUOTE_ACTION_READY_HINT,
} from "@/lib/quote/action-ready";
import {
  applyCustomer,
  applyInstitution,
  linkManualLineToProduct,
  replaceLine,
} from "@/lib/quote/document-edit";

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
  const [catalogLine, setCatalogLine] = useState<{
    line: QuoteLineResponse;
    index: number;
  } | null>(null);
  const [partyMode, setPartyMode] = useState<SavePartyMode | null>(null);

  const showingPdf = pdfQuote !== null;
  const editing = rightView === "edit";
  const canEdit = Boolean(onChange || editHref);
  const detailedPrices = quote?.priceDetails !== false;
  const showImages = quote?.showImages === true;

  const patchDisplay = (patch: Partial<Pick<QuoteResponse, "priceDetails" | "showImages">>) => {
    if (!quote || !onChange) return;
    const next = { ...quote, ...patch };
    onChange(next);
    setPdfQuote((current) => (current ? next : current));
  };

  const setPriceMode = (detailed: boolean) => {
    if (detailedPrices === detailed) return;
    patchDisplay({ priceDetails: detailed });
  };

  const setImageMode = (images: boolean) => {
    if (showImages === images) return;
    patchDisplay({ showImages: images });
  };

  const lines = quote?.lines ?? [];
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
    <section className="flex h-full min-h-0 flex-col overflow-hidden border border-[var(--rule)] bg-[var(--paper)]">
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
                <>
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
                          onClick={() => setImageMode(option.images)}
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
                </>
              ) : null}
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
          onAddManualToCatalog={(line, index) => setCatalogLine({ line, index })}
          onSaveInstitution={() => setPartyMode("institution")}
          onSaveContact={() => setPartyMode("contact")}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {!quote ? (
            <p className="grid h-full place-items-center px-6 py-16 text-center text-sm text-[var(--steel)]">
              {emptyHint}
            </p>
          ) : (
            <QuoteSheet
              quote={quote}
              products={products}
              showImages={showImages}
              emptyHint={emptyHint}
              canSave={Boolean(onChange)}
              onSaveInstitution={() => setPartyMode("institution")}
              onSaveContact={() => setPartyMode("contact")}
              onAddToCatalog={(line, index) => setCatalogLine({ line, index })}
            />
          )}
        </div>
      )}

      {catalogLine && quote && onChange ? (
        <AddManualToCatalogModal
          line={catalogLine.line}
          onClose={() => setCatalogLine(null)}
          onSaved={(product) => {
            const linked = linkManualLineToProduct(catalogLine.line, product);
            onChange(replaceLine(quote, catalogLine.index, linked));
            setCatalogLine(null);
            router.refresh();
          }}
        />
      ) : null}

      {partyMode && quote && onChange ? (
        <SavePartyModal
          quote={quote}
          mode={partyMode}
          onClose={() => setPartyMode(null)}
          onSaved={({ institution, customer }) => {
            let next = quote;
            if (institution) next = applyInstitution(next, institution);
            if (customer) next = applyCustomer(next, customer);
            onChange(next);
            setPartyMode(null);
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}
