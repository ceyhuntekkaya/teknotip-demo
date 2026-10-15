"use client";

import type { MouseEvent } from "react";
import type { ProductResponse, QuoteLineResponse, QuoteResponse } from "@/lib/api/generated/model";

export type SheetField =
  | "phone"
  | "email"
  | "address"
  | "department"
  | "discount"
  | "currency"
  | "validity"
  | "sales-conditions"
  | "delivery-time"
  | "delivery-mode"
  | "commercial"
  | "payment-terms"
  | "provisions"
  | "delivery"
  | "payment"
  | "validation"
  | "trade-terms";

export type SheetIntent =
  | { kind: "add"; anchor: DOMRect }
  | { kind: "edit-line"; index: number }
  | { kind: "delete-line"; index: number }
  | { kind: "move-line"; index: number; direction: -1 | 1 }
  | { kind: "edit-date" }
  | { kind: "edit-tax" }
  | { kind: "edit-institution" }
  | { kind: "edit-contact" }
  | { kind: "edit-field"; field: SheetField };

export function hotZone(onEdit: (() => void) | undefined, title: string) {
  if (!onEdit) return {};
  return {
    className: "sheet-hot",
    title,
    onClick: (event: MouseEvent<HTMLElement>) => {
      const target = event.target;
      if (target instanceof Element && target.closest("button, a")) return;
      event.preventDefault();
      event.stopPropagation();
      onEdit();
    },
  };
}

export type QuoteSheetProps = {
  quote: QuoteResponse;
  products: ProductResponse[];
  showImages: boolean;
  emptyHint?: string;
  canSave?: boolean;
  activeLineIndex?: number | null;
  onSaveInstitution?: () => void;
  onSaveContact?: () => void;
  onAddToCatalog?: (line: QuoteLineResponse, index: number) => void;
  onIntent?: (intent: SheetIntent) => void;
};

export function bindRowEdit(onEdit?: () => void) {
  if (!onEdit) return {};
  return {
    className: "sheet-row-edit",
    onClick: (event: MouseEvent<HTMLElement>) => {
      const target = event.target;
      if (target instanceof Element && target.closest("button, a")) return;
      event.preventDefault();
      onEdit();
    },
  };
}

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
