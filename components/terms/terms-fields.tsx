"use client";

import { HtmlEditor } from "@/components/html/html-editor";
import { Field, NumberInput, TextArea, TextInput } from "@/components/catalog/fields";
import type { QuoteBrand, QuoteTerms } from "@/lib/api/generated/model";

function patch(terms: QuoteTerms, onChange: (next: QuoteTerms) => void, next: QuoteTerms) {
  onChange({ ...terms, ...next });
}

export function TermsFields({
  brand,
  terms,
  onChange,
}: {
  brand: QuoteBrand;
  terms: QuoteTerms;
  onChange: (next: QuoteTerms) => void;
}) {
  if (brand === "TEKNOTIP") {
    return (
      <div className="grid gap-4">
        <Field label="Geçerlilik (gün)">
          <NumberInput
            min={0}
            max={3650}
            value={terms.validityDays ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              patch(terms, onChange, {
                validityDays: raw === "" ? undefined : Number(raw),
              });
            }}
          />
        </Field>
        <Field label="Genel satış koşulları">
          <HtmlEditor
            value={terms.salesConditions ?? ""}
            onChange={(salesConditions) => patch(terms, onChange, { salesConditions })}
          />
          <p className="text-xs text-[var(--steel)]">
            {"{rate}"} teklifin KDV oranı, {"{date}"} geçerlilik gününden hesaplanan tarihtir.
          </p>
        </Field>
      </div>
    );
  }

  if (brand === "OPTOSENSE") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Delivery terms">
          <TextInput
            value={terms.delivery ?? ""}
            onChange={(event) => patch(terms, onChange, { delivery: event.target.value })}
          />
        </Field>
        <Field label="Payment terms">
          <TextArea
            value={terms.payment ?? ""}
            onChange={(event) => patch(terms, onChange, { payment: event.target.value })}
          />
        </Field>
        <Field label="Validation">
          <TextInput
            value={terms.validation ?? ""}
            onChange={(event) => patch(terms, onChange, { validation: event.target.value })}
          />
        </Field>
        <Field label="Terms">
          <TextInput
            value={terms.tradeTerms ?? ""}
            onChange={(event) => patch(terms, onChange, { tradeTerms: event.target.value })}
          />
        </Field>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Teslimat süresi">
          <TextInput
            value={terms.deliveryTime ?? ""}
            onChange={(event) => patch(terms, onChange, { deliveryTime: event.target.value })}
          />
        </Field>
        <Field label="Teslimat şekli">
          <TextInput
            value={terms.deliveryMode ?? ""}
            onChange={(event) => patch(terms, onChange, { deliveryMode: event.target.value })}
          />
        </Field>
        <Field label="Ticari koşullar">
          <TextInput
            value={terms.commercialTerms ?? ""}
            onChange={(event) => patch(terms, onChange, { commercialTerms: event.target.value })}
          />
        </Field>
        <Field label="Ödeme koşulu">
          <TextInput
            value={terms.paymentTerms ?? ""}
            onChange={(event) => patch(terms, onChange, { paymentTerms: event.target.value })}
          />
        </Field>
      </div>
      <p className="text-xs text-[var(--steel)]">
        Ticari koşullarda {"{rate}"} teklifin KDV oranıyla değişir.
      </p>
      <Field label="Genel hükümler">
        <HtmlEditor
          value={terms.generalProvisions ?? ""}
          onChange={(generalProvisions) => patch(terms, onChange, { generalProvisions })}
        />
      </Field>
    </div>
  );
}
