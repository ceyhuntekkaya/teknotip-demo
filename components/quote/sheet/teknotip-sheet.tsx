"use client";

import { SheetHtml } from "@/components/quote/sheet/sheet-html";
import { SheetAdd, SheetHot, SheetRemove } from "@/components/quote/sheet/sheet-chrome";
import {
  bindRowEdit,
  hotZone,
  SheetAction,
  type QuoteSheetProps,
} from "@/components/quote/sheet/sheet-types";
import type { QuoteLineResponse } from "@/lib/api/generated/model";
import { amountInWords } from "@/lib/pdf/amount-in-words";
import { companyTemplate } from "@/lib/pdf/company";
import {
  addDaysFormatted,
  dashed,
  formatQuoteDate,
  formatTl,
} from "@/lib/pdf/format";
import { applyTermTokens, textOr } from "@/lib/pdf/html-blocks";
import { moneyUnit } from "@/lib/money";
import { resolveLineImageSrc } from "@/lib/pdf/product-images";
import { isManualLine } from "@/lib/quote/document-edit";

function ProductRow({
  line,
  index,
  currency,
  showLinePrices,
  imageSrc,
  active = false,
  onAddToCatalog,
  onEdit,
  onRemove,
}: {
  line: QuoteLineResponse;
  index: number;
  currency?: string;
  showLinePrices: boolean;
  imageSrc: string | null;
  active?: boolean;
  onAddToCatalog?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  const specs = [
    ...(line.properties ?? [])
      .filter((property) => property.name && property.values)
      .map((property) => `· ${property.name}: ${property.values}`),
    ...(line.accessories ?? []).map((accessory) => {
      const qty = accessory.quantity && accessory.quantity > 1 ? ` x${accessory.quantity}` : "";
      return `· ${accessory.name}${qty}`;
    }),
  ];
  const nameLines = (line.name ?? "").split("\n");
  const rowEdit = bindRowEdit(onEdit);

  return (
    <div
      className={`tt-table-row${rowEdit.className ? ` ${rowEdit.className}` : ""}${active ? " sheet-row-active" : ""}`}
      onClick={rowEdit.onClick}
    >
      <span className={`tt-cell tt-col-no${onRemove ? " sheet-no" : ""}`}>
        {onRemove ? <SheetRemove onClick={onRemove} /> : null}
        {index}
      </span>
      <span className="tt-cell tt-col-code">{line.code || "—"}</span>
      <div className={showLinePrices ? "tt-col-desc" : "tt-col-desc-wide"}>
        {nameLines.map((part, nameIndex) => (
          <p
            key={`name-${nameIndex}`}
            className="tt-name"
            title={nameIndex === 0 && onEdit ? "Düzenlemek için tıklayın" : undefined}
          >
            {part || " "}
            {nameIndex === 0 ? (
              <SheetAction title="Kataloga ekle" onClick={onAddToCatalog}>
                + Katalog
              </SheetAction>
            ) : null}
          </p>
        ))}
        {specs.map((item) => (
          <p key={item} className="tt-bullet">
            {item}
          </p>
        ))}
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt="" className="tt-product-image" />
        ) : null}
      </div>
      <span className="tt-cell tt-col-qty">{line.quantity ?? 1}</span>
      {showLinePrices ? (
        <>
          <span className="tt-cell tt-col-unit">{formatTl(line.price ?? 0, currency)}</span>
          <span className="tt-cell tt-col-price">{formatTl(line.lineTotal ?? 0, currency)}</span>
        </>
      ) : null}
    </div>
  );
}

