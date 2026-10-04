import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import {
  assetUrl,
  formatQuoteDateEn,
  formatTl,
} from "@/lib/pdf/format";
import { moneyUnit } from "@/lib/money";
import { lineImageKey } from "@/lib/pdf/product-images";
import { optoStyles as s } from "@/lib/pdf/optosense-styles";
import {
  optosenseTemplate,
  type OptosenseTemplate,
} from "@/lib/pdf/optosense-template";
import type { QuoteLineResponse, QuoteResponse } from "@/lib/api/generated/model";

type Props = {
  quote: QuoteResponse;
  origin: string;
  template?: OptosenseTemplate;
  showImages?: boolean;
  imageDataUrls?: Record<string, string>;
};

function lineSpecs(line: QuoteLineResponse): string[] {
  return [
    ...(line.properties ?? [])
      .filter((property) => property.name && property.values)
      .map((property) => `${property.name}: ${property.values}`),
  ];
}

function ProductBlock({
  line,
  index,
  currency,
  showLinePrices,
  optionLabel,
  imageDataUrl,
}: {
  line: QuoteLineResponse;
  index: number;
  currency?: string;
  showLinePrices: boolean;
  optionLabel: string;
  imageDataUrl?: string;
}) {
  const specs = lineSpecs(line);
  const accessories = line.accessories ?? [];

  return (
    <>
      <View style={s.tableRow} wrap={false}>
        <Text style={[s.cell, s.colNo]}>{index}</Text>
        <Text style={[s.cellBold, s.colCode]}>{line.code || "—"}</Text>
        <View style={s.colDesc}>
          <Text style={s.cellBold}>{line.name || "—"}</Text>
          {specs.map((item) => (
            <Text key={item} style={s.bullet}>
              {item}
            </Text>
          ))}
          {imageDataUrl ? (
            <Image src={imageDataUrl} style={{ width: 90, height: 68, marginTop: 4 }} />
          ) : null}
        </View>
        <Text style={[s.cell, s.colQty]}>{line.quantity ?? 1}</Text>
        {showLinePrices ? (
          <>
            <Text style={[s.cell, s.colUnit]}>
              {formatTl(line.price ?? 0, currency)}
            </Text>
            <Text style={[s.cell, s.colTotal]}>
              {formatTl(line.lineTotal ?? 0, currency)}
            </Text>
          </>
        ) : null}
      </View>
      {accessories.map((accessory, accessoryIndex) => {
        const qty = accessory.quantity ?? 1;
        const unit = accessory.price ?? 0;
        const total = unit * qty;
        return (
          <View
            key={`${line.id ?? index}-acc-${accessoryIndex}`}
            style={s.tableRow}
            wrap={false}
          >
            <Text style={[s.cell, s.colNo]} />
            <Text style={[s.cellBold, s.colCode]}>{optionLabel}</Text>
            <View style={s.colDesc}>
              <Text style={s.cellBold}>{accessory.name || "—"}</Text>
            </View>
            <Text style={[s.cell, s.colQty]}>{qty}</Text>
            {showLinePrices ? (
              <>
                <Text style={[s.cell, s.colUnit]}>{formatTl(unit, currency)}</Text>
                <Text style={[s.cell, s.colTotal]}>{formatTl(total, currency)}</Text>
              </>
            ) : null}
          </View>
        );
      })}
    </>
  );
}

