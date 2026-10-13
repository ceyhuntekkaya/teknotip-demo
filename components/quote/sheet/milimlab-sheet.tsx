"use client";

import { SheetHtml } from "@/components/quote/sheet/sheet-html";
import { SheetAction, type QuoteSheetProps } from "@/components/quote/sheet/sheet-types";
import type { QuoteLineResponse } from "@/lib/api/generated/model";
import { addDaysFormatted, formatQuoteDateSlash, formatTl } from "@/lib/pdf/format";
import { applyTermTokens, textOr } from "@/lib/pdf/html-blocks";
import { milimlabTemplate } from "@/lib/pdf/milimlab-template";
import { resolveLineImageSrc } from "@/lib/pdf/product-images";
import { isManualLine } from "@/lib/quote/document-edit";

function Field({
  label,
  value,
  wide = false,
  action,
}: {
  label: string;
  value: string;
  wide?: boolean;
  action?: { title: string; onClick?: () => void };
}) {
  return (
    <div className={wide ? "ml-field ml-field-wide" : "ml-field"}>
      <span className="ml-field-label">{label}: </span>
      <span className="ml-field-value">
        {value}
        {action ? (
          <SheetAction title={action.title} onClick={action.onClick}>
            + Kaydet
          </SheetAction>
        ) : null}
      </span>
    </div>
  );
}

function ProductRow({
  line,
  index,
  currency,
  showLinePrices,
  quantityUnit,
  imageSrc,
  onAddToCatalog,
}: {
  line: QuoteLineResponse;
  index: number;
  currency?: string;
  showLinePrices: boolean;
  quantityUnit: string;
  imageSrc: string | null;
  onAddToCatalog?: () => void;
}) {
  const specs = [
    ...(line.properties ?? [])
      .filter((property) => property.name && property.values)
      .map((property) => `${property.name}: ${property.values}`),
    ...(line.accessories ?? []).map((accessory) => {
      const qty = accessory.quantity && accessory.quantity > 1 ? ` x${accessory.quantity}` : "";
      return `${accessory.name}${qty}`;
    }),
  ];
  const qty = line.quantity ?? 1;
  const unit = line.price ?? 0;
  const subtotal = unit * qty;
  const title = (line.name || line.code || "—").trim();

  return (
    <div className="ml-table-row">
      <span className="ml-cell ml-col-no">{index}</span>
      <div className="ml-col-desc">
        <p className="ml-name">
          {title}
          <SheetAction title="Kataloga ekle" onClick={onAddToCatalog}>
            + Katalog
          </SheetAction>
        </p>
        {specs.map((item) => (
          <p key={item} className="ml-spec">
            {item}
          </p>
        ))}
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt="" className="ml-product-image" />
        ) : null}
      </div>
      {showLinePrices ? (
        <>
          <span className="ml-cell ml-col-unit">{formatTl(unit, currency)}</span>
          <span className="ml-cell ml-col-qty">
            {qty} {quantityUnit}
          </span>
          <span className="ml-cell ml-col-sub">{formatTl(subtotal, currency)}</span>
          <span className="ml-cell ml-col-disc">{formatTl(0, currency)}</span>
          <span className="ml-cell ml-col-total">
            {formatTl(line.lineTotal ?? subtotal, currency)}
          </span>
        </>
      ) : (
        <span className="ml-cell ml-col-qty">
          {qty} {quantityUnit}
        </span>
      )}
    </div>
  );
}