function PageChrome({
  dateLabel,
  pageLabel,
  onEditDate,
}: {
  dateLabel: string;
  pageLabel: string;
  onEditDate?: () => void;
}) {
  const { company, texts } = companyTemplate;
  return (
    <>
      <header className="tt-header">
        <div className="tt-header-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={company.logo} alt="" className="tt-logo" />
          <div className="tt-company">
            {company.addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            <p>Vergi Dairesi: {company.taxOffice}</p>
            <p>Mersis No: {company.mersis}</p>
            <p>VKN: {company.vkn}</p>
            <p>Tel: {company.phone}</p>
            <p>Fax: {company.fax}</p>
            <p>Web: {company.web}</p>
            <p>E-posta: {company.email}</p>
          </div>
        </div>
        <div className="tt-title-row">
          <h2 className="tt-title">{texts.documentTitle}</h2>
          <p
            className={`tt-date${onEditDate ? " sheet-hot" : ""}`}
            title={onEditDate ? "Tarihi düzenlemek için tıklayın" : undefined}
            onClick={
              onEditDate
                ? (event) => {
                    event.preventDefault();
                    onEditDate();
                  }
                : undefined
            }
          >
            {texts.dateLabel} {dateLabel}
          </p>
        </div>
      </header>
      <p className="tt-page-no">{pageLabel}</p>
    </>
  );
}

function PageFooter() {
  const { company } = companyTemplate;
  return (
    <footer className="tt-footer">
      <div className="tt-footer-rule" />
      <p>{company.footerAddress}</p>
      <p>
        Tel : {company.phone} & Fax : {company.fax}
      </p>
      <p>
        Web: {company.web} e-mail: {company.email}
      </p>
    </footer>
  );
}

export function TeknotipSheet({
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
  const { company, bank, texts, terms } = companyTemplate;
  const dateIso = quote.quotedDate ?? "";
  const dateLabel = formatQuoteDate(dateIso);
  const validityDays = quote.terms?.validityDays ?? terms.validityDays;
  const validityDate = addDaysFormatted(dateIso, validityDays);
  const taxRate = quote.priceSummary?.taxRatePercent ?? 20;
  const salesConditions = textOr(quote.terms?.salesConditions, "");
  const vatIncluded = texts.vatIncluded.replaceAll("{rate}", String(taxRate));
  const words = amountInWords(quote.priceSummary?.totalAfterTax ?? 0, quote.currency);
  const quoted = quote.quotedTo ?? {};
  const lines = quote.lines ?? [];
  const showLinePrices = quote.priceDetails !== false;
  const priceSummary = quote.priceSummary;
  const currency = quote.currency;
  const productsById = new Map(
    products.filter((product) => product.id).map((product) => [product.id as string, product]),
  );
  const showInstitutionSave = canSave && !!quoted.institution?.trim() && !quoted.institutionId;
  const showContactSave =
    canSave &&
    !!(quoted.contactPerson?.trim() || quoted.greetingName?.trim()) &&
    !quoted.customerId;

  const editDate = onIntent ? () => onIntent({ kind: "edit-date" }) : undefined;
  const editTax = onIntent ? () => onIntent({ kind: "edit-tax" }) : undefined;
  const editInstitution = onIntent ? () => onIntent({ kind: "edit-institution" }) : undefined;
  const editContact = onIntent ? () => onIntent({ kind: "edit-contact" }) : undefined;
  const editPhone = onIntent ? () => onIntent({ kind: "edit-field", field: "phone" }) : undefined;
  const editDepartment = onIntent
    ? () => onIntent({ kind: "edit-field", field: "department" })
    : undefined;
  const editDiscount = onIntent
    ? () => onIntent({ kind: "edit-field", field: "discount" })
    : undefined;
  const editConditions = onIntent
    ? () => onIntent({ kind: "edit-field", field: "sales-conditions" })
    : undefined;
  const editCurrency = onIntent
    ? () => onIntent({ kind: "edit-field", field: "currency" })
    : undefined;
  const phoneHot = hotZone(editPhone, "Telefonu düzenlemek için tıklayın");
  const departmentHot = hotZone(editDepartment, "Departmanı düzenlemek için tıklayın");
  const discountHot = hotZone(editDiscount, "İndirimi düzenlemek için tıklayın");
  const conditionsHot = hotZone(editConditions, "Satış koşullarını düzenlemek için tıklayın");
  const currencyHot = hotZone(editCurrency, "Para birimini değiştirmek için tıklayın");
  const taxLabel = `${texts.totals.tax} (% ${taxRate})`;
  const totals: { label: string; value: string; tax?: boolean; discount?: boolean }[] = [
    { label: texts.totals.gross, value: formatTl(priceSummary?.subtotal ?? 0, currency) },
    {
      label: texts.totals.discount,
      value: formatTl(priceSummary?.discount ?? 0, currency),
      discount: true,
    },
    { label: texts.totals.net, value: formatTl(priceSummary?.totalAfterDiscount ?? 0, currency) },
    { label: taxLabel, value: formatTl(priceSummary?.tax ?? 0, currency), tax: true },
    { label: texts.totals.grand, value: formatTl(priceSummary?.totalAfterTax ?? 0, currency) },
  ];

  return (
    <>
      <article className="quote-page">
        <PageChrome dateLabel={dateLabel} pageLabel="1/2" onEditDate={editDate} />
        <div className="tt-body">
          <div className="tt-recipient-row">
            <div className="tt-recipient">
              <p
                className={editInstitution ? "sheet-hot" : undefined}
                title={editInstitution ? "Kurumu düzenlemek için tıklayın" : undefined}
                onClick={
                  editInstitution
                    ? (event) => {
                        if (event.target instanceof Element && event.target.closest("button")) return;
                        event.preventDefault();
                        editInstitution();
                      }
                    : undefined
                }
              >
                {(quoted.institution ?? "").trim() || dashed("")}
                {showInstitutionSave ? (
                  <SheetAction title="Kurumu kaydet" onClick={onSaveInstitution}>
                    + Kaydet
                  </SheetAction>
                ) : null}
              </p>
              {quoted.department?.trim() ? (
                <p
                  className={departmentHot.className}
                  title={departmentHot.title}
                  onClick={departmentHot.onClick}
                >
                  {quoted.department}
                </p>
              ) : null}
            </div>
            <div className="tt-meta">
              <div
                className={`tt-meta-row${phoneHot.className ? ` ${phoneHot.className}` : ""}`}
                title={phoneHot.title}
                onClick={phoneHot.onClick}
              >
                <span className="tt-meta-label">{texts.phoneLabel}</span>
                <span className="tt-meta-value">: {quoted.phone?.trim() || "—"}</span>
              </div>
              <div className="tt-meta-row">
                <span className="tt-meta-label">{texts.faxLabel}</span>
                <span className="tt-meta-value">: /</span>
              </div>
              <div className="tt-meta-row">
                <span className="tt-meta-label">{texts.quoteNoLabel}</span>
                <span className="tt-meta-value">: {quote.quoteNumber?.trim() || "—"}</span>
              </div>
            </div>
          </div>

          <p
            className={`tt-greeting${editContact ? " sheet-hot" : ""}`}
            title={editContact ? "Yetkili kişiyi düzenlemek için tıklayın" : undefined}
            onClick={
              editContact
                ? (event) => {
                    if (event.target instanceof Element && event.target.closest("button")) return;
                    event.preventDefault();
                    editContact();
                  }
                : undefined
            }
          >
            {texts.greeting} {dashed(quoted.greetingName ?? quoted.contactPerson ?? "")}
            {showContactSave ? (
              <SheetAction title="Kişiyi kaydet" onClick={onSaveContact}>
                + Kaydet
              </SheetAction>
            ) : null}
          </p>
          <div className="tt-intro-block">
            {texts.intro.map((line) => (
              <p key={line} className="tt-intro">
                {line}
              </p>
            ))}
          </div>

          <div className="tt-table-head">
            {onIntent ? (
              <SheetAdd onClick={(anchor) => onIntent({ kind: "add", anchor })} />
            ) : null}
            <span className="tt-col-no">{texts.table.no}</span>
            <span className="tt-col-code">{texts.table.code}</span>
            <span className={showLinePrices ? "tt-col-desc" : "tt-col-desc-wide"}>
              {texts.table.description}
            </span>
            <span className="tt-col-qty">{texts.table.quantity}</span>
            {showLinePrices ? (
              <>
                <span className="tt-col-unit">{texts.table.unitPrice}</span>
                <span className="tt-col-price">{texts.table.price}</span>
              </>
            ) : null}
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
                imageSrc={showImages ? resolveLineImageSrc(line, productsById) : null}
                active={activeLineIndex === index}
                onAddToCatalog={
                  isManualLine(line) && onAddToCatalog
                    ? () => onAddToCatalog(line, index)
                    : undefined
                }
                onEdit={onIntent ? () => onIntent({ kind: "edit-line", index }) : undefined}
                onRemove={onIntent ? () => onIntent({ kind: "delete-line", index }) : undefined}
              />
            ))
          )}

          <div className="tt-totals">
            {totals.map((row) => (
              <div
                key={row.label}
                className={`tt-total-row${row.discount && discountHot.className ? ` ${discountHot.className}` : ""}`}
                title={row.discount ? discountHot.title : undefined}
                onClick={row.discount ? discountHot.onClick : undefined}
              >
                <span className="tt-total-label">
                  {row.tax ? (
                    <SheetHot title="KDV oranını değiştirmek için tıklayın" onEdit={editTax}>
                      {row.label}
                    </SheetHot>
                  ) : (
                    row.label
                  )}
                </span>
                <span className="tt-total-value">{row.value}</span>
              </div>
            ))}
            <div
              className={`tt-total-row${currencyHot.className ? ` ${currencyHot.className}` : ""}`}
              title={currencyHot.title}
              onClick={currencyHot.onClick}
            >
              <span className="tt-total-label">PB :</span>
              <span className="tt-total-value">{moneyUnit(currency).label}</span>
            </div>
          </div>

          <div className="tt-closing">
            <div className="tt-closing-left">
              <h3>{texts.closing}</h3>
              <p className="tt-closing-company">{company.legalNameUpper}</p>
            </div>
            <div className="tt-closing-right">
              <p className="tt-only">
                {texts.totals.only} {words}
              </p>
              <p
                className={`tt-vat${editTax ? " sheet-hot" : ""}`}
                title={editTax ? "KDV oranını değiştirmek için tıklayın" : undefined}
                onClick={
                  editTax
                    ? (event) => {
                        event.preventDefault();
                        editTax();
                      }
                    : undefined
                }
              >
                {vatIncluded}
              </p>
            </div>
          </div>
        </div>
        <PageFooter />
      </article>

      <article className="quote-page">
        <PageChrome dateLabel={dateLabel} pageLabel="2/2" onEditDate={editDate} />
        <div className="tt-body">
          <h2 className="tt-conditions-title">{texts.salesConditionsTitle}</h2>
          <div
            className={conditionsHot.className}
            title={conditionsHot.title}
            onClick={conditionsHot.onClick}
          >
            {salesConditions ? (
              <SheetHtml
                className="tt-html"
                html={applyTermTokens(salesConditions, {
                  rate: String(taxRate),
                  date: validityDate,
                })}
              />
            ) : (
              <>
                {terms.conditions.map((condition, index) => (
                  <div key={condition.title} className="tt-condition">
                    <h3>
                      {index + 1}. {condition.title}
                    </h3>
                    <p>
                      {condition.body
                        .replaceAll("{date}", validityDate)
                        .replaceAll("{rate}", String(taxRate))}
                    </p>
                  </div>
                ))}
                <div className="tt-notes">
                  {terms.notes.map((note) => (
                    <p key={note.slice(0, 40)} className="tt-note">
                      {note}
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="tt-bank">
            <h3>{texts.bankTitle}</h3>
            <p>Hesap Adı: {bank.accountName}</p>
            <p>Banka: {bank.bank}</p>
            <p>Şube Adı: {bank.branch}</p>
            <p>Şube Kodu:{bank.branchCode}</p>
            <p>TL IBAN: {bank.ibanTl}</p>
            <p>EUR IBAN: {bank.ibanEur}</p>
            <p>USD IBAN: {bank.ibanUsd}</p>
          </div>

          <div className="tt-sign-row">
            <div className="tt-sign-box">
              <h3>{company.legalNameUpper}</h3>
            </div>
            <div className="tt-sign-box">
              <h3>{texts.customerApprovalTitle}</h3>
              <p>{texts.customerApprovalText}</p>
            </div>
          </div>
        </div>
        <PageFooter />
      </article>
    </>
  );
}
