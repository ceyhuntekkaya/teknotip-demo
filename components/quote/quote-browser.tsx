"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SplitWorkspace } from "@/components/layout/split-workspace";
import { TextInput } from "@/components/catalog/fields";
import { QuoteDocumentPanel } from "@/components/quote/quote-document-panel";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  createQuoteVersion,
  getQuoteById,
  listQuotes,
  setQuoteConverted,
} from "@/lib/api/generated/endpoints/quotes/quotes";
import type {
  CustomerResponse,
  ProductResponse,
  QuoteResponse,
  QuoteSummaryResponse,
} from "@/lib/api/generated/model";
import { formatTry } from "@/lib/catalog/price";
import { displayQuotedDate } from "@/lib/pdf/format";
import { saveQuoteWorkspace } from "@/lib/quote/workspace";

const PAGE_SIZE = 10;

function patchSummary(
  item: QuoteSummaryResponse,
  quote: QuoteResponse,
): QuoteSummaryResponse {
  if (item.id !== quote.id) return item;
  return {
    ...item,
    quoteNumber: quote.quoteNumber,
    quotedDate: quote.quotedDate,
    institution: quote.quotedTo?.institution,
    contactPerson: quote.quotedTo?.contactPerson,
    totalAfterTax: quote.priceSummary?.totalAfterTax,
    versionNumber: quote.versionNumber,
    convertedToSale: quote.convertedToSale,
    updatedAt: quote.updatedAt,
  };
}

export function QuoteBrowser({
  initialQuotes,
  products,
  customers,
}: {
  initialQuotes: QuoteSummaryResponse[];
  products: ProductResponse[];
  customers: CustomerResponse[];
}) {
  const router = useRouter();
  const [quotes, setQuotes] = useState(initialQuotes);
  const [query, setQuery] = useState("");
  const [listing, setListing] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialQuotes[0]?.id ?? null,
  );
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const requestId = useRef(0);
  const skipInitialList = useRef(true);

  const loadQuote = useCallback(async (id: string) => {
    const ticket = ++requestId.current;
    setLoadingQuote(true);
    setError(null);
    try {
      const response = await getQuoteById(id);
      if (ticket !== requestId.current) return;
      if (response.status !== 200) {
        setQuote(null);
        setError(apiErrorMessage(response.data, "Teklif yüklenemedi."));
        return;
      }
      setQuote(response.data);
    } catch {
      if (ticket !== requestId.current) return;
      setQuote(null);
      setError("Teklif yüklenemedi.");
    } finally {
      if (ticket === requestId.current) setLoadingQuote(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setQuote(null);
      return;
    }
    void loadQuote(selectedId);
  }, [selectedId, loadQuote]);

  useEffect(() => {
    if (skipInitialList.current && !query.trim()) {
      skipInitialList.current = false;
      return;
    }
    skipInitialList.current = false;
    const trimmed = query.trim();
    const handle = window.setTimeout(() => {
      void (async () => {
        setListing(true);
        setError(null);
        try {
          const response = await listQuotes({
            q: trimmed || undefined,
            page: 0,
            size: PAGE_SIZE,
            sort: ["createdAt,desc"],
          });
          if (response.status !== 200) {
            setError(apiErrorMessage(response.data, "Teklifler yüklenemedi."));
            return;
          }
          const next = response.data.content ?? [];
          setQuotes(next);
          setSelectedId((current) => {
            if (current && next.some((item) => item.id === current)) return current;
            return next[0]?.id ?? null;
          });
        } catch {
          setError("Teklifler yüklenemedi.");
        } finally {
          setListing(false);
        }
      })();
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query]);

  const applyQuote = (next: QuoteResponse) => {
    setQuote(next);
    setQuotes((current) => current.map((item) => patchSummary(item, next)));
  };

  const createVersion = async () => {
    if (!quote?.id) return;
    setSaving(true);
    setError(null);
    try {
      const response = await createQuoteVersion(quote.id);
      if (response.status !== 201) {
        setError(apiErrorMessage(response.data, "Versiyon üretilemedi."));
        return;
      }
      const id = response.data.id;
      if (!id) return;
      saveQuoteWorkspace({ version: 3, quoteId: id, messages: [] });
      router.push(`/teklif?quoteId=${encodeURIComponent(id)}`);
    } catch {
      setError("Versiyon üretilemedi.");
    } finally {
      setSaving(false);
    }
  };

  const toggleConverted = async () => {
    if (!quote?.id) return;
    setSaving(true);
    setError(null);
    try {
      const response = await setQuoteConverted(quote.id, {
        converted: !quote.convertedToSale,
      });
      if (response.status !== 200) {
        setError(apiErrorMessage(response.data, "Satış durumu güncellenemedi."));
        return;
      }
      applyQuote(response.data);
    } catch {
      setError("Satış durumu güncellenemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SplitWorkspace
      eyebrow="TeknoTip · Teklifler"
      title="Kayıtlar"
      listWidthClassName="lg:w-72"
      detailClassName="overflow-hidden p-3 lg:p-4"
      listHeader={
        <div className="grid gap-2 border-b border-[var(--rule)] px-4 py-3">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
            Liste
          </p>
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Müşteri adı ile ara"
            aria-label="Müşteri adı ile ara"
          />
          <p className="text-xs text-[var(--steel)]">
            {listing
              ? "Aranıyor…"
              : query.trim()
                ? "Arama sonucu (en fazla 10)"
                : "Son 10 teklif"}
          </p>
        </div>
      }
      list={
        <ul>
          {quotes.length === 0 ? (
            <li className="px-4 py-6 text-sm text-[var(--steel)]">Teklif bulunamadı.</li>
          ) : (
            quotes.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => item.id && setSelectedId(item.id)}
                  className={`flex w-full flex-col items-start gap-0.5 border-t border-[var(--rule)] px-4 py-3 text-left text-sm ${
                    selectedId === item.id
                      ? "bg-[var(--mist)] text-[var(--charcoal)]"
                      : "text-[var(--steel)] hover:text-[var(--charcoal)]"
                  }`}
                >
                  <span className="font-mono text-xs">
                    {item.quoteNumber || "—"}
                    {(item.versionNumber ?? 1) > 1 ? ` · v${item.versionNumber}` : ""}
                    {item.convertedToSale ? " · Satış" : ""}
                  </span>
                  <span>{item.institution || item.contactPerson || "Müşteri yok"}</span>
                  <span className="text-xs">
                    {displayQuotedDate(item.quotedDate)} ·{" "}
                    {formatTry(item.totalAfterTax ?? 0)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      }
    >
      {error ? (
        <p className="mb-3 text-sm text-[#8f2d1f]">{error}</p>
      ) : null}
      {loadingQuote && !quote ? (
        <p className="grid h-full place-items-center text-sm text-[var(--steel)]">
          Teklif yükleniyor…
        </p>
      ) : (
        <QuoteDocumentPanel
          key={quote?.id ?? "empty"}
          quote={quote}
          products={products}
          customers={customers}
          saving={saving}
          emptyHint={
            selectedId
              ? "Bu teklifte henüz satır yok."
              : "Soldan bir teklif seçin."
          }
          editHref={
            quote?.id
              ? `/teklif?quoteId=${encodeURIComponent(quote.id)}&edit=1`
              : undefined
          }
          onCreateVersion={() => void createVersion()}
          onSelectVersion={setSelectedId}
          onToggleConverted={() => void toggleConverted()}
        />
      )}
    </SplitWorkspace>
  );
}
