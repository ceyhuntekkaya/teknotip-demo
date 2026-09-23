import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { amountInWords } from "@/lib/pdf/amount-in-words";
import { companyTemplate, type CompanyTemplate } from "@/lib/pdf/company";
import {
  addDaysFormatted,
  assetUrl,
  dashed,
  formatQuoteDate,
  formatTl,
} from "@/lib/pdf/format";
import { lineImageKey } from "@/lib/pdf/product-images";
import { pdfStyles as s } from "@/lib/pdf/styles";
import type { QuoteLineResponse, QuoteResponse } from "@/lib/api/generated/model";

type Props = {
  quote: QuoteResponse;
  origin: string;
  template?: CompanyTemplate;
  /** When false (default), product images are omitted from the PDF. */
  showImages?: boolean;
  /** Prefetched data URLs keyed by lineImageKey (auth-safe for /backend files). */
  imageDataUrls?: Record<string, string>;
};

function Header({
  template,
  origin,
  dateLabel,
}: {
  template: CompanyTemplate;
  origin: string;
  dateLabel: string;
}) {
  const { company, texts } = template;
  return (
    <View style={s.header} fixed>
      <View style={s.headerRow}>
        <Image src={assetUrl(origin, company.logo)} style={s.logo} />
        <View style={s.companyBlock}>
          {company.addressLines.map((line) => (
            <Text key={line} style={s.companyLine}>
              {line}
            </Text>
          ))}
          <Text style={s.companyLine}>Vergi Dairesi: {company.taxOffice}</Text>
          <Text style={s.companyLine}>Mersis No: {company.mersis}</Text>
          <Text style={s.companyLine}>VKN: {company.vkn}</Text>
          <Text style={s.companyLine}>Tel: {company.phone}</Text>
          <Text style={s.companyLine}>Fax: {company.fax}</Text>
          <Text style={s.companyLine}>Web: {company.web}</Text>
          <Text style={s.companyLine}>E-posta: {company.email}</Text>
        </View>
      </View>
      <View style={s.titleRow}>
        <Text style={s.title}>{texts.documentTitle}</Text>
        <Text style={s.dateText}>
          {texts.dateLabel} {dateLabel}
        </Text>
      </View>
    </View>
  );
}

function Footer({ template }: { template: CompanyTemplate }) {
  const { company } = template;
  return (
    <>
      <View style={s.footer} fixed>
        <View style={s.footerRule} />
        <Text style={s.footerLine}>{company.footerAddress}</Text>
        <Text style={s.footerLine}>
          Tel : {company.phone} & Fax : {company.fax}
        </Text>
        <Text style={s.footerLine}>
          Web: {company.web} e-mail: {company.email}
        </Text>
      </View>
      <Text
        style={s.pageNumber}
        render={({ pageNumber, totalPages }) => `${pageNumber}/${totalPages}`}
        fixed
      />
    </>
  );
}

