"use client";

import { SheetAction, type QuoteSheetProps } from "@/components/quote/sheet/sheet-types";
import type { QuoteLineResponse } from "@/lib/api/generated/model";
import { moneyUnit } from "@/lib/money";
import { formatQuoteDateEn, formatTl } from "@/lib/pdf/format";
import { textOr } from "@/lib/pdf/html-blocks";
import { optosenseTemplate } from "@/lib/pdf/optosense-template";
import { resolveLineImageSrc } from "@/lib/pdf/product-images";
import { isManualLine } from "@/lib/quote/document-edit";

function ProductBlock({
  line,
  index,
  currency,
  showLinePrices,
  optionLabel,
  imageSrc,
  onAddToCatalog,
}: {
  line: QuoteLineResponse;
  index: number;
  currency?: string;
  showLinePrices: boolean;
  optionLabel: string;
  imageSrc: string | null;
  onAddToCatalog?: () => void;
}) {
  const specs = (line.properties ?? [])
    .filter((property) => property.name && property.values)
    .map((property) => `${property.name}: ${property.values}`);
  const accessories = line.accessories ?? [];

  return (
    <>
      <div className="os-table-row">
        <span className="os-cell os-col-no">{index}</span>
        <span className="os-cell os-code os-col-code">{line.code || "—"}</span>
        <div className="os-col-desc">
          <p className="os-name">
            {line.name || "—"}
            <SheetAction title="Kataloga ekle" onClick={onAddToCatalog}>
              + Katalog
            </SheetAction>
          </p>
          {specs.map((item) => (
            <p key={item} className="os-spec">
              {item}
            </p>
          ))}
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageSrc} alt="" className="os-product-image" />
          ) : null}
        </div>
        <span className="os-cell os-col-qty">{line.quantity ?? 1}</span>
        {showLinePrices ? (
          <>
            <span className="os-cell os-col-unit">{formatTl(line.price ?? 0, currency)}</span>
            <span className="os-cell os-col-total">{formatTl(line.lineTotal ?? 0, currency)}</span>
          </>
        ) : null}
      </div>
      {accessories.map((accessory, accessoryIndex) => {
        const qty = accessory.quantity ?? 1;
        const unit = accessory.price ?? 0;
        return (
          <div key={`${line.id ?? index}-acc-${accessoryIndex}`} className="os-table-row">
            <span className="os-cell os-col-no" />
            <span className="os-cell os-code os-col-code">{optionLabel}</span>
            <div className="os-col-desc">
              <p className="os-name">{accessory.name || "—"}</p>
            </div>
            <span className="os-cell os-col-qty">{qty}</span>
            {showLinePrices ? (
              <>
                <span className="os-cell os-col-unit">{formatTl(unit, currency)}</span>
                <span className="os-cell os-col-total">{formatTl(unit * qty, currency)}</span>
              </>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export function OptosenseSheet({
  quote,
  products,
  showImages,
  emptyHint,
  canSave = false,
  onSaveInstitution,
  onSaveContact,
  onAddToCatalog,
}: QuoteSheetProps) {
  const { company, texts } = optosenseTemplate;
  const dateLabel = formatQuoteDateEn(quote.quotedDate ?? "");
  const quoted = quote.quotedTo ?? {};
  const lines = quote.lines ?? [];
  const showLinePrices = quote.priceDetails !== false;
  const currency = quote.currency;
  const currencyLabel = moneyUnit(currency).label;
  const priceSummary = quote.priceSummary;
  const productsById = new Map(
    products.filter((product) => product.id).map((product) => [product.id as string, product]),
  );
  const showInstitutionSave = canSave && !!quoted.institution?.trim() && !quoted.institutionId;
  const person = quoted.contactPerson?.trim() || "";
  const showContactSave = canSave && !!person && !quoted.customerId;
  const footer = [
    { title: texts.footer.deliveryTitle, body: textOr(quote.terms?.delivery, texts.footer.delivery) },
    { title: texts.footer.paymentTitle, body: textOr(quote.terms?.payment, texts.footer.payment) },
    {
      title: texts.footer.validationTitle,
      body: textOr(quote.terms?.validation, texts.footer.validation),
    },
    { title: texts.footer.termsTitle, body: textOr(quote.terms?.tradeTerms, texts.footer.terms) },
  ];

  return (
    <article className="quote-page os-page">
      <h2 className="os-title">{texts.documentTitle}</h2>
      <div className="os-header">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={company.logo} alt="" className="os-logo" />
          <p className="os-company-name">{company.legalName}</p>
          <div className="os-company">
            {company.addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        <div className="os-contact">
          <p>Phone: {company.phone}</p>
          <p>e-mail:{company.email}</p>
        </div>
      </div>

      <div className="os-recipient-row">
        <div className="os-recipient">
          <p className="os-label">{texts.nameAddressLabel}</p>
          <div className="os-attn">
            <span className="os-attn-label">{texts.attnLabel}</span>
            <p className="os-attn-value">
              {person || "—"}
              {showContactSave ? (
                <SheetAction title="Kişiyi kaydet" onClick={onSaveContact}>
                  + Kaydet
                </SheetAction>
              ) : null}
            </p>
          </div>
          <p className="os-institution">
            {quoted.institution?.trim() || "—"}
            {showInstitutionSave ? (
              <SheetAction title="Kurumu kaydet" onClick={onSaveInstitution}>
                + Kaydet
              </SheetAction>
            ) : null}
          </p>
          {quoted.address?.trim() ? <p className="os-address">{quoted.address}</p> : null}
        </div>
        <div className="os-meta">
          <div className="os-meta-row">
            <span>{texts.quoteNoLabel}</span>
            <span>{quote.quoteNumber?.trim() || "—"}</span>
          </div>
          <div className="os-meta-row">
            <span>{texts.dateLabel}</span>
            <span>{dateLabel}</span>
          </div>
        </div>
      </div>

      <div className="os-table-head">
        <span className="os-col-no">{texts.table.no}</span>
        <span className="os-col-code">{texts.table.code}</span>
        <span className="os-col-desc">{texts.table.description}</span>
        <span className="os-col-qty">{texts.table.quantity}</span>
        {showLinePrices ? (
          <>
            <span className="os-col-unit">
              {texts.table.unitPrice}
              <br />({currencyLabel})
            </span>
            <span className="os-col-total">
              {texts.table.total}
              <br />({currencyLabel})
            </span>
          </>
        ) : null}
      </div>

      {lines.length === 0 ? (
        <p className="sheet-empty">{emptyHint}</p>
      ) : (
        lines.map((line, index) => (
          <ProductBlock
            key={line.id ?? `line-${index}`}
            line={line}
            index={index + 1}
            currency={currency}
            showLinePrices={showLinePrices}
            optionLabel={texts.optionLabel}
            imageSrc={showImages ? resolveLineImageSrc(line, productsById) : null}
            onAddToCatalog={
              isManualLine(line) && onAddToCatalog ? () => onAddToCatalog(line, index) : undefined
            }
          />
        ))
      )}

      {showLinePrices ? (
        <div className="os-totals">
          <div className="os-total-row">
            <span>{texts.subtotal}</span>
            <span className="os-total-currency">{currencyLabel}</span>
            <span className="os-total-value">
              {formatTl(priceSummary?.totalAfterDiscount ?? priceSummary?.subtotal ?? 0, currency)}
            </span>
          </div>
          <div className="os-total-row">
            <span>{texts.total}</span>
            <span className="os-total-currency">{currencyLabel}</span>
            <span className="os-total-value">
              {formatTl(priceSummary?.totalAfterTax ?? 0, currency)}
            </span>
          </div>
        </div>
      ) : null}

      <div className="os-footer">
        {footer.map((column) => (
          <div key={column.title} className="os-footer-col">
            <h3>{column.title}</h3>
            <p>{column.body}</p>
          </div>
        ))}
      </div>
    </article>
  );
}
