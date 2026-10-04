import { MilimlabQuoteDocument } from "@/components/pdf/milimlab-quote-document";
import { OptosenseQuoteDocument } from "@/components/pdf/optosense-quote-document";
import { TeknotipQuoteDocument } from "@/components/pdf/teknotip-quote-document";
import type { QuoteResponse } from "@/lib/api/generated/model";
import { DEFAULT_BRAND, isBrandId } from "@/lib/brand/brands";

type Props = {
  quote: QuoteResponse;
  origin: string;
  showImages?: boolean;
  imageDataUrls?: Record<string, string>;
};

export function QuotePdfDocument({
  quote,
  origin,
  showImages = false,
  imageDataUrls = {},
}: Props) {
  const brand = isBrandId(quote.brand) ? quote.brand : DEFAULT_BRAND;
  const shared = { quote, origin, showImages, imageDataUrls };

  if (brand === "OPTOSENSE") {
    return <OptosenseQuoteDocument {...shared} />;
  }
  if (brand === "MILIMLAB") {
    return <MilimlabQuoteDocument {...shared} />;
  }
  return <TeknotipQuoteDocument {...shared} />;
}