function ProductRow({
  line,
  index,
  currency,
  showLinePrices,
  imageDataUrl,
}: {
  line: QuoteLineResponse;
  index: number;
  currency?: string;
  showLinePrices: boolean;
  imageDataUrl?: string;
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
  const longName = nameLines.length > 1 || (line.name ?? "").length > 120;

  return (
    <View style={s.tableRow} wrap={longName}>
      <Text style={[s.cell, s.colNo]}>{index}</Text>
      <Text style={[s.cell, s.colCode]}>{line.code || "—"}</Text>
      <View style={showLinePrices ? s.colDesc : s.colDescWide}>
        {nameLines.map((part, nameIndex) => (
          <Text key={`name-${nameIndex}`} style={s.cellBold}>
            {part || " "}
          </Text>
        ))}
        {specs.map((item) => (
          <Text key={item} style={s.bullet}>
            {item}
          </Text>
        ))}
        {imageDataUrl ? (
          <Image src={imageDataUrl} style={s.productImage} />
        ) : null}
      </View>
      <Text style={[s.cell, s.colQty]}>{line.quantity ?? 1}</Text>
      {showLinePrices ? (
        <>
          <Text style={[s.cell, s.colUnit]}>{formatTl(line.price ?? 0, currency)}</Text>
          <Text style={[s.cell, s.colPrice]}>{formatTl(line.lineTotal ?? 0, currency)}</Text>
        </>
      ) : null}
    </View>
  );
}

function Totals({
  quote,
  template,
}: {
  quote: QuoteResponse;
  template: CompanyTemplate;
}) {
  const { texts } = template;
  const priceSummary = quote.priceSummary;
  const currency = quote.currency;
  const taxLabel = `${texts.totals.tax} (% ${priceSummary?.taxRatePercent ?? 20})`;
  const rows = [
    { label: texts.totals.gross, value: formatTl(priceSummary?.subtotal ?? 0, currency) },
    { label: texts.totals.discount, value: formatTl(priceSummary?.discount ?? 0, currency) },
    { label: texts.totals.net, value: formatTl(priceSummary?.totalAfterDiscount ?? 0, currency) },
    { label: taxLabel, value: formatTl(priceSummary?.tax ?? 0, currency) },
    { label: texts.totals.grand, value: formatTl(priceSummary?.totalAfterTax ?? 0, currency) },
  ];

  return (
    <View style={s.totalsBlock} wrap={false}>
      {rows.map((row) => (
        <View key={row.label} style={s.totalRow}>
          <Text style={s.totalLabel}>{row.label}</Text>
          <Text style={s.totalValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function QuotePdfDocument({
  quote,
  origin,
  template = companyTemplate,
  showImages = false,
  imageDataUrls = {},
}: Props) {
  const { company, bank, texts, terms } = template;
  const dateIso = quote.quotedDate ?? "";
  const dateLabel = formatQuoteDate(dateIso);
  const validityDate = addDaysFormatted(dateIso, terms.validityDays);
  const taxRate = quote.priceSummary?.taxRatePercent ?? 20;
  const vatIncluded = texts.vatIncluded.replaceAll("{rate}", String(taxRate));
  const words = amountInWords(quote.priceSummary?.totalAfterTax ?? 0, quote.currency);
  const quoted = quote.quotedTo ?? {};
  const lines = quote.lines ?? [];
  const showLinePrices = quote.priceDetails !== false;

  return (
    <Document
      title={`${texts.documentTitle} ${quote.quoteNumber ?? ""}`.trim()}
      author={company.legalName}
      subject={texts.documentTitle}
      language="tr"
    >
      <Page size="A4" wrap style={s.page}>
        <Header template={template} origin={origin} dateLabel={dateLabel} />
        <Footer template={template} />

        <View style={s.recipientRow}>
          <View style={s.recipient}>
            <Text style={s.recipientName}>
              {(quoted.institution ?? "").trim() || dashed("")}
            </Text>
            {quoted.department?.trim() ? (
              <Text style={s.recipientName}>{quoted.department}</Text>
            ) : null}
          </View>
          <View style={s.meta}>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>{texts.phoneLabel}</Text>
              <Text style={s.metaValue}>: {quoted.phone?.trim() || "—"}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>{texts.faxLabel}</Text>
              <Text style={s.metaValue}>: /</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>{texts.quoteNoLabel}</Text>
              <Text style={s.metaValue}>
                : {quote.quoteNumber?.trim() || "—"}
              </Text>
            </View>
          </View>
        </View>

        <Text style={s.greeting}>
          {texts.greeting} {dashed(quoted.greetingName ?? quoted.contactPerson ?? "")}
        </Text>
        <View style={s.introBlock}>
          {texts.intro.map((line) => (
            <Text key={line} style={s.intro}>
              {line}
            </Text>
          ))}
        </View>

        <View style={s.tableHeader} wrap={false}>
          <Text style={[s.tableHeaderCell, s.colNo]}>{texts.table.no}</Text>
          <Text style={[s.tableHeaderCell, s.colCode]}>{texts.table.code}</Text>
          <Text style={[s.tableHeaderCell, showLinePrices ? s.colDesc : s.colDescWide]}>
            {texts.table.description}
          </Text>
          <Text style={[s.tableHeaderCell, s.colQty]}>{texts.table.quantity}</Text>
          {showLinePrices ? (
            <>
              <Text style={[s.tableHeaderCell, s.colUnit]}>{texts.table.unitPrice}</Text>
              <Text style={[s.tableHeaderCell, s.colPrice]}>{texts.table.price}</Text>
            </>
          ) : null}
        </View>
        {lines.map((line, index) => (
          <ProductRow
            key={line.id ?? `line-${index}`}
            line={line}
            index={index + 1}
            currency={quote.currency}
            showLinePrices={showLinePrices}
            imageDataUrl={
              showImages ? imageDataUrls[lineImageKey(line, index)] : undefined
            }
          />
        ))}

        <Totals quote={quote} template={template} />

        <View style={s.closingRow} wrap={false}>
          <View style={s.closingLeft}>
            <Text style={s.closingTitle}>{texts.closing}</Text>
            <Text style={s.closingCompany}>{company.legalNameUpper}</Text>
          </View>
          <View style={s.closingRight}>
            <Text style={s.onlyLine}>
              {texts.totals.only} {words}
            </Text>
            <Text style={s.vatNote}>{vatIncluded}</Text>
          </View>
        </View>

        <View break />

        <Text style={s.conditionsTitle}>{texts.salesConditionsTitle}</Text>
        {terms.conditions.map((condition, index) => (
          <View key={condition.title} style={s.condition}>
            <Text style={s.conditionTitle}>
              {index + 1}. {condition.title}
            </Text>
            <Text style={s.conditionBody}>
              {condition.body.replaceAll("{date}", validityDate).replaceAll("{rate}", String(taxRate))}
            </Text>
          </View>
        ))}

        <View style={{ marginTop: 8 }}>
          {terms.notes.map((note) => (
            <Text key={note.slice(0, 40)} style={s.note}>
              {note}
            </Text>
          ))}
        </View>

        <Text style={s.bankTitle}>{texts.bankTitle}</Text>
        <Text style={s.bankLine}>Hesap Adı: {bank.accountName}</Text>
        <Text style={s.bankLine}>Banka: {bank.bank}</Text>
        <Text style={s.bankLine}>Şube Adı: {bank.branch}</Text>
        <Text style={s.bankLine}>Şube Kodu:{bank.branchCode}</Text>
        <Text style={s.bankLine}>TL IBAN: {bank.ibanTl}</Text>
        <Text style={s.bankLine}>EUR IBAN: {bank.ibanEur}</Text>
        <Text style={s.bankLine}>USD IBAN: {bank.ibanUsd}</Text>

        <View style={s.signRow} wrap={false}>
          <View style={s.signBox}>
            <Text style={s.signTitle}>{company.legalNameUpper}</Text>
          </View>
          <View style={s.signBox}>
            <Text style={s.signTitle}>{texts.customerApprovalTitle}</Text>
            <Text style={s.signText}>{texts.customerApprovalText}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
