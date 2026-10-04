import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import {
  addDaysFormatted,
  assetUrl,
  formatQuoteDateSlash,
  formatTl,
} from "@/lib/pdf/format";
import { lineImageKey } from "@/lib/pdf/product-images";
import { milimStyles as s } from "@/lib/pdf/milimlab-styles";
import {
  milimlabTemplate,
  type MilimlabTemplate,
} from "@/lib/pdf/milimlab-template";
import type { QuoteLineResponse, QuoteResponse } from "@/lib/api/generated/model";

type Props = {
  quote: QuoteResponse;
  origin: string;
  template?: MilimlabTemplate;
  showImages?: boolean;
  imageDataUrls?: Record<string, string>;
};

function Field({
  label,
  value,
  flex = 1,
}: {
  label: string;
  value: string;
  flex?: number;
}) {
  return (
    <View style={[s.recipientField, { flex }]}>
      <Text style={s.recipientLabel}>{label}: </Text>
      <Text style={s.recipientValue}>{value}</Text>
    </View>
  );
}

function ProductRow({
  line,
  index,
  currency,
  showLinePrices,
  quantityUnit,
  imageDataUrl,
}: {
  line: QuoteLineResponse;
  index: number;
  currency?: string;
  showLinePrices: boolean;
  quantityUnit: string;
  imageDataUrl?: string;
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
    <View style={s.tableRow}>
      <Text style={[s.cell, s.colNo]}>{index}</Text>
      <View style={s.colDesc}>
        <Text style={s.cellBold}>{title}</Text>
        {specs.map((item) => (
          <Text key={item} style={s.bullet}>
            {item}
          </Text>
        ))}
        {imageDataUrl ? (
          <Image src={imageDataUrl} style={{ width: 90, height: 68, marginTop: 4 }} />
        ) : null}
      </View>
      {showLinePrices ? (
        <>
          <Text style={[s.cell, s.colUnit]}>{formatTl(unit, currency)}</Text>
          <Text style={[s.cell, s.colQty]}>
            {qty} {quantityUnit}
          </Text>
          <Text style={[s.cell, s.colSub]}>{formatTl(subtotal, currency)}</Text>
          <Text style={[s.cell, s.colDisc]}>{formatTl(0, currency)}</Text>
          <Text style={[s.cell, s.colTotal]}>
            {formatTl(line.lineTotal ?? subtotal, currency)}
          </Text>
        </>
      ) : (
        <Text style={[s.cell, s.colQty]}>
          {qty} {quantityUnit}
        </Text>
      )}
    </View>
  );
}

