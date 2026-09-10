import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { amountInWords } from "@/lib/pdf/amount-in-words";
import { companyTemplate, type CompanyTemplate } from "@/lib/pdf/company";
import {
  addDaysFormatted,
  assetUrl,
  dashed,
  formatQuoteDate,
  formatTl,
  usableProductImage,
} from "@/lib/pdf/format";
import { pdfStyles as s } from "@/lib/pdf/styles";
import type { QuoteDocument, QuoteDocumentProduct } from "@/lib/quote/types";

type Props = {
  quote: QuoteDocument;
  origin: string;
  template?: CompanyTemplate;
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
  product,
  index,
  origin,
}: {
  product: QuoteDocumentProduct;
  index: number;
  origin: string;
}) {
  const specs = product.propertyGroups.flatMap((group) =>
    group.properties.map((property) => `· ${property.name}: ${property.value}`),
  );
  const showImage = usableProductImage(product.image);

  return (
    <View style={s.tableRow} wrap={false}>
      <Text style={[s.cell, s.colNo]}>{index}</Text>
      <Text style={[s.cell, s.colCode]}>{product.modelName}</Text>
      <View style={s.colDesc}>
        <Text style={s.cellBold}>{product.name}</Text>
        {specs.map((line) => (
          <Text key={line} style={s.bullet}>
            {line}
          </Text>
        ))}
        {showImage ? (
          <Image
            src={assetUrl(origin, product.image)}
            style={s.productImage}
          />
        ) : null}
      </View>
      <Text style={[s.cell, s.colQty]}>{product.quantity}</Text>
      <Text style={[s.cell, s.colUnit]}>{formatTl(product.price)}</Text>
      <Text style={[s.cell, s.colPrice]}>{formatTl(product.lineTotal)}</Text>
    </View>
  );
}

function Totals({
  quote,
  template,
}: {
  quote: QuoteDocument;
  template: CompanyTemplate;
}) {
  const { texts } = template;
  const { priceSummary } = quote;
  const taxLabel = `${texts.totals.tax} (% ${priceSummary.taxRatePercent})`;
  const rows = [
    { label: texts.totals.gross, value: formatTl(priceSummary.subtotal) },
    { label: texts.totals.discount, value: formatTl(priceSummary.discount) },
    { label: texts.totals.net, value: formatTl(priceSummary.totalAfterDiscount) },
    { label: taxLabel, value: formatTl(priceSummary.tax) },
    { label: texts.totals.grand, value: formatTl(priceSummary.totalAfterTax) },
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
}: Props) {
  const { company, bank, texts, terms } = template;
  const dateLabel = formatQuoteDate(quote.quotedTo.date);
  const validityDate = addDaysFormatted(quote.quotedTo.date, terms.validityDays);
  const words = amountInWords(quote.priceSummary.totalAfterTax);
  const quoted = quote.quotedTo;

  return (
    <Document
      title={`${texts.documentTitle} ${quoted.quoteNumber}`.trim()}
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
              {quoted.institution.trim() || dashed("")}
            </Text>
            {quoted.name.trim() ? (
              <Text style={s.recipientName}>{quoted.name}</Text>
            ) : null}
          </View>
          <View style={s.meta}>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>{texts.phoneLabel}</Text>
              <Text style={s.metaValue}>:</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>{texts.faxLabel}</Text>
              <Text style={s.metaValue}>: /</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>{texts.quoteNoLabel}</Text>
              <Text style={s.metaValue}>
                : {quoted.quoteNumber.trim() || "—"}
              </Text>
            </View>
          </View>
        </View>

        <Text style={s.greeting}>
          {texts.greeting} {dashed(quoted.contactPerson)}
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
          <Text style={[s.tableHeaderCell, s.colDesc]}>{texts.table.description}</Text>
          <Text style={[s.tableHeaderCell, s.colQty]}>{texts.table.quantity}</Text>
          <Text style={[s.tableHeaderCell, s.colUnit]}>{texts.table.unitPrice}</Text>
          <Text style={[s.tableHeaderCell, s.colPrice]}>{texts.table.price}</Text>
        </View>
        {quote.products.map((product, index) => (
          <ProductRow
            key={product.lineId}
            product={product}
            index={index + 1}
            origin={origin}
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
            <Text style={s.vatNote}>{texts.vatIncluded}</Text>
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
              {condition.body.replace("{date}", validityDate)}
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
