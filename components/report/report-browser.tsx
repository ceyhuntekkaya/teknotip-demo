"use client";

import { useEffect, useState } from "react";
import {
  ActionButton,
  Field,
  Select,
  TextInput,
} from "@/components/catalog/fields";
import { AppHeader } from "@/components/layout/app-header";
import { apiErrorMessage } from "@/lib/api/errors";
import { getQuoteReport } from "@/lib/api/generated/endpoints/quotes/quotes";
import type {
  CustomerResponse,
  InstitutionResponse,
  ProductResponse,
  QuoteBrand,
  QuoteReportProductResponse,
  QuoteReportStatsResponse,
  QuoteSummaryResponse,
} from "@/lib/api/generated/model";
import { BRANDS, brandLabel, isBrandId } from "@/lib/brand/brands";
import { formatTry } from "@/lib/catalog/price";
import { customerLabel } from "@/lib/customer/display";
import { downloadReportExcel } from "@/lib/export/quote-excel";
import { displayQuotedDate } from "@/lib/pdf/format";

type ConvertedFilter = "all" | "open" | "converted";
type ViewMode = "quotes" | "products";
type BrandFilter = "" | QuoteBrand;

const EMPTY_STATS: QuoteReportStatsResponse = {
  quoteCount: 0,
  convertedQuoteCount: 0,
  totalAmount: 0,
  convertedAmount: 0,
};

