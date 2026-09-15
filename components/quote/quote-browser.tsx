"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { TextInput } from "@/components/catalog/fields";
import { QuoteDocumentPanel } from "@/components/quote/quote-document-panel";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  getQuoteById,
  listQuotes,
  updateQuote,
} from "@/lib/api/generated/endpoints/quotes/quotes";
import type {
  CustomerResponse,
  ProductResponse,
  QuoteResponse,
  QuoteSummaryResponse,
} from "@/lib/api/generated/model";
import { quoteToRequest } from "@/lib/api/map";
import { formatTry } from "@/lib/catalog/price";

const PAGE_SIZE = 10;

function formatQuotedDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR");
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
  const persistTimer = useRef<number | null>(null);
  const requestId = useRef(0);
  const skipInitialList = useRef(true);

  const persistQuote = useCallback(async (next: QuoteResponse) => {
    if (!next.id) return;
    setSaving(true);
    try {
      const response = await updateQuote(next.id, quoteToRequest(next));
      if (response.status !== 200) {
        setError(apiErrorMessage(response.data, "Teklif kaydedilemedi."));
        return;
      }
      setQuote(response.data);
      setQuotes((current) =>
        current.map((item) =>
          item.id === response.data.id
            ? {
                ...item,
                quoteNumber: response.data.quoteNumber,
                quotedDate: response.data.quotedDate,
                institution: response.data.quotedTo?.institution,
                contactPerson: response.data.quotedTo?.contactPerson,
                totalAfterTax: response.data.priceSummary?.totalAfterTax,
                versionNumber: response.data.versionNumber,
                updatedAt: response.data.updatedAt,
              }
            : item,
        ),
      );
    } catch {
      setError("Teklif kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }, []);

  const schedulePersist = (next: QuoteResponse) => {
    setQuote(next);
    if (persistTimer.current) window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      void persistQuote(next);
    }, 600);
  };

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

  useEffect(() => {
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
    };
  }, []);

  return (
    <div className="grid h-full min-h-0 flex-1 grid-rows-[auto_1fr] overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] px-5 py-3">
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
            TeknoTip · Teklifler
          </p>
          <h1 className="font-display text-2xl leading-none tracking-wide">Kayıtlar</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          <Link
            href="/products"
            className="inline-flex h-9 items-center px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--steel)] hover:text-[var(--charcoal)]"
          >
            Katalog
          </Link>
          <Link
            href="/musteriler"
            className="inline-flex h-9 items-center px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--steel)] hover:text-[var(--charcoal)]"
          >
            Müşteriler
          </Link>
          <Link
            href="/teklif"
            className="inline-flex h-9 items-center px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--steel)] hover:text-[var(--charcoal)]"
          >
            Teklif
          </Link>
          <LogoutButton />
        </nav>
      </header>

      <div className="grid min-h-0 grid-cols-1 lg:grid-cols-[18rem_1fr]">
        <aside className="flex min-h-0 flex-col border-b border-[var(--rule)] lg:border-b-0 lg:border-r">
          <div className="grid shrink-0 gap-2 border-b border-[var(--rule)] px-4 py-3">
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
          <ul className="min-h-0 flex-1 overflow-y-auto">
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
                    <span className="font-mono text-xs">{item.quoteNumber || "—"}</span>
                    <span>{item.institution || item.contactPerson || "Müşteri yok"}</span>
                    <span className="text-xs">
                      {formatQuotedDate(item.quotedDate)} ·{" "}
                      {formatTry(item.totalAfterTax ?? 0)}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className="min-h-0 overflow-hidden p-3 lg:p-4">
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
              onChange={schedulePersist}
            />
          )}
        </section>
      </div>
    </div>
  );
}
