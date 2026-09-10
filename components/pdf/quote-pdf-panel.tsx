"use client";

import { pdf } from "@react-pdf/renderer";
import { useEffect, useState } from "react";
import { QuotePdfDocument } from "@/components/pdf/quote-document";
import { registerPdfFonts } from "@/lib/pdf/fonts";
import type { QuoteDocument } from "@/lib/quote/types";

export function QuotePdfPanel({
  quote,
  onUrl,
}: {
  quote: QuoteDocument;
  onUrl?: (url: string | null) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    const run = async () => {
      setLoading(true);
      setError(null);
      onUrl?.(null);
      try {
        registerPdfFonts(window.location.origin);
        const blob = await pdf(
          <QuotePdfDocument quote={quote} origin={window.location.origin} />,
        ).toBlob();
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setUrl(objectUrl);
        onUrl?.(objectUrl);
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "PDF oluşturulamadı.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      onUrl?.(null);
    };
  }, [quote, onUrl]);

  if (loading) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center px-6 text-center text-sm text-[var(--steel)]">
        PDF hazırlanıyor…
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center px-6 text-center text-sm text-[#8f2d1f]">
        {error ?? "PDF oluşturulamadı."}
      </div>
    );
  }

  return (
    <iframe
      title="Teklif PDF"
      src={`${url}#view=FitH`}
      className="min-h-0 min-w-0 w-full flex-1 border-0 bg-[#525659]"
    />
  );
}

export function quotePdfFilename(quoteNumber: string): string {
  const safe = quoteNumber.trim().replace(/[^\w.-]+/g, "_") || "teklif";
  return `${safe}.pdf`;
}
