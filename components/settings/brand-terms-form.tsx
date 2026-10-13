"use client";

import { useState } from "react";
import { ActionButton } from "@/components/catalog/fields";
import { TermsFields } from "@/components/terms/terms-fields";
import { BRANDS, type BrandId } from "@/lib/brand/brands";
import { apiErrorMessage, isSuccessStatus } from "@/lib/api/errors";
import {
  updateBrandTerms,
  type BrandTerms,
  type BrandTermsInput,
} from "@/lib/api/settings";

function toInput(terms: BrandTerms): BrandTermsInput {
  return {
    salesConditions: terms.salesConditions,
    validityDays: terms.validityDays,
    delivery: terms.delivery,
    payment: terms.payment,
    validation: terms.validation,
    tradeTerms: terms.tradeTerms,
    deliveryTime: terms.deliveryTime,
    deliveryMode: terms.deliveryMode,
    commercialTerms: terms.commercialTerms,
    paymentTerms: terms.paymentTerms,
    generalProvisions: terms.generalProvisions,
  };
}

export function BrandTermsForm({ initial }: { initial: BrandTerms[] }) {
  const [drafts, setDrafts] = useState(initial);
  const [brand, setBrand] = useState<BrandId>("TEKNOTIP");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = drafts.find((item) => item.brand === brand) ?? { brand };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await updateBrandTerms(brand, toInput(current));
      if (!isSuccessStatus(response.status)) {
        setError(apiErrorMessage(response.data, "Koşullar kaydedilemedi."));
        return;
      }
      const saved = response.data;
      if (!saved || typeof saved !== "object" || !("brand" in saved)) {
        setError("Koşullar kaydedilemedi.");
        return;
      }
      setDrafts((items) => items.map((item) => (item.brand === brand ? (saved as BrandTerms) : item)));
      setMessage("Kaydedildi. Yeni teklifler bu metni alır; kayıtlı teklifler değişmez.");
    } catch {
      setError("Koşullar kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-5">
      <div className="flex flex-wrap gap-1">
        {BRANDS.map((item) => {
          const active = item.id === brand;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setBrand(item.id);
                setMessage(null);
                setError(null);
              }}
              className={`inline-flex h-9 items-center border px-3 font-display text-[13px] uppercase tracking-[0.12em] ${
                active
                  ? "border-[var(--heat)] text-[var(--charcoal)]"
                  : "border-[var(--rule)] text-[var(--steel)] hover:text-[var(--charcoal)]"
              }`}
            >
              {item.displayName}
            </button>
          );
        })}
      </div>

      <TermsFields
        brand={brand}
        terms={current}
        onChange={(terms) => {
          setMessage(null);
          setDrafts((items) =>
            items.map((item) => (item.brand === brand ? { ...item, ...terms, brand } : item)),
          );
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <ActionButton tone="heat" disabled={saving} onClick={() => void save()}>
          {saving ? "Kaydediliyor" : "Kaydet"}
        </ActionButton>
        {message ? <p className="text-sm text-[var(--charcoal)]">{message}</p> : null}
        {error ? <p className="text-sm text-[#8f2d1f]">{error}</p> : null}
      </div>
    </div>
  );
}