export function OptosenseQuoteDocument({
  quote,
  origin,
  template = optosenseTemplate,
  showImages = false,
  imageDataUrls = {},
}: Props) {
  const { company, texts } = template;
  const dateLabel = formatQuoteDateEn(quote.quotedDate ?? "");
  const quoted = quote.quotedTo ?? {};
  const lines = quote.lines ?? [];
  const showLinePrices = quote.priceDetails !== false;
  const currency = quote.currency;
  const currencyLabel = moneyUnit(currency).label;
  const priceSummary = quote.priceSummary;

  return (
    <Document
      title={`${texts.documentTitle} ${quote.quoteNumber ?? ""}`.trim()}
      author={company.legalName}
      subject={texts.documentTitle}
      language="en"
    >
      <Page size="A4" wrap style={s.page}>
        <Text style={s.title}>{texts.documentTitle}</Text>

        <View style={s.headerRow}>
          <View>
            <Image src={assetUrl(origin, company.logo)} style={s.logo} />
            <Text style={s.companyName}>{company.legalName}</Text>
            {company.addressLines.map((line) => (
              <Text key={line} style={s.companyLine}>
                {line}
              </Text>
            ))}
          </View>
          <View style={s.contactBlock}>
            <Text style={s.companyLine}>Phone: {company.phone}</Text>
            <Text style={s.companyLine}>e-mail:{company.email}</Text>
          </View>
        </View>

        <Text style={s.nameAddressLabel}>{texts.nameAddressLabel}</Text>
        <View style={s.recipientBlock}>
          <View style={s.attnRow}>
            <Text style={s.attnLabel}>{texts.attnLabel}</Text>
            <Text style={s.attnValue}>
              {quoted.contactPerson?.trim() || "—"}
            </Text>
          </View>
          <Text style={s.institution}>
            {quoted.institution?.trim() || "—"}
          </Text>
          {quoted.address?.trim() ? (
            <Text style={s.address}>{quoted.address}</Text>
          ) : null}
        </View>

        <View style={s.metaBlock}>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>{texts.quoteNoLabel}</Text>
            <Text style={s.metaValue}>{quote.quoteNumber?.trim() || "—"}</Text>
          </View>
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>{texts.dateLabel}</Text>
            <Text style={s.metaValue}>{dateLabel}</Text>
          </View>
        </View>

        <View style={s.tableHeader} wrap={false}>
          <Text style={[s.tableHeaderCell, s.colNo]}>{texts.table.no}</Text>
          <Text style={[s.tableHeaderCell, s.colCode]}>{texts.table.code}</Text>
          <Text style={[s.tableHeaderCell, s.colDesc]}>
            {texts.table.description}
          </Text>
          <Text style={[s.tableHeaderCell, s.colQty]}>{texts.table.quantity}</Text>
          {showLinePrices ? (
            <>
              <Text style={[s.tableHeaderCell, s.colUnit]}>
                {texts.table.unitPrice}
                {"\n"}({currencyLabel})
              </Text>
              <Text style={[s.tableHeaderCell, s.colTotal]}>
                {texts.table.total}
                {"\n"}({currencyLabel})
              </Text>
            </>
          ) : null}
        </View>

        {lines.map((line, index) => (
          <ProductBlock
            key={line.id ?? `line-${index}`}
            line={line}
            index={index + 1}
            currency={currency}
            showLinePrices={showLinePrices}
            optionLabel={texts.optionLabel}
            imageDataUrl={
              showImages ? imageDataUrls[lineImageKey(line, index)] : undefined
            }
          />
        ))}

        {showLinePrices ? (
          <View style={s.totalsBlock} wrap={false}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>{texts.subtotal}</Text>
              <Text style={s.totalCurrency}>{currencyLabel}</Text>
              <Text style={s.totalValue}>
                {formatTl(priceSummary?.totalAfterDiscount ?? priceSummary?.subtotal ?? 0, currency)}
              </Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>{texts.total}</Text>
              <Text style={s.totalCurrency}>{currencyLabel}</Text>
              <Text style={s.totalValue}>
                {formatTl(priceSummary?.totalAfterTax ?? 0, currency)}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={s.footerRow} wrap={false}>
          <View style={s.footerCol}>
            <Text style={s.footerTitle}>{texts.footer.deliveryTitle}</Text>
            <Text style={s.footerBody}>{texts.footer.delivery}</Text>
          </View>
          <View style={s.footerCol}>
            <Text style={s.footerTitle}>{texts.footer.paymentTitle}</Text>
            <Text style={s.footerBody}>{texts.footer.payment}</Text>
          </View>
          <View style={s.footerCol}>
            <Text style={s.footerTitle}>{texts.footer.validationTitle}</Text>
            <Text style={s.footerBody}>{texts.footer.validation}</Text>
          </View>
          <View style={s.footerCol}>
            <Text style={s.footerTitle}>{texts.footer.termsTitle}</Text>
            <Text style={s.footerBody}>{texts.footer.terms}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
