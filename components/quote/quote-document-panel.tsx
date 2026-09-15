"use client";

import { useCallback, useState } from "react";
import { ActionButton } from "@/components/catalog/fields";
import {
  QuotePdfPanel,
  quotePdfFilename,
} from "@/components/pdf/quote-pdf-panel";
import { QuoteEditPane } from "@/components/quote/quote-edit-pane";
import type {
  CustomerResponse,
  ProductResponse,
  QuoteResponse,
} from "@/lib/api/generated/model";
import { formatAddOn, formatTry } from "@/lib/catalog/price";

export function QuoteDocumentPanel({
  quote,
  products,
  customers,
  saving = false,
  emptyHint = "Düzenlemeden ürün ekleyin veya soldan bir teklif seçin.",
  onChange,
}: {
  quote: QuoteResponse | null;
  products: ProductResponse[];
  customers: CustomerResponse[];
  saving?: boolean;
  emptyHint?: string;
  onChange?: (next: QuoteResponse) => void;
}) {
  const [pdfQuote, setPdfQuote] = useState<QuoteResponse | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [rightView, setRightView] = useState<"quote" | "edit">("quote");

  const showingPdf = pdfQuote !== null;
  const editing = rightView === "edit";
  const lines = quote?.lines ?? [];
  const summary = quote?.priceSummary;

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
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
            Belge
          </p>
          <h2 className="font-display text-2xl leading-none tracking-wide">
            {editing ? "Düzenleme" : "Teklif"}
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className="font-mono text-xs text-[var(--steel)]">
            {saving ? "Kaydediliyor…" : quote?.quoteNumber || "—"}
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
              <ActionButton
                type="button"
                disabled={!quote || !onChange}
                onClick={() =>
                  setRightView((current) => (current === "edit" ? "quote" : "edit"))
                }
              >
                {editing ? "Teklif Görünümü" : "Düzenleme Görünümü"}
              </ActionButton>
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

      {showingPdf && pdfQuote ? (
        <QuotePdfPanel quote={pdfQuote} onUrl={handlePdfUrl} />
      ) : editing && quote && onChange ? (
        <QuoteEditPane
          quote={quote}
          products={products}
          customers={customers}
          onChange={onChange}
        />
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {!quote || lines.length === 0 ? (
              <p className="grid place-items-center px-6 py-16 text-center text-sm text-[var(--steel)]">
                {emptyHint}
              </p>
            ) : (
              <div className="grid gap-4">
                {lines.map((line, index) => (
                  <article
                    key={line.id ?? `line-${index}`}
                    className="border border-[var(--rule)]"
                  >
                    <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                      <div>
                        <h3 className="font-display text-lg uppercase tracking-[0.08em]">
                          {line.name}
                        </h3>
                        <p className="text-sm text-[var(--steel)]">
                          {line.code} · {line.quantity ?? 1} adet
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-[11px] uppercase tracking-[0.14em] text-[var(--steel)]">
                          Birim
                        </p>
                        <p className="font-mono text-sm text-[var(--heat)]">
                          {formatTry(line.price ?? line.basePrice ?? 0)}
                        </p>
                        <p className="font-mono text-xs text-[var(--steel)]">
                          {formatTry(line.lineTotal ?? 0)}
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
                                  {formatAddOn(property.price)}
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
                                  {formatAddOn(accessory.price)}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>

          <footer className="grid shrink-0 grid-cols-[1fr_auto] items-end gap-4 bg-[var(--soot)] px-4 py-3 text-[var(--paper)]">
            <div className="grid gap-1 text-[11px] uppercase tracking-[0.16em] text-[var(--heat-soft)]">
              <span>Ara {formatTry(summary?.subtotal ?? 0)}</span>
              <span>
                KDV %{summary?.taxRatePercent ?? 20} {formatTry(summary?.tax ?? 0)}
              </span>
            </div>
            <div className="text-right">
              <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--heat-soft)]">
                Genel toplam
              </p>
              <p className="kiln-readout font-mono text-3xl leading-none text-[var(--heat-soft)]">
                {formatTry(summary?.totalAfterTax ?? 0)}
              </p>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