export function ReportBrowser({
  products,
  customers,
  institutions,
}: {
  products: ProductResponse[];
  customers: CustomerResponse[];
  institutions: InstitutionResponse[];
}) {
  const [institutionId, setInstitutionId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [productId, setProductId] = useState("");
  const [brand, setBrand] = useState<BrandFilter>("");
  const [converted, setConverted] = useState<ConvertedFilter>("all");
  const [view, setView] = useState<ViewMode>("quotes");
  const [quotes, setQuotes] = useState<QuoteSummaryResponse[]>([]);
  const [productRows, setProductRows] = useState<QuoteReportProductResponse[]>([]);
  const [stats, setStats] = useState<QuoteReportStatsResponse>(EMPTY_STATS);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasActiveFilter = Boolean(
    institutionId ||
      customerId ||
      query.trim() ||
      from ||
      to ||
      productId ||
      brand ||
      converted !== "all",
  );

  useEffect(() => {
    if (!hasActiveFilter) {
      setQuotes([]);
      setProductRows([]);
      setStats(EMPTY_STATS);
      setLoading(false);
      setError(null);
      return;
    }

    const handle = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await getQuoteReport({
            customerId: customerId || undefined,
            institutionId: institutionId || undefined,
            q: query.trim() || undefined,
            from: from || undefined,
            to: to || undefined,
            productId: productId || undefined,
            brand: brand || undefined,
            converted:
              converted === "all" ? undefined : converted === "converted",
          });
          if (response.status !== 200) {
            setError(apiErrorMessage(response.data, "Rapor yüklenemedi."));
            return;
          }
          setQuotes(response.data.quotes ?? []);
          setProductRows(response.data.products ?? []);
          setStats(response.data.stats ?? EMPTY_STATS);
        } catch {
          setError("Rapor yüklenemedi.");
        } finally {
          setLoading(false);
        }
      })();
    }, 300);
    return () => window.clearTimeout(handle);
  }, [
    hasActiveFilter,
    customerId,
    institutionId,
    query,
    from,
    to,
    productId,
    brand,
    converted,
  ]);

  const contactOptions = institutionId
    ? customers.filter((customer) => customer.institution?.id === institutionId)
    : customers;

  const exportExcel = async () => {
    setExporting(true);
    setError(null);
    try {
      await downloadReportExcel({ quotes, products: productRows, stats });
    } catch {
      setError("Excel indirilemedi.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader
        section="Raporlar"
        title="Özet"
        actions={
          <ActionButton
            disabled={exporting || !hasActiveFilter}
            onClick={() => void exportExcel()}
          >
            {exporting ? "Excel…" : "Excel"}
          </ActionButton>
        }
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
        <section className="grid gap-3 border border-[var(--rule)] bg-[var(--paper)] p-4 lg:grid-cols-4">
          <Field label="Kurum">
            <Select
              value={institutionId}
              onChange={(event) => {
                setInstitutionId(event.target.value);
                setCustomerId("");
              }}
            >
              <option value="">Tümü</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="İrtibat kişisi">
            <Select
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              <option value="">Tümü</option>
              {contactOptions.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customerLabel(customer)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Müşteri yaz">
            <TextInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Kurum veya yetkili"
            />
          </Field>
          <Field label="Ürün">
            <Select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              <option value="">Tümü</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.code} · {product.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Marka">
            <Select
              value={brand}
              onChange={(event) => {
                const value = event.target.value;
                setBrand(isBrandId(value) ? value : "");
              }}
            >
              <option value="">Tümü</option>
              {BRANDS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Başlangıç">
            <TextInput
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </Field>
          <Field label="Bitiş">
            <TextInput
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </Field>
          <div className="grid gap-1.5 lg:col-span-2">
            <span className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
              Durum
            </span>
            <div className="flex flex-wrap gap-2">
              <FilterButton
                active={converted === "open"}
                onClick={() => setConverted("open")}
              >
                Teklifler
              </FilterButton>
              <FilterButton
                active={converted === "converted"}
                onClick={() => setConverted("converted")}
              >
                Satışa Dönüşenler
              </FilterButton>
              <FilterButton
                active={converted === "all"}
                onClick={() => setConverted("all")}
              >
                Tümü
              </FilterButton>
            </div>
          </div>
          <div className="grid gap-1.5">
            <span className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
              Görünüm
            </span>
            <div className="flex flex-wrap gap-2">
              <FilterButton
                active={view === "quotes"}
                onClick={() => setView("quotes")}
              >
                Teklif Bazlı
              </FilterButton>
              <FilterButton
                active={view === "products"}
                onClick={() => setView("products")}
              >
                Ürün Bazlı
              </FilterButton>
            </div>
          </div>
        </section>

        {error ? <p className="text-sm text-[#8f2d1f]">{error}</p> : null}

        {!hasActiveFilter ? (
          <p className="border border-dashed border-[var(--rule)] px-4 py-10 text-center text-sm text-[var(--steel)]">
            Raporu görmek için en az bir filtre seçin.
          </p>
        ) : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatBox
                label="Toplam tutar"
                value={formatTry(stats.totalAmount ?? 0)}
              />
              <StatBox
                label="Satışa dönüşen tutar"
                value={formatTry(stats.convertedAmount ?? 0)}
              />
              <StatBox
                label="Teklif sayısı"
                value={String(stats.quoteCount ?? 0)}
              />
              <StatBox
                label="Satışa dönüşen teklif"
                value={String(stats.convertedQuoteCount ?? 0)}
              />
            </section>

            <p className="text-xs text-[var(--steel)]">
              {loading ? "Yükleniyor…" : `${stats.quoteCount ?? 0} teklif`}
            </p>

            {view === "quotes" ? (
              <QuoteTable quotes={quotes} />
            ) : (
              <ProductTable rows={productRows} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <ActionButton tone={active ? "heat" : "default"} onClick={onClick}>
      {children}
    </ActionButton>
  );
}

function QuoteTable({ quotes }: { quotes: QuoteSummaryResponse[] }) {
  return (
    <div className="overflow-x-auto border border-[var(--rule)] bg-[var(--paper)]">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b border-[var(--rule)] font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
          <tr>
            <th className="px-3 py-2 font-medium">Numara</th>
            <th className="px-3 py-2 font-medium">Marka</th>
            <th className="px-3 py-2 font-medium">Tarih</th>
            <th className="px-3 py-2 font-medium">Kurum</th>
            <th className="px-3 py-2 font-medium">Yetkili</th>
            <th className="px-3 py-2 text-right font-medium">Tutar (KDV dahil)</th>
            <th className="px-3 py-2 font-medium">Durum</th>
          </tr>
        </thead>
        <tbody>
          {quotes.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-[var(--steel)]">
                Kayıt yok.
              </td>
            </tr>
          ) : (
            quotes.map((item) => (
              <tr key={item.id} className="border-t border-[var(--rule)]">
                <td className="px-3 py-2 font-mono text-xs">
                  {item.quoteNumber || "—"}
                  {(item.versionNumber ?? 1) > 1 ? ` · v${item.versionNumber}` : ""}
                </td>
                <td className="px-3 py-2">{brandLabel(item.brand)}</td>
                <td className="px-3 py-2">{displayQuotedDate(item.quotedDate)}</td>
                <td className="px-3 py-2">{item.institution || "—"}</td>
                <td className="px-3 py-2">{item.contactPerson || "—"}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatTry(item.totalAfterTax ?? 0)}
                </td>
                <td className="px-3 py-2">
                  {item.convertedToSale ? "Satış" : "Teklif"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ProductTable({ rows }: { rows: QuoteReportProductResponse[] }) {
  return (
    <div className="overflow-x-auto border border-[var(--rule)] bg-[var(--paper)]">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="border-b border-[var(--rule)] font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
          <tr>
            <th className="px-3 py-2 font-medium">Ürün</th>
            <th className="px-3 py-2 text-right font-medium">Adet</th>
            <th className="px-3 py-2 text-right font-medium">
              Satır toplamı (KDV hariç)
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-3 py-8 text-center text-[var(--steel)]">
                Kayıt yok.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={row.productId ?? `${row.name}-${index}`}
                className="border-t border-[var(--rule)]"
              >
                <td className="px-3 py-2">
                  <p>{row.name || "—"}</p>
                  {row.code ? (
                    <p className="font-mono text-xs text-[var(--steel)]">{row.code}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right font-mono">{row.quantity ?? 0}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatTry(row.total ?? 0)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <article className="border border-[var(--rule)] bg-[var(--paper)] px-4 py-3">
      <p className="font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
        {label}
      </p>
      <p className="font-mono text-xl text-[var(--heat)]">{value}</p>
    </article>
  );
}
