"use client";

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
  type SheetField,
} from "@/components/quote/sheet/sheet-types";
import type { ProductResponse, QuoteLineResponse } from "@/lib/api/generated/model";
import { moneyUnit } from "@/lib/money";
import { formatQuoteDateEn, formatTl } from "@/lib/pdf/format";
import { textOr } from "@/lib/pdf/html-blocks";
import { optosenseTemplate } from "@/lib/pdf/optosense-template";
import { resolveLineImageSrc } from "@/lib/pdf/product-images";
import { isManualLine } from "@/lib/quote/document-edit";
import { resolveLineDescription, textLines } from "@/lib/quote/line-text";

function ProductBlock({
  line,
  index,
  currency,
  showLinePrices,
  optionLabel,
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
  optionLabel: string;
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
  const specs = (line.properties ?? [])
    .filter((property) => property.name && property.values)
    .map((property) => `${property.name}: ${property.values}`);
  const accessories = line.accessories ?? [];

  const nameLines = textLines(line.name);
  const shownNames = nameLines.length > 0 ? nameLines : ["—"];
  const descriptionLines = textLines(resolveLineDescription(line, productsById));
  const rowEdit = bindRowEdit(onEdit);
  const rowClass = `os-table-row${rowEdit.className ? ` ${rowEdit.className}` : ""}${active ? " sheet-row-active" : ""}`;

  return (
    <>
      <div className={rowClass} onClick={rowEdit.onClick}>
        <span className={`os-cell os-col-no${onMove ? " sheet-no" : ""}`}>
          {onMove ? (
            <SheetMove canMoveUp={canMoveUp} canMoveDown={canMoveDown} onMove={onMove} />
          ) : null}
          {index}
        </span>
        <span className="os-cell os-code os-col-code">{line.code || "—"}</span>
        <div className="os-col-desc">
          {shownNames.map((part, nameIndex) => (
            <p
              key={`name-${nameIndex}`}
              className="os-name"
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
            <p key={`desc-${descriptionIndex}`} className="os-line-desc">
              {part || "\u00a0"}
            </p>
          ))}
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
        <SheetRowEnd onRemove={onRemove} />
      </div>
      {accessories.map((accessory, accessoryIndex) => {
        const qty = accessory.quantity ?? 1;
        const unit = accessory.price ?? 0;
        return (
          <div
            key={`${line.id ?? index}-acc-${accessoryIndex}`}
            className={rowClass}
            onClick={rowEdit.onClick}
          >
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
            {onRemove ? <span className="sheet-col-end" /> : null}
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
  activeLineIndex = null,
  onSaveInstitution,
  onSaveContact,
  onAddToCatalog,
  onIntent,
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
  const editDate = onIntent ? () => onIntent({ kind: "edit-date" }) : undefined;
  const editInstitution = onIntent ? () => onIntent({ kind: "edit-institution" }) : undefined;
  const editContact = onIntent ? () => onIntent({ kind: "edit-contact" }) : undefined;
  const editAddress = onIntent ? () => onIntent({ kind: "edit-field", field: "address" }) : undefined;
  const currencyHot = hotZone(
    onIntent ? () => onIntent({ kind: "edit-field", field: "currency" }) : undefined,
    "Para birimini değiştirmek için tıklayın",
  );
  const discountHot = hotZone(
    onIntent ? () => onIntent({ kind: "edit-field", field: "discount" }) : undefined,
    "İndirimi düzenlemek için tıklayın",
  );
  const taxHot = hotZone(
    onIntent ? () => onIntent({ kind: "edit-tax" }) : undefined,
    "KDV oranını değiştirmek için tıklayın",
  );
  const footer: { field: SheetField; title: string; body: string; hint: string }[] = [
    {
      field: "delivery",
      title: texts.footer.deliveryTitle,
      body: textOr(quote.terms?.delivery, texts.footer.delivery),
      hint: "Teslimatı düzenlemek için tıklayın",
    },
    {
      field: "payment",
      title: texts.footer.paymentTitle,
      body: textOr(quote.terms?.payment, texts.footer.payment),
      hint: "Ödemeyi düzenlemek için tıklayın",
    },
    {
      field: "validation",
      title: texts.footer.validationTitle,
      body: textOr(quote.terms?.validation, texts.footer.validation),
      hint: "Geçerliliği düzenlemek için tıklayın",
    },
    {
      field: "trade-terms",
      title: texts.footer.termsTitle,
      body: textOr(quote.terms?.tradeTerms, texts.footer.terms),
      hint: "Ticari koşulu düzenlemek için tıklayın",
    },
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
              <SheetHot title="Yetkili kişiyi düzenlemek için tıklayın" onEdit={editContact}>
                {person || "—"}
              </SheetHot>
              {showContactSave ? (
                <SheetAction title="Kişiyi kaydet" onClick={onSaveContact}>
                  + Kaydet
                </SheetAction>
              ) : null}
            </p>
          </div>
          <p className="os-institution">
            <SheetHot title="Kurumu düzenlemek için tıklayın" onEdit={editInstitution}>
              {quoted.institution?.trim() || "—"}
            </SheetHot>
            {showInstitutionSave ? (
              <SheetAction title="Kurumu kaydet" onClick={onSaveInstitution}>
                + Kaydet
              </SheetAction>
            ) : null}
          </p>
          {quoted.address?.trim() ? (
            <p className="os-address">
              <SheetHot title="Adresi düzenlemek için tıklayın" onEdit={editAddress}>
                {quoted.address}
              </SheetHot>
            </p>
          ) : null}
        </div>
        <div className="os-meta">
          <div className="os-meta-row">
            <span>{texts.quoteNoLabel}</span>
            <span>{quote.quoteNumber?.trim() || "—"}</span>
          </div>
          <div
            className={`os-meta-row${editDate ? " sheet-hot" : ""}`}
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
            <span>{texts.dateLabel}</span>
            <span>{dateLabel}</span>
          </div>
        </div>
      </div>

      <div className="os-table-head">
        {onIntent ? <SheetAdd onClick={(anchor) => onIntent({ kind: "add", anchor })} /> : null}
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
        <SheetHeadEnd active={Boolean(onIntent)} />
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
        <div className="os-totals">
          <div className="os-total-row">
            <span>{texts.subtotal}</span>
            <span className="os-total-value">
              {formatTl(priceSummary?.subtotal ?? priceSummary?.totalAfterDiscount ?? 0, currency)}
            </span>
          </div>
          <div
            className={`os-total-row${discountHot.className ? ` ${discountHot.className}` : ""}`}
            title={discountHot.title}
            onClick={discountHot.onClick}
          >
            <span>{texts.discount}</span>
            <span className="os-total-value">{formatTl(priceSummary?.discount ?? 0, currency)}</span>
          </div>
          <div
            className={`os-total-row${taxHot.className ? ` ${taxHot.className}` : ""}`}
            title={taxHot.title}
            onClick={taxHot.onClick}
          >
            <span>{texts.tax}</span>
            <span className="os-total-value">{formatTl(priceSummary?.tax ?? 0, currency)}</span>
          </div>
          <div className="os-total-row">
            <span>{texts.total}</span>
            <span className="os-total-value">
              {formatTl(priceSummary?.totalAfterTax ?? 0, currency)}
            </span>
          </div>
          <div
            className={`os-total-row${currencyHot.className ? ` ${currencyHot.className}` : ""}`}
            title={currencyHot.title}
            onClick={currencyHot.onClick}
          >
            <span>PB :</span>
            <span className="os-total-currency" />
            <span className="os-total-value">{currencyLabel}</span>
          </div>
        </div>
      ) : null}

      <div className="os-footer">
        {footer.map((column) => {
          const zone = hotZone(
            onIntent ? () => onIntent({ kind: "edit-field", field: column.field }) : undefined,
            column.hint,
          );
          return (
            <div
              key={column.title}
              className={`os-footer-col${zone.className ? ` ${zone.className}` : ""}`}
              title={zone.title}
              onClick={zone.onClick}
            >
              <h3>{column.title}</h3>
              <p>{column.body}</p>
            </div>
          );
        })}
      </div>
    </article>
  );
}
