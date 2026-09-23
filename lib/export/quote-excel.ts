import { apiErrorMessage } from "@/lib/api/errors";
import { listQuotes } from "@/lib/api/generated/endpoints/quotes/quotes";
import type {
  QuoteReportProductResponse,
  QuoteReportStatsResponse,
  QuoteSummaryResponse,
} from "@/lib/api/generated/model";
import { downloadWorkbook, exportFilename, type ExcelColumn } from "@/lib/export/excel";
import { parseIsoDate } from "@/lib/pdf/format";

const QUOTE_PAGE_SIZE = 200;

const quoteColumns: ExcelColumn[] = [
  { header: "Numara", key: "quoteNumber", width: 16 },
  { header: "Versiyon", key: "versionNumber", width: 12 },
  { header: "Tarih", key: "quotedDate", width: 14, numFmt: "dd.mm.yyyy" },
  { header: "Kurum", key: "institution", width: 28 },
  { header: "Yetkili", key: "contactPerson", width: 22 },
  {
    header: "Tutar (KDV dahil)",
    key: "totalAfterTax",
    width: 20,
    numFmt: "#,##0.00",
  },
  { header: "Durum", key: "status", width: 12 },
];

const productColumns: ExcelColumn[] = [
  { header: "Ürün", key: "name", width: 32 },
  { header: "Kod", key: "code", width: 16 },
  { header: "Adet", key: "quantity", width: 10 },
  {
    header: "Satır toplamı (KDV hariç)",
    key: "total",
    width: 26,
    numFmt: "#,##0.00",
  },
];

const statsColumns: ExcelColumn[] = [
  { header: "Gösterge", key: "label", width: 28 },
  { header: "Değer", key: "value", width: 18, numFmt: "#,##0.00" },
];

function quoteDate(value?: string): Date | string {
  if (!value?.trim()) return "";
  return parseIsoDate(value);
}

function quoteRows(quotes: QuoteSummaryResponse[]) {
  return quotes.map((item) => ({
    quoteNumber: item.quoteNumber ?? "",
    versionNumber: item.versionNumber ?? 1,
    quotedDate: quoteDate(item.quotedDate),
    institution: item.institution ?? "",
    contactPerson: item.contactPerson ?? "",
    totalAfterTax: item.totalAfterTax ?? 0,
    status: item.convertedToSale ? "Satış" : "Teklif",
  }));
}

export async function downloadReportExcel({
  quotes,
  products,
  stats,
}: {
  quotes: QuoteSummaryResponse[];
  products: QuoteReportProductResponse[];
  stats: QuoteReportStatsResponse;
}): Promise<void> {
  await downloadWorkbook(exportFilename("rapor"), [
    { name: "Teklifler", columns: quoteColumns, rows: quoteRows(quotes) },
    {
      name: "Ürünler",
      columns: productColumns,
      rows: products.map((row) => ({
        name: row.name ?? "",
        code: row.code ?? "",
        quantity: row.quantity ?? 0,
        total: row.total ?? 0,
      })),
    },
    {
      name: "Özet",
      columns: statsColumns,
      rows: [
        { label: "Toplam tutar", value: stats.totalAmount ?? 0 },
        { label: "Satışa dönüşen tutar", value: stats.convertedAmount ?? 0 },
        { label: "Teklif sayısı", value: stats.quoteCount ?? 0 },
        {
          label: "Satışa dönüşen teklif",
          value: stats.convertedQuoteCount ?? 0,
        },
      ],
    },
  ]);
}

export async function fetchAllQuoteSummaries(): Promise<QuoteSummaryResponse[]> {
  const all: QuoteSummaryResponse[] = [];
  let page = 0;
  while (page < 100) {
    const response = await listQuotes({
      page,
      size: QUOTE_PAGE_SIZE,
      sort: ["createdAt,desc"],
    });
    if (response.status !== 200) {
      throw new Error(apiErrorMessage(response.data, "Teklifler yüklenemedi."));
    }
    const content = response.data.content ?? [];
    all.push(...content);
    if (response.data.last || content.length === 0) {
      return all;
    }
    page += 1;
  }
  return all;
}

export async function downloadQuotesExcel(
  quotes: QuoteSummaryResponse[],
): Promise<void> {
  await downloadWorkbook(exportFilename("teklifler"), [
    { name: "Teklifler", columns: quoteColumns, rows: quoteRows(quotes) },
  ]);
}
