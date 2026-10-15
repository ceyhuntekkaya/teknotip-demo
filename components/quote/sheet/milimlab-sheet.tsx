"use client";

import { SheetHtml } from "@/components/quote/sheet/sheet-html";
import {
  SheetAdd,
  SheetHeadEnd,
  SheetHot,
  SheetMove,
  SheetRowEnd,
} from "@/components/quote/sheet/sheet-chrome";
import {
  bindRowEdit,
  hotZone,
  SheetAction,
  type QuoteSheetProps,
} from "@/components/quote/sheet/sheet-types";
import type { ProductResponse, QuoteLineResponse } from "@/lib/api/generated/model";
import { addDaysFormatted, formatQuoteDateSlash, formatTl } from "@/lib/pdf/format";
import { applyTermTokens, textOr } from "@/lib/pdf/html-blocks";
import { moneyUnit } from "@/lib/money";
import { milimlabTemplate } from "@/lib/pdf/milimlab-template";
import { resolveLineImageSrc } from "@/lib/pdf/product-images";
import { isManualLine } from "@/lib/quote/document-edit";
import { resolveLineDescription, textLines } from "@/lib/quote/line-text";

function Field({
  label,
  value,
  wide = false,
  action,
  onEdit,
  editTitle,
}: {
  label: string;
  value: string;
  wide?: boolean;
  action?: { title: string; onClick?: () => void };
  onEdit?: () => void;
  editTitle?: string;
}) {
  const shown = value.trim() || (onEdit ? "—" : "");
  return (
    <div className={wide ? "ml-field ml-field-wide" : "ml-field"}>
      <span className="ml-field-label">{label}: </span>
      <span className="ml-field-value">
        <SheetHot title={editTitle ?? ""} onEdit={onEdit}>
          {shown}
        </SheetHot>
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
  productsById,
  active = false,
  onAddToCatalog,
  onEdit,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
  onRemove,
}: {
  line: QuoteLineResponse;
  index: number;
  currency?: string;
  showLinePrices: boolean;
  quantityUnit: string;
  imageSrc: string | null;
  productsById?: Map<string, ProductResponse>;
  active?: boolean;
  onAddToCatalog?: () => void;
  onEdit?: () => void;
  onMove?: (direction: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onRemove?: () => void;
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
  const nameLines = textLines(line.name);
  const shownNames = nameLines.length > 0 ? nameLines : [(line.code || "—").trim()];
  const descriptionLines = textLines(resolveLineDescription(line, productsById));
  const rowEdit = bindRowEdit(onEdit);

  return (
    <div
      className={`ml-table-row${rowEdit.className ? ` ${rowEdit.className}` : ""}${active ? " sheet-row-active" : ""}`}
      onClick={rowEdit.onClick}
    >
      <span className={`ml-cell ml-col-no${onMove ? " sheet-no" : ""}`}>
        {onMove ? (
          <SheetMove canMoveUp={canMoveUp} canMoveDown={canMoveDown} onMove={onMove} />
        ) : null}
        {index}
      </span>
      <div className="ml-col-desc">
        {shownNames.map((part, nameIndex) => (
          <p
            key={`name-${nameIndex}`}
            className="ml-name"
            title={nameIndex === 0 && onEdit ? "Düzenlemek için tıklayın" : undefined}
          >
            {part || "\u00a0"}
            {nameIndex === 0 ? (
              <SheetAction title="Kataloga ekle" onClick={onAddToCatalog}>
                + Katalog
              </SheetAction>
            ) : null}
          </p>
        ))}
        {descriptionLines.map((part, descriptionIndex) => (
          <p key={`desc-${descriptionIndex}`} className="ml-line-desc">
            {part || "\u00a0"}
          </p>
        ))}
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
      <SheetRowEnd onRemove={onRemove} />
    </div>
  );
}

export function MilimlabSheet({
  quote,
  products,
  showImages,
  emptyHint,
  canSave = false,
  activeLineIndex = null,
  onSaveInstitution,
  onSaveContact,
  onAddToCatalog,
  onIntent,
}: QuoteSheetProps) {
  const { company, texts, terms } = milimlabTemplate;
  const dateIso = quote.quotedDate ?? "";
  const dateLabel = formatQuoteDateSlash(dateIso);
  const validityDays = quote.terms?.validityDays ?? terms.validityDays;
  const validityLabel = (() => {
    const raw = addDaysFormatted(dateIso, validityDays);
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
  const editDate = onIntent ? () => onIntent({ kind: "edit-date" }) : undefined;
  const editTax = onIntent ? () => onIntent({ kind: "edit-tax" }) : undefined;
  const editInstitution = onIntent ? () => onIntent({ kind: "edit-institution" }) : undefined;
  const editContact = onIntent ? () => onIntent({ kind: "edit-contact" }) : undefined;
  const editPhone = onIntent ? () => onIntent({ kind: "edit-field", field: "phone" }) : undefined;
  const editEmail = onIntent ? () => onIntent({ kind: "edit-field", field: "email" }) : undefined;
  const editAddress = onIntent ? () => onIntent({ kind: "edit-field", field: "address" }) : undefined;
  const editValidity = onIntent
    ? () => onIntent({ kind: "edit-field", field: "validity" })
    : undefined;
  const editDeliveryTime = onIntent
    ? () => onIntent({ kind: "edit-field", field: "delivery-time" })
    : undefined;
  const editDeliveryMode = onIntent
    ? () => onIntent({ kind: "edit-field", field: "delivery-mode" })
    : undefined;
  const editCommercial = onIntent
    ? () => onIntent({ kind: "edit-field", field: "commercial" })
    : undefined;
  const editPayment = onIntent
    ? () => onIntent({ kind: "edit-field", field: "payment-terms" })
    : undefined;
  const editProvisions = onIntent
    ? () => onIntent({ kind: "edit-field", field: "provisions" })
    : undefined;
  const validityHot = hotZone(editValidity, "Geçerliliği düzenlemek için tıklayın");
  const provisionsHot = hotZone(editProvisions, "Genel hükümleri düzenlemek için tıklayın");
  const currencyHot = hotZone(
    onIntent ? () => onIntent({ kind: "edit-field", field: "currency" }) : undefined,
    "Para birimini değiştirmek için tıklayın",
  );

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
          <div
            className={`ml-meta-row${editDate ? " sheet-hot" : ""}`}
            title={editDate ? "Tarihi düzenlemek için tıklayın" : undefined}
            onClick={
              editDate
                ? (event) => {
                    event.preventDefault();
                    editDate();
                  }
                : undefined
            }
          >
            <span className="ml-meta-label">{texts.dateLabel}</span>
            <span className="ml-meta-colon">:</span>
            <span className="ml-meta-value">{dateLabel}</span>
          </div>
          <div
            className={`ml-meta-row${validityHot.className ? ` ${validityHot.className}` : ""}`}
            title={validityHot.title}
            onClick={validityHot.onClick}
          >
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
            onEdit={editInstitution}
            editTitle="Kurumu düzenlemek için tıklayın"
          />
          <Field
            label={texts.phoneLabel}
            value={quoted.phone?.trim() || ""}
            onEdit={editPhone}
            editTitle="Telefonu düzenlemek için tıklayın"
          />
          <Field
            label={texts.emailLabel}
            value={quoted.email?.trim() || ""}
            onEdit={editEmail}
            editTitle="E-postayı düzenlemek için tıklayın"
          />
        </div>
        <div className="ml-recipient-row">
          <Field
            label={texts.addressLabel}
            value={quoted.address?.trim() || ""}
            wide
            onEdit={editAddress}
            editTitle="Adresi düzenlemek için tıklayın"
          />
          <Field label={texts.faxLabel} value="" />
          <Field
            label={texts.contactLabel}
            value={contact}
            action={
              showContactSave ? { title: "Kişiyi kaydet", onClick: onSaveContact } : undefined
            }
            onEdit={editContact}
            editTitle="Yetkili kişiyi düzenlemek için tıklayın"
          />
        </div>
      </div>

      <div className="ml-table-head">
        {onIntent ? <SheetAdd onClick={(anchor) => onIntent({ kind: "add", anchor })} /> : null}
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
        <SheetHeadEnd active={Boolean(onIntent)} />
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
            productsById={productsById}
            active={activeLineIndex === index}
            onAddToCatalog={
              isManualLine(line) && onAddToCatalog ? () => onAddToCatalog(line, index) : undefined
            }
            onEdit={onIntent ? () => onIntent({ kind: "edit-line", index }) : undefined}
            onMove={
              onIntent
                ? (direction) => onIntent({ kind: "move-line", index, direction })
                : undefined
            }
            canMoveUp={index > 0}
            canMoveDown={index < lines.length - 1}
            onRemove={onIntent ? () => onIntent({ kind: "delete-line", index }) : undefined}
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
            <span className="ml-total-label">
              <SheetHot title="KDV oranını değiştirmek için tıklayın" onEdit={editTax}>
                {texts.totals.tax}
              </SheetHot>
            </span>
            <span className="ml-total-value">{formatTl(quote.priceSummary?.tax ?? 0, currency)}</span>
          </div>
          <div className="ml-total-row">
            <span className="ml-total-label">{texts.totals.grand}</span>
            <span className="ml-total-value">
              {formatTl(quote.priceSummary?.totalAfterTax ?? 0, currency)}
            </span>
          </div>
          <div
            className={`ml-total-row${currencyHot.className ? ` ${currencyHot.className}` : ""}`}
            title={currencyHot.title}
            onClick={currencyHot.onClick}
          >
            <span className="ml-total-label">PB :</span>
            <span className="ml-total-value">{moneyUnit(currency).label}</span>
          </div>
        </div>
      ) : null}

      <h3 className="ml-section-title">{texts.deliveryTitle}</h3>
      <div className="ml-section-row">
        <span className="ml-section-label">{texts.deliveryTimeLabel}</span>
        <span className="ml-section-colon">:</span>
        <span className="ml-section-value">
          <SheetHot title="Teslimat süresini düzenlemek için tıklayın" onEdit={editDeliveryTime}>
            {deliveryTime}
          </SheetHot>
        </span>
      </div>
      <div className="ml-section-row">
        <span className="ml-section-label">{texts.deliveryModeLabel}</span>
        <span className="ml-section-colon">:</span>
        <span className="ml-section-value">
          <SheetHot title="Teslimat şeklini düzenlemek için tıklayın" onEdit={editDeliveryMode}>
            {deliveryMode}
          </SheetHot>
        </span>
      </div>

      <h3 className="ml-section-title">{texts.commercialTitle}</h3>
      <p className="ml-body">
        <SheetHot title="Ticari koşulları düzenlemek için tıklayın" onEdit={editCommercial}>
          {commercialBody}
        </SheetHot>
      </p>

      <h3 className="ml-section-title">{texts.paymentTitle}</h3>
      <p className="ml-body">
        <SheetHot title="Ödeme koşulunu düzenlemek için tıklayın" onEdit={editPayment}>
          {paymentBody}
        </SheetHot>
      </p>

      <h3 className="ml-section-title">{texts.generalTitle}</h3>
      <div
        className={provisionsHot.className}
        title={provisionsHot.title}
        onClick={provisionsHot.onClick}
      >
        {generalProvisions ? (
          <SheetHtml className="ml-html" html={generalProvisions} />
        ) : (
          texts.notes.map((note) => (
            <p key={note.slice(0, 48)} className="ml-note">
              {note}
            </p>
          ))
        )}
      </div>
    </article>
  );
}
