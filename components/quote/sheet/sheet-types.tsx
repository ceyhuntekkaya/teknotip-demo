"use client";

import type { ProductResponse, QuoteLineResponse, QuoteResponse } from "@/lib/api/generated/model";

export type QuoteSheetProps = {
  quote: QuoteResponse;
  products: ProductResponse[];
  showImages: boolean;
  emptyHint?: string;
  canSave?: boolean;
  onSaveInstitution?: () => void;
  onSaveContact?: () => void;
  onAddToCatalog?: (line: QuoteLineResponse, index: number) => void;
};

export function SheetAction({
  children,
  title,
  onClick,
}: {
  children: string;
  title: string;
  onClick?: () => void;
}) {
  if (!onClick) return null;
  return (
    <button type="button" className="sheet-action" title={title} onClick={onClick}>
      {children}
    </button>
  );
}