export function MilimlabQuoteDocument({
  quote,
  origin,
  template = milimlabTemplate,
  showImages = false,
  imageDataUrls = {},
}: Props) {
  const { company, texts, terms } = template;
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
  const contact = [quoted.contactPerson, quoted.department]
    .filter(Boolean)
    .join(" / ");

  return (
    <Document
      title={`Teklif ${quote.quoteNumber ?? ""}`.trim()}
      author={company.legalNameLines.join(" ")}
      subject="Teklif"
      language="tr"
    >
      <Page size="A4" wrap style={s.page}>
        <Image src={assetUrl(origin, company.logo)} style={s.logo} />

        <View style={s.infoBar}>
          <View style={s.companyBar}>
            <Text style={s.companyTitle}>
              {company.legalNameLines.join(" ")}
            </Text>
            <View style={s.companyGrid}>
              <View style={s.companyCol}>
                {company.addressLines.map((line) => (
                  <Text key={line} style={s.companyLine}>
                    {line}
                  </Text>
                ))}
                <Text style={s.companyLine}>
                  {company.taxOffice} {company.taxNumber}
                </Text>
              </View>
              <View style={s.companyCol}>
                <Text style={s.companyLine}>Mersis No:{company.mersis}</Text>
                <Text style={s.companyLine}>
                  Tic.Sic.No:{company.tradeRegistry}
                </Text>
              </View>
              <View style={s.companyCol}>
                <Text style={s.companyLine}>T: {company.phone}</Text>
                <Text style={s.companyLine}>F: {company.fax}</Text>
                <Text style={s.companyLine}>{company.email}</Text>
                <Text style={s.companyLine}>{company.web}</Text>
              </View>
            </View>
          </View>
          <View style={s.metaBar}>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>{texts.quoteNoLabel}</Text>
              <Text style={s.metaColon}>:</Text>
              <Text style={s.metaValue}>{quote.quoteNumber?.trim() || "—"}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>{texts.dateLabel}</Text>
              <Text style={s.metaColon}>:</Text>
              <Text style={s.metaValue}>{dateLabel}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>{texts.validityLabel}</Text>
              <Text style={s.metaColon}>:</Text>
              <Text style={s.metaValue}>
                {validityLabel} {texts.validitySuffix}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.recipientBox}>
          <View style={s.recipientRow}>
            <Field
              label={texts.institutionLabel}
              value={quoted.institution?.trim() || ""}
              flex={1.4}
            />
            <Field label={texts.phoneLabel} value={quoted.phone?.trim() || ""} />
            <Field label={texts.emailLabel} value={quoted.email?.trim() || ""} />
          </View>
          <View style={[s.recipientRow, { marginBottom: 0 }]}>
            <Field
              label={texts.addressLabel}
              value={quoted.address?.trim() || ""}
              flex={1.4}
            />
            <Field label={texts.faxLabel} value="" />
            <Field label={texts.contactLabel} value={contact} />
          </View>
        </View>

        <View style={s.tableHeader} wrap={false}>
          <Text style={[s.tableHeaderCell, s.colNo]}>{texts.table.no}</Text>
          <Text style={[s.tableHeaderCell, s.colDesc, { textAlign: "left" }]}>
            {texts.table.description}
          </Text>
          {showLinePrices ? (
            <>
              <Text style={[s.tableHeaderCell, s.colUnit]}>
                {texts.table.unitPrice}
              </Text>
              <Text style={[s.tableHeaderCell, s.colQty]}>
                {texts.table.quantity}
              </Text>
              <Text style={[s.tableHeaderCell, s.colSub]}>
                {texts.table.subtotal}
              </Text>
              <Text style={[s.tableHeaderCell, s.colDisc]}>
                {texts.table.discount}
              </Text>
              <Text style={[s.tableHeaderCell, s.colTotal]}>
                {texts.table.total}
              </Text>
            </>
          ) : (
            <Text style={[s.tableHeaderCell, s.colQty]}>
              {texts.table.quantity}
            </Text>
          )}
        </View>

        {lines.map((line, index) => (
          <ProductRow
            key={line.id ?? `line-${index}`}
            line={line}
            index={index + 1}
            currency={currency}
            showLinePrices={showLinePrices}
            quantityUnit={texts.quantityUnit}
            imageDataUrl={
              showImages ? imageDataUrls[lineImageKey(line, index)] : undefined
            }
          />
        ))}

        {showLinePrices ? (
          <View style={s.totalsBlock} wrap={false}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>{texts.totals.subtotal}</Text>
              <Text style={s.totalValue}>
                {formatTl(quote.priceSummary?.totalAfterDiscount ?? 0, currency)}
              </Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>{texts.totals.tax}</Text>
              <Text style={s.totalValue}>
                {formatTl(quote.priceSummary?.tax ?? 0, currency)}
              </Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>{texts.totals.grand}</Text>
              <Text style={s.totalValue}>
                {formatTl(quote.priceSummary?.totalAfterTax ?? 0, currency)}
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={s.sectionTitle}>{texts.deliveryTitle}</Text>
        <View style={s.sectionRow}>
          <Text style={s.sectionLabel}>{texts.deliveryTimeLabel}</Text>
          <Text style={s.sectionColon}>:</Text>
          <Text style={s.sectionValue}>{texts.deliveryTime}</Text>
        </View>
        <View style={s.sectionRow}>
          <Text style={s.sectionLabel}>{texts.deliveryModeLabel}</Text>
          <Text style={s.sectionColon}>:</Text>
          <Text style={s.sectionValue}>{texts.deliveryMode}</Text>
        </View>

        <Text style={s.sectionTitle}>{texts.commercialTitle}</Text>
        <Text style={s.commercialBody}>
          {texts.commercialBody.replaceAll("{rate}", String(taxRate))}
        </Text>

        <Text style={s.sectionTitle}>{texts.paymentTitle}</Text>
        <Text style={s.commercialBody}>{texts.paymentBody}</Text>

        <Text style={s.sectionTitle}>{texts.generalTitle}</Text>
        {texts.notes.map((note) => (
          <Text key={note.slice(0, 48)} style={s.note}>
            {note}
          </Text>
        ))}
      </Page>
    </Document>
  );
}