export function MilimlabSheet({
  quote,
  products,
  showImages,
  emptyHint,
  canSave = false,
  onSaveInstitution,
  onSaveContact,
  onAddToCatalog,
}: QuoteSheetProps) {
  const { company, texts, terms } = milimlabTemplate;
  const dateIso = quote.quotedDate ?? "";
  const dateLabel = formatQuoteDateSlash(dateIso);
  const validityLabel = (() => {
    const raw = addDaysFormatted(dateIso, terms.validityDays);
    const parts = raw.split(".");
    if (parts.length !== 3) return raw;
    const [day, month, year] = parts;
    return `${day.padStart(2, "0")}.${month.padStart(2, "0")}.${year}`;
  })();
  const quoted = quote.quotedTo ?? {};
  const lines = quote.lines ?? [];
  const showLinePrices = quote.priceDetails !== false;
  const currency = quote.currency;
  const taxRate = quote.priceSummary?.taxRatePercent ?? 20;
  const deliveryTime = textOr(quote.terms?.deliveryTime, texts.deliveryTime);
  const deliveryMode = textOr(quote.terms?.deliveryMode, texts.deliveryMode);
  const commercialBody = applyTermTokens(
    textOr(quote.terms?.commercialTerms, texts.commercialBody),
    { rate: String(taxRate) },
  );
  const paymentBody = textOr(quote.terms?.paymentTerms, texts.paymentBody);
  const generalProvisions = textOr(quote.terms?.generalProvisions, "");
  const contact = [quoted.contactPerson, quoted.department].filter(Boolean).join(" / ");
  const productsById = new Map(
    products.filter((product) => product.id).map((product) => [product.id as string, product]),
  );
  const showInstitutionSave = canSave && !!quoted.institution?.trim() && !quoted.institutionId;
  const showContactSave = canSave && !!contact.trim() && !quoted.customerId;

  return (
    <article className="quote-page ml-page">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={company.logo} alt="" className="ml-logo" />

      <div className="ml-info">
        <div className="ml-company">
          <h2>{company.legalNameLines.join(" ")}</h2>
          <div className="ml-company-grid">
            <div className="ml-company-col">
              {company.addressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>
                {company.taxOffice} {company.taxNumber}
              </p>
            </div>
            <div className="ml-company-col">
              <p>Mersis No:{company.mersis}</p>
              <p>Tic.Sic.No:{company.tradeRegistry}</p>
            </div>
            <div className="ml-company-col">
              <p>T: {company.phone}</p>
              <p>F: {company.fax}</p>
              <p>{company.email}</p>
              <p>{company.web}</p>
            </div>
          </div>
        </div>
        <div className="ml-meta">
          <div className="ml-meta-row">
            <span className="ml-meta-label">{texts.quoteNoLabel}</span>
            <span className="ml-meta-colon">:</span>
            <span className="ml-meta-value">{quote.quoteNumber?.trim() || "—"}</span>
          </div>
          <div className="ml-meta-row">
            <span className="ml-meta-label">{texts.dateLabel}</span>
            <span className="ml-meta-colon">:</span>
            <span className="ml-meta-value">{dateLabel}</span>
          </div>
          <div className="ml-meta-row">
            <span className="ml-meta-label">{texts.validityLabel}</span>
            <span className="ml-meta-colon">:</span>
            <span className="ml-meta-value">
              {validityLabel} {texts.validitySuffix}
            </span>
          </div>
        </div>
      </div>

      <div className="ml-recipient">
        <div className="ml-recipient-row">
          <Field
            label={texts.institutionLabel}
            value={quoted.institution?.trim() || ""}
            wide
            action={
              showInstitutionSave
                ? { title: "Kurumu kaydet", onClick: onSaveInstitution }
                : undefined
            }
          />
          <Field label={texts.phoneLabel} value={quoted.phone?.trim() || ""} />
          <Field label={texts.emailLabel} value={quoted.email?.trim() || ""} />
        </div>
        <div className="ml-recipient-row">
          <Field label={texts.addressLabel} value={quoted.address?.trim() || ""} wide />
          <Field label={texts.faxLabel} value="" />
          <Field
            label={texts.contactLabel}
            value={contact}
            action={
              showContactSave ? { title: "Kişiyi kaydet", onClick: onSaveContact } : undefined
            }
          />
        </div>
      </div>

      <div className="ml-table-head">
        <span className="ml-col-no">{texts.table.no}</span>
        <span className="ml-col-desc">{texts.table.description}</span>
        {showLinePrices ? (
          <>
            <span className="ml-col-unit">{texts.table.unitPrice}</span>
            <span className="ml-col-qty">{texts.table.quantity}</span>
            <span className="ml-col-sub">{texts.table.subtotal}</span>
            <span className="ml-col-disc">{texts.table.discount}</span>
            <span className="ml-col-total">{texts.table.total}</span>
          </>
        ) : (
          <span className="ml-col-qty">{texts.table.quantity}</span>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="sheet-empty">{emptyHint}</p>
      ) : (
        lines.map((line, index) => (
          <ProductRow
            key={line.id ?? `line-${index}`}
            line={line}
            index={index + 1}
            currency={currency}
            showLinePrices={showLinePrices}
            quantityUnit={texts.quantityUnit}
            imageSrc={showImages ? resolveLineImageSrc(line, productsById) : null}
            onAddToCatalog={
              isManualLine(line) && onAddToCatalog ? () => onAddToCatalog(line, index) : undefined
            }
          />
        ))
      )}

      {showLinePrices ? (
        <div className="ml-totals">
          <div className="ml-total-row">
            <span className="ml-total-label">{texts.totals.subtotal}</span>
            <span className="ml-total-value">
              {formatTl(quote.priceSummary?.totalAfterDiscount ?? 0, currency)}
            </span>
          </div>
          <div className="ml-total-row">
            <span className="ml-total-label">{texts.totals.tax}</span>
            <span className="ml-total-value">{formatTl(quote.priceSummary?.tax ?? 0, currency)}</span>
          </div>
          <div className="ml-total-row">
            <span className="ml-total-label">{texts.totals.grand}</span>
            <span className="ml-total-value">
              {formatTl(quote.priceSummary?.totalAfterTax ?? 0, currency)}
            </span>
          </div>
        </div>
      ) : null}

      <h3 className="ml-section-title">{texts.deliveryTitle}</h3>
      <div className="ml-section-row">
        <span className="ml-section-label">{texts.deliveryTimeLabel}</span>
        <span className="ml-section-colon">:</span>
        <span className="ml-section-value">{deliveryTime}</span>
      </div>
      <div className="ml-section-row">
        <span className="ml-section-label">{texts.deliveryModeLabel}</span>
        <span className="ml-section-colon">:</span>
        <span className="ml-section-value">{deliveryMode}</span>
      </div>

      <h3 className="ml-section-title">{texts.commercialTitle}</h3>
      <p className="ml-body">{commercialBody}</p>

      <h3 className="ml-section-title">{texts.paymentTitle}</h3>
      <p className="ml-body">{paymentBody}</p>

      <h3 className="ml-section-title">{texts.generalTitle}</h3>
      {generalProvisions ? (
        <SheetHtml className="ml-html" html={generalProvisions} />
      ) : (
        texts.notes.map((note) => (
          <p key={note.slice(0, 48)} className="ml-note">
            {note}
          </p>
        ))
      )}
    </article>
  );
}
