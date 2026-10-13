"use client";

import { useState } from "react";
import { ActionButton } from "@/components/catalog/fields";
import { TermsFields } from "@/components/terms/terms-fields";
import { apiErrorMessage } from "@/lib/api/errors";
import { getBrandTerms, isBrandTermsList } from "@/lib/api/settings";
import type { QuoteResponse } from "@/lib/api/generated/model";
import { isBrandId } from "@/lib/brand/brands";
import { quoteTermsFromBrand, replaceBrandTerms } from "@/lib/quote/terms";

export function QuoteTermsFields({
  quote,
  onChange,
}: {
  quote: QuoteResponse;
  onChange: (next: QuoteResponse) => void;
}) {
  const brand = isBrandId(quote.brand) ? quote.brand : "TEKNOTIP";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDefaults = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getBrandTerms();
      if (response.status !== 200 || !isBrandTermsList(response.data)) {
        setError(apiErrorMessage(response.data, "Varsayılan koşullar yüklenemedi."));
        return;
      }
      const defaults = response.data.find((item) => item.brand === brand);
      if (!defaults) {
        setError("Varsayılan koşullar yüklenemedi.");
        return;
      }
      onChange({
        ...quote,
        terms: replaceBrandTerms(quote.terms, quoteTermsFromBrand(defaults), brand),
      });
    } catch {
      setError("Varsayılan koşullar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="font-display text-lg tracking-wide">Koşullar</h3>
        <ActionButton disabled={loading} onClick={() => void loadDefaults()}>
          {loading ? "Yükleniyor" : "Varsayılanları yükle"}
        </ActionButton>
      </div>
      <TermsFields
        brand={brand}
        terms={quote.terms ?? {}}
        onChange={(terms) => onChange({ ...quote, terms })}
      />
      {error ? <p className="text-sm text-[#8f2d1f]">{error}</p> : null}
    </section>
  );
}
