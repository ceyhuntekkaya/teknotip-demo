"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBrand } from "@/components/brand/brand-provider";
import { SplitWorkspace } from "@/components/layout/split-workspace";
import { ActionButton, TextInput } from "@/components/catalog/fields";
import { QuoteDocumentPanel } from "@/components/quote/quote-document-panel";
import { apiErrorMessage, isSuccessStatus } from "@/lib/api/errors";
import {
  createQuoteVersion,
  deleteQuote,
  getQuoteById,
  listQuotes,
  setQuoteConverted,
  updateQuote,
} from "@/lib/api/generated/endpoints/quotes/quotes";
import type {
  CustomerResponse,
  InstitutionResponse,
  ProductResponse,
  QuoteResponse,
  QuoteSummaryResponse,
} from "@/lib/api/generated/model";
import { quoteToRequest } from "@/lib/api/map";
import { DEFAULT_BRAND, isBrandId, type BrandId } from "@/lib/brand/brands";
import { formatTry } from "@/lib/catalog/price";
import {
  downloadQuotesExcel,
  fetchAllQuoteSummaries,
} from "@/lib/export/quote-excel";
import { displayQuotedDate } from "@/lib/pdf/format";
import { isQuoteActionReady } from "@/lib/quote/action-ready";
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
    brand: quote.brand,
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
  institutions,
}: {
  initialQuotes: QuoteSummaryResponse[];
  products: ProductResponse[];
  customers: CustomerResponse[];
  institutions: InstitutionResponse[];
}) {
  const router = useRouter();
  const { setBrand } = useBrand();
  const [quotes, setQuotes] = useState(initialQuotes);
  const [query, setQuery] = useState("");
  const [listing, setListing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialQuotes[0]?.id ?? null,
  );
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const quoteRef = useRef<QuoteResponse | null>(null);
  const requestId = useRef(0);
  const skipInitialList = useRef(true);
  quoteRef.current = quote;

  const applyLoadedQuote = useCallback(
    (next: QuoteResponse) => {
      setQuote(next);
      quoteRef.current = next;
      const nextBrand = isBrandId(next.brand) ? next.brand : DEFAULT_BRAND;
      setBrand(nextBrand, { silent: true });
    },
    [setBrand],
  );

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
      applyLoadedQuote(response.data);
    } catch {
      if (ticket !== requestId.current) return;
      setQuote(null);
      setError("Teklif yüklenemedi.");
    } finally {
      if (ticket === requestId.current) setLoadingQuote(false);
    }
  }, [applyLoadedQuote]);

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
    quoteRef.current = next;
    setQuotes((current) => current.map((item) => patchSummary(item, next)));
  };

  const persistQuote = useCallback(async (next: QuoteResponse) => {
    if (!next.id) return;
    setSaving(true);
    setError(null);
    try {
      const response = await updateQuote(next.id, quoteToRequest(next));
      if (response.status !== 200) {
        setError(apiErrorMessage(response.data, "Teklif kaydedilemedi."));
        return;
      }
      applyQuote(response.data);
    } catch {
      setError("Teklif kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    const onBrandChange = (event: Event) => {
      const nextBrand = (event as CustomEvent<BrandId>).detail;
      if (!isBrandId(nextBrand)) return;
      const current = quoteRef.current;
      if (!current || current.brand === nextBrand) return;
      void persistQuote({ ...current, brand: nextBrand });
    };
    window.addEventListener("teknotip:brand-change", onBrandChange);
    return () => {
      window.removeEventListener("teknotip:brand-change", onBrandChange);
    };
  }, [persistQuote]);

  const createVersion = async () => {
    if (!quote?.id || !isQuoteActionReady(quote)) return;
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
    if (!quote.convertedToSale && !isQuoteActionReady(quote)) return;
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

  const remove = async () => {
    if (!selectedId) return;
    if (!window.confirm("Bu teklifi silmek istiyor musunuz?")) return;
    setSaving(true);
    setError(null);
    try {
      const response = await deleteQuote(selectedId);
      if (!isSuccessStatus(response.status)) {
        setError(apiErrorMessage(response.data, "Teklif silinemedi."));
        return;
      }
      const remaining = quotes.filter((item) => item.id !== selectedId);
      setQuotes(remaining);
      setQuote(null);
      setSelectedId(remaining[0]?.id ?? null);
    } catch {
      setError("Teklif silinemedi.");
    } finally {
      setSaving(false);
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    setError(null);
    try {
      const all = await fetchAllQuoteSummaries();
      await downloadQuotesExcel(all);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Excel indirilemedi.",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <SplitWorkspace
      section="Teklifler"
      title="Kayıtlar"
      listWidthClassName="lg:w-72"
      detailClassName="overflow-hidden p-3 lg:p-4"
      actions={
        <ActionButton
          disabled={exporting}
          onClick={() => void exportExcel()}
        >
          {exporting ? "Excel…" : "Excel"}
        </ActionButton>
      }
      listHeader={
        <div className="grid gap-2 border-b border-[var(--rule)] px-4 py-3">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
            Liste
          </p>
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Numara, kurum veya yetkili"
            aria-label="Numara, kurum veya yetkili"
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
          institutions={institutions}
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
          onChange={(next) => {
            applyQuote(next);
            void persistQuote(next);
          }}
          onCreateVersion={() => void createVersion()}
          onSelectVersion={setSelectedId}
          onToggleConverted={() => void toggleConverted()}
          onDelete={selectedId ? () => void remove() : undefined}
        />
      )}
    </SplitWorkspace>
  );
}
