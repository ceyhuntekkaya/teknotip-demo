"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiErrorMessage } from "@/lib/api/errors";
import { getQuoteReport } from "@/lib/api/generated/endpoints/quotes/quotes";
import type { QuoteSummaryResponse } from "@/lib/api/generated/model";
import { formatTry } from "@/lib/catalog/price";
import { displayQuotedDate } from "@/lib/pdf/format";

export function RelatedQuotesPanel({
  customerId,
  productId,
}: {
  customerId?: string;
  productId?: string;
}) {
  const [quotes, setQuotes] = useState<QuoteSummaryResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = customerId ?? productId;

  useEffect(() => {
    if (!id) {
      setQuotes([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const response = await getQuoteReport(
          customerId ? { customerId } : { productId },
        );
        if (cancelled) return;
        if (response.status !== 200) {
          setQuotes([]);
          setError(apiErrorMessage(response.data, "Teklifler yüklenemedi."));
          return;
        }
        setQuotes(response.data.quotes ?? []);
      } catch {
        if (!cancelled) {
          setQuotes([]);
          setError("Teklifler yüklenemedi.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId, productId, id]);

  return (
    <aside className="grid h-fit gap-3 border border-[var(--rule)] p-4">
      <p className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
        Teklifler
      </p>
      {!id ? (
        <p className="text-sm text-[var(--steel)]">
          Kayıt seçilince teklifler burada görünür.
        </p>
      ) : loading ? (
        <p className="text-sm text-[var(--steel)]">Yükleniyor…</p>
      ) : error ? (
        <p className="text-sm text-[#8f2d1f]">{error}</p>
      ) : quotes.length === 0 ? (
        <p className="text-sm text-[var(--steel)]">Bu kayda ait teklif yok.</p>
      ) : (
        <ul>
          {quotes.map((item) => (
            <li key={item.id}>
              <Link
                href={
                  item.id
                    ? `/teklif?quoteId=${encodeURIComponent(item.id)}`
                    : "/teklif"
                }
                className="flex flex-col gap-0.5 border-t border-[var(--rule)] py-3 text-sm text-[var(--charcoal)] hover:text-[var(--heat)]"
              >
                <span className="font-mono text-xs">
                  {item.quoteNumber || "—"}
                  {(item.versionNumber ?? 1) > 1
                    ? ` · v${item.versionNumber}`
                    : ""}
                  {item.convertedToSale ? " · Satış" : ""}
                </span>
                <span>
                  {item.institution || item.contactPerson || "Müşteri yok"}
                </span>
                <span className="text-xs text-[var(--steel)]">
                  {displayQuotedDate(item.quotedDate)} ·{" "}
                  {formatTry(item.totalAfterTax ?? 0)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
