"use client";

import { SheetHtml } from "@/components/quote/sheet/sheet-html";
import { SheetAction, type QuoteSheetProps } from "@/components/quote/sheet/sheet-types";
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
import { resolveLineImageSrc } from "@/lib/pdf/product-images";
import { isManualLine } from "@/lib/quote/document-edit";

function ProductRow({
  line,
  index,
  currency,
  showLinePrices,
  imageSrc,
  onAddToCatalog,
}: {
  line: QuoteLineResponse;
  index: number;
  currency?: string;
  showLinePrices: boolean;
  imageSrc: string | null;
  onAddToCatalog?: () => void;
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

  return (
    <div className="tt-table-row">
      <span className="tt-cell tt-col-no">{index}</span>
      <span className="tt-cell tt-col-code">{line.code || "—"}</span>
      <div className={showLinePrices ? "tt-col-desc" : "tt-col-desc-wide"}>
        {nameLines.map((part, nameIndex) => (
          <p key={`name-${nameIndex}`} className="tt-name">
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
}: {
  dateLabel: string;
  pageLabel: string;
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
          <p className="tt-date">
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
  onSaveInstitution,
  onSaveContact,
  onAddToCatalog,
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

  const taxLabel = `${texts.totals.tax} (% ${taxRate})`;
  const totals = [
    { label: texts.totals.gross, value: formatTl(priceSummary?.subtotal ?? 0, currency) },
    { label: texts.totals.discount, value: formatTl(priceSummary?.discount ?? 0, currency) },
    { label: texts.totals.net, value: formatTl(priceSummary?.totalAfterDiscount ?? 0, currency) },
    { label: taxLabel, value: formatTl(priceSummary?.tax ?? 0, currency) },
    { label: texts.totals.grand, value: formatTl(priceSummary?.totalAfterTax ?? 0, currency) },
  ];

  return (
    <>
      <article className="quote-page">
        <PageChrome dateLabel={dateLabel} pageLabel="1/2" />
        <div className="tt-body">
          <div className="tt-recipient-row">
            <div className="tt-recipient">
              <p>
                {(quoted.institution ?? "").trim() || dashed("")}
                {showInstitutionSave ? (
                  <SheetAction title="Kurumu kaydet" onClick={onSaveInstitution}>
                    + Kaydet
                  </SheetAction>
                ) : null}
              </p>
              {quoted.department?.trim() ? <p>{quoted.department}</p> : null}
            </div>
            <div className="tt-meta">
              <div className="tt-meta-row">
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

          <p className="tt-greeting">
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
                onAddToCatalog={
                  isManualLine(line) && onAddToCatalog
                    ? () => onAddToCatalog(line, index)
                    : undefined
                }
              />
            ))
          )}

          <div className="tt-totals">
            {totals.map((row) => (
              <div key={row.label} className="tt-total-row">
                <span className="tt-total-label">{row.label}</span>
                <span className="tt-total-value">{row.value}</span>
              </div>
            ))}
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
              <p className="tt-vat">{vatIncluded}</p>
            </div>
          </div>
        </div>
        <PageFooter />
      </article>

      <article className="quote-page">
        <PageChrome dateLabel={dateLabel} pageLabel="2/2" />
        <div className="tt-body">
          <h2 className="tt-conditions-title">{texts.salesConditionsTitle}</h2>
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
