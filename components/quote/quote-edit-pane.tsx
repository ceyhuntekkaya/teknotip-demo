"use client";

import { useEffect, useState } from "react";
import { NumberInput } from "@/components/catalog/fields";
import { normalizeGroupState, normalizeGroupType } from "@/lib/catalog/normalize";
import { formatAddOn, formatTry } from "@/lib/catalog/price";
import {
  allowsMultipleChoices,
  isPropertyLocked,
  type MissingSlot,
} from "@/lib/catalog/rules";
import {
  GROUP_STATE_LABELS,
  GROUP_TYPE_LABELS,
  type Catalog,
  type GroupPreview,
  type Product,
  type ProductModel,
  type Property,
  type PropertyGroup,
} from "@/lib/catalog/types";
import {
  addPropertyAction,
  groupPreviewFromSelections,
  modelIndexForLine,
  removePropertyAction,
  setChoiceAction,
  setModelAction,
  setPriceAction,
  setQuantityAction,
  toggleChoiceIndexes,
} from "@/lib/quote/line-preview";
import { propertyAddOn } from "@/lib/quote/price";
import type {
  ApplyWarning,
  ChatAction,
  QuoteDocument,
  QuoteDraft,
  QuoteLine,
  QuoteLineSelection,
} from "@/lib/quote/types";

function quotedExtra(
  property: Property,
  selection: QuoteLineSelection | undefined,
): number {
  if (typeof selection?.priceOverride === "number") return selection.priceOverride;
  return propertyAddOn(property, selection?.choiceIds ?? []);
}

function PriceInput({
  value,
  onCommit,
  className = "h-9 w-24",
  "aria-label": ariaLabel,
}: {
  value: number;
  onCommit: (price: number) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(String(value));
  }, [value, focused]);

  const commit = () => {
    setFocused(false);
    const next = Number(text);
    if (!Number.isFinite(next) || next < 0) {
      setText(String(value));
      return;
    }
    if (next === value) return;
    onCommit(next);
  };

  return (
    <NumberInput
      min={0}
      aria-label={ariaLabel}
      className={className}
      value={text}
      onClick={(event) => event.stopPropagation()}
      onFocus={() => setFocused(true)}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

type QuoteEditPaneProps = {
  catalog: Catalog;
  draft: QuoteDraft;
  quote: QuoteDocument;
  missing: MissingSlot[];
  warnings: ApplyWarning[];
  onActions: (actions: ChatAction[]) => void;
};

export function QuoteEditPane({
  catalog,
  draft,
  quote,
  missing,
  warnings,
  onActions,
}: QuoteEditPaneProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {warnings.length ? (
          <ul className="mb-4 grid gap-1 text-xs text-[#8f2d1f]">
            {warnings.map((warning, index) => (
              <li key={`${warning.op}-${index}`}>{warning.message}</li>
            ))}
          </ul>
        ) : null}

        {missing.length ? (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {missing.map((slot) => (
              <span
                key={`${slot.groupId}-${slot.propertyId ?? "group"}`}
                className="bg-[var(--heat)]/15 px-2 py-1 font-display text-[11px] uppercase tracking-[0.12em] text-[var(--heat)]"
              >
                Eksik: {slot.label}
              </span>
            ))}
          </div>
        ) : null}

        {draft.items.length === 0 ? (
          <p className="grid place-items-center px-6 py-16 text-center text-sm text-[var(--steel)]">
            Soldan bir ürün isteyin.
          </p>
        ) : (
          <div className="grid gap-5">
            {draft.items.map((line, index) => {
              const product = catalog.find((item) => item.id === line.productId);
              if (!product) {
                return (
                  <p key={line.lineId} className="text-sm text-[var(--steel)]">
                    S{index + 1}: katalogda bulunamayan ürün.
                  </p>
                );
              }
              const priced = quote.products.find((item) => item.lineId === line.lineId);
              return (
                <LineEditor
                  key={line.lineId}
                  index={index}
                  product={product}
                  line={line}
                  lineTotal={priced?.lineTotal ?? 0}
                  onActions={onActions}
                />
              );
            })}
          </div>
        )}
      </div>

      <footer className="grid grid-cols-[1fr_auto] items-end gap-4 bg-[var(--soot)] px-4 py-3 text-[var(--paper)]">
        <div className="grid gap-1 text-[11px] uppercase tracking-[0.16em] text-[var(--heat-soft)]">
          <span>Ara {formatTry(quote.priceSummary.subtotal)}</span>
          <span>
            KDV %{quote.priceSummary.taxRatePercent} {formatTry(quote.priceSummary.tax)}
          </span>
        </div>
        <div className="text-right">
          <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--heat-soft)]">
            Genel toplam
          </p>
          <p className="kiln-readout font-mono text-3xl leading-none text-[var(--heat-soft)]">
            {formatTry(quote.priceSummary.totalAfterTax)}
          </p>
        </div>
      </footer>
    </div>
  );
}

function LineEditor({
  index,
  product,
  line,
  lineTotal,
  onActions,
}: {
  index: number;
  product: Product;
  line: QuoteLine;
  lineTotal: number;
  onActions: (actions: ChatAction[]) => void;
}) {
  const modelIndex = modelIndexForLine(product, line.modelId);
  const model = product.models[modelIndex];
  const basePrice = line.basePriceOverride ?? model?.price ?? 0;

  return (
    <article className="border border-[var(--rule)]">
      <div className="flex flex-wrap items-start justify-between gap-3 px-3 py-2.5">
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
            S{index + 1}
          </p>
          <h3 className="font-display text-lg uppercase tracking-[0.08em]">{product.name}</h3>
          <p className="text-sm text-[var(--steel)]">{model?.name ?? "Model yok"}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="grid gap-1">
            <span className="font-display text-[11px] uppercase tracking-[0.14em] text-[var(--steel)]">
              Adet
            </span>
            <NumberInput
              min={1}
              className="h-9 w-20"
              value={line.quantity}
              onChange={(event) => {
                const quantity = Math.floor(Number(event.target.value));
                if (!Number.isFinite(quantity) || quantity < 1 || quantity === line.quantity) {
                  return;
                }
                onActions([setQuantityAction(line.lineId, quantity)]);
              }}
            />
          </label>
          <label className="grid gap-1">
            <span className="font-display text-[11px] uppercase tracking-[0.14em] text-[var(--steel)]">
              Birim fiyat
            </span>
            <PriceInput
              aria-label={`${product.name} birim fiyat`}
              className="h-9 w-28"
              value={basePrice}
              onCommit={(price) => onActions([setPriceAction(line.lineId, price)])}
            />
          </label>
          <p className="font-mono text-sm text-[var(--heat)]">{formatTry(lineTotal)}</p>
        </div>
      </div>

      {product.models.length ? (
        <div className="border-t border-[var(--rule)] px-3 py-3">
          <p className="mb-2 font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
            Model
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {product.models.map((item) => (
              <ModelCard
                key={item.id}
                model={item}
                selected={item.id === line.modelId}
                onSelect={() => onActions([setModelAction(line.lineId, item.id)])}
              />
            ))}
          </div>
        </div>
      ) : null}

      {product.propertyGroups.map((group) => (
        <GroupSection
          key={group.id}
          group={group}
          preview={groupPreviewFromSelections(group, line.selections)}
          selections={line.selections}
          onToggleProperty={(property, selected) => {
            onActions([
              selected
                ? removePropertyAction(line.lineId, property)
                : addPropertyAction(line.lineId, property),
            ]);
          }}
          onChoice={(property, propertyIndex, choiceIndex) => {
            const current = groupPreviewFromSelections(group, line.selections);
            const selected = current.selected.includes(propertyIndex);
            const nextIndexes = toggleChoiceIndexes(
              selected ? (current.choices[propertyIndex] ?? []) : [],
              choiceIndex,
              allowsMultipleChoices(group),
            );
            onActions([setChoiceAction(line.lineId, group, property, nextIndexes)]);
          }}
          onPrice={(property, price) =>
            onActions([setPriceAction(line.lineId, price, property)])
          }
        />
      ))}
    </article>
  );
}

function ModelCard({
  model,
  selected,
  onSelect,
}: {
  model: ProductModel;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`border bg-[var(--alumina)] text-left transition-colors hover:border-[var(--charcoal)] ${
        selected ? "border-[var(--charcoal)]" : "border-[var(--rule)]"
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--soot)]">
        {model.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={model.image}
            alt=""
            className="h-full w-full object-cover opacity-90"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_18px,rgba(196,92,18,0.18)_18px,rgba(196,92,18,0.18)_19px)]" />
      </div>
      <div className="grid gap-1 px-2.5 py-2">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{model.name}</p>
        <p className="font-mono text-xs text-[var(--heat)]">{formatTry(model.price)}</p>
      </div>
    </button>
  );
}

function GroupSection({
  group,
  preview,
  selections,
  onToggleProperty,
  onChoice,
  onPrice,
}: {
  group: PropertyGroup;
  preview: GroupPreview;
  selections: QuoteLineSelection[];
  onToggleProperty: (property: Property, selected: boolean) => void;
  onChoice: (property: Property, propertyIndex: number, choiceIndex: number) => void;
  onPrice: (property: Property, price: number) => void;
}) {
  const state = normalizeGroupState(group.state);
  const choiceType = normalizeGroupType(group.type);
  const multipleChoices = choiceType === "multiple_choice";
  const badgeTone =
    state === "optional"
      ? "bg-[var(--vacuum-soft)] text-[var(--vacuum)]"
      : "bg-[var(--heat)]/15 text-[var(--heat)]";

  return (
    <section className="border-t border-[var(--rule)]">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <h3 className="font-display text-lg uppercase tracking-[0.08em]">{group.name}</h3>
        <span className="flex shrink-0 items-center gap-1.5">
          <span
            className={`px-2 py-0.5 font-display text-[11px] uppercase tracking-[0.14em] ${badgeTone}`}
          >
            {GROUP_STATE_LABELS[state]}
          </span>
          <span className="bg-[var(--alumina)] px-2 py-0.5 font-display text-[11px] uppercase tracking-[0.14em] text-[var(--steel)]">
            {GROUP_TYPE_LABELS[choiceType]}
          </span>
        </span>
      </div>
      <div className="grid gap-3 px-3 pb-3">
        {group.properties.length === 0 ? (
          <p className="text-sm text-[var(--steel)]">Bu grupta özellik yok.</p>
        ) : state === "required_one" ? (
          <div className="grid gap-2">
            {group.properties.map((property, propertyIndex) => {
              const selected = preview.selected.includes(propertyIndex);
              const selection = selections.find(
                (item) => item.groupId === group.id && item.propertyId === property.id,
              );
              return (
                <PropertyCard
                  key={property.id}
                  property={property}
                  selected={selected}
                  extra={quotedExtra(property, selection)}
                  exclusive
                  choiceIndexes={preview.choices[propertyIndex] ?? []}
                  multipleChoices={multipleChoices}
                  onSelectProperty={() => {
                    if (!selected) onToggleProperty(property, false);
                  }}
                  onChoice={(choiceIndex) => onChoice(property, propertyIndex, choiceIndex)}
                  onPrice={(price) => onPrice(property, price)}
                />
              );
            })}
          </div>
        ) : (
          group.properties.map((property, propertyIndex) => {
            const selected = preview.selected.includes(propertyIndex);
            const locked = isPropertyLocked(group, propertyIndex, preview.selected);
            const selection = selections.find(
              (item) => item.groupId === group.id && item.propertyId === property.id,
            );
            return (
              <PropertyRow
                key={property.id}
                property={property}
                selectable={state !== "required"}
                selected={selected}
                locked={Boolean(locked && selected)}
                extra={quotedExtra(property, selection)}
                choiceIndexes={preview.choices[propertyIndex] ?? []}
                multipleChoices={multipleChoices}
                onToggle={() => {
                  if (state === "required") return;
                  if (selected && locked) return;
                  onToggleProperty(property, selected);
                }}
                onChoice={(choiceIndex) => onChoice(property, propertyIndex, choiceIndex)}
                onPrice={(price) => onPrice(property, price)}
              />
            );
          })
        )}
      </div>
    </section>
  );
}

function PropertyPrice({
  property,
  selected,
  extra,
  multipleChoices,
  onPrice,
}: {
  property: Property;
  selected: boolean;
  extra: number;
  multipleChoices: boolean;
  onPrice: (price: number) => void;
}) {
  if (!selected) {
    if (property.choice?.length) return null;
    const addon = formatAddOn(property.price);
    if (!addon) return null;
    return <span className="font-mono text-xs text-[var(--steel)]">{addon}</span>;
  }

  if (!property.choice?.length) {
    return (
      <PriceInput
        aria-label={`${property.name} ek fiyat`}
        value={extra}
        onCommit={onPrice}
      />
    );
  }

  if (!multipleChoices) return null;

  const hasPrice =
    extra !== 0 || property.choice.some((choice) => (choice.price ?? 0) !== 0);
  if (!hasPrice) return null;

  return (
    <PriceInput
      aria-label={`${property.name} ek fiyat`}
      value={extra}
      onCommit={onPrice}
    />
  );
}

function PropertyCard({
  property,
  selected,
  extra,
  exclusive,
  choiceIndexes,
  multipleChoices,
  onSelectProperty,
  onChoice,
  onPrice,
}: {
  property: Property;
  selected: boolean;
  extra: number;
  exclusive?: boolean;
  choiceIndexes: number[];
  multipleChoices: boolean;
  onSelectProperty: () => void;
  onChoice: (choiceIndex: number) => void;
  onPrice: (price: number) => void;
}) {
  return (
    <div
      className={`border px-3 py-2 ${
        selected
          ? "border-[var(--heat)] bg-[var(--glow)]"
          : "border-[var(--rule)] bg-[var(--alumina)] text-[var(--steel)]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSelectProperty}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        >
          <span className="text-sm font-medium">
            {exclusive ? (
              <span className={`mr-2 font-mono ${selected ? "text-[var(--heat)]" : ""}`}>
                {selected ? "●" : "○"}
              </span>
            ) : null}
            {property.name}
          </span>
          {property.state ? (
            <span className="font-display text-[10px] uppercase tracking-[0.14em] text-[var(--steel)]">
              {property.state === "required" ? "Zorunlu" : "Opsiyonel"}
            </span>
          ) : null}
        </button>
        <PropertyPrice
          property={property}
          selected={selected}
          extra={extra}
          multipleChoices={multipleChoices}
          onPrice={onPrice}
        />
      </div>
      {selected ? (
        <ChoiceList
          property={property}
          extra={extra}
          choiceIndexes={choiceIndexes}
          multiple={multipleChoices}
          onChoice={onChoice}
          onPrice={onPrice}
        />
      ) : null}
    </div>
  );
}

function PropertyRow({
  property,
  selectable,
  selected,
  locked,
  extra,
  choiceIndexes,
  multipleChoices,
  onToggle,
  onChoice,
  onPrice,
}: {
  property: Property;
  selectable: boolean;
  selected: boolean;
  locked: boolean;
  extra: number;
  choiceIndexes: number[];
  multipleChoices: boolean;
  onToggle: () => void;
  onChoice: (choiceIndex: number) => void;
  onPrice: (price: number) => void;
}) {
  const inactive = !selected;

  return (
    <div className={`grid gap-2 p-1 ${inactive ? "bg-[var(--alumina)] text-[var(--steel)]" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (selectable) onToggle();
          }}
          disabled={selectable && locked}
          className="flex min-w-0 items-center gap-2 text-left disabled:cursor-not-allowed"
        >
          {selectable ? (
            <span
              className={`grid h-4 w-4 place-items-center border text-[10px] ${
                selected
                  ? "border-[var(--heat)] bg-[var(--heat)] text-[var(--paper)]"
                  : "border-[var(--steel)]"
              }`}
            >
              {selected ? "✓" : ""}
            </span>
          ) : null}
          <span className={`text-sm font-medium ${inactive ? "text-[var(--steel)]" : ""}`}>
            {property.name}
          </span>
          {locked && selectable ? (
            <span className="font-display text-[10px] uppercase tracking-[0.12em] text-[var(--steel)]">
              kilitli
            </span>
          ) : null}
        </button>
        <PropertyPrice
          property={property}
          selected={selected}
          extra={extra}
          multipleChoices={multipleChoices}
          onPrice={onPrice}
        />
      </div>
      {selected || !selectable ? (
        <ChoiceList
          property={property}
          extra={extra}
          choiceIndexes={choiceIndexes}
          multiple={multipleChoices}
          muted={inactive}
          onChoice={onChoice}
          onPrice={onPrice}
        />
      ) : null}
    </div>
  );
}

function ChoiceList({
  property,
  extra,
  choiceIndexes,
  multiple,
  muted = false,
  onChoice,
  onPrice,
}: {
  property: Property;
  extra: number;
  choiceIndexes: number[];
  multiple: boolean;
  muted?: boolean;
  onChoice: (choiceIndex: number) => void;
  onPrice: (price: number) => void;
}) {
  if (!property.choice?.length) return null;
  const selected = choiceIndexes.length ? choiceIndexes : [];
  const editChoicePrice = !multiple;

  return (
    <div className="flex flex-wrap gap-1.5">
      {property.choice.map((choice, index) => {
        const active = selected.includes(index);
        const catalogAddon = formatAddOn(choice.price);
        const showChoicePrice =
          active && editChoicePrice && (choice.price !== undefined || extra !== 0);
        return (
          <div
            key={choice.id}
            className={`flex items-center gap-1.5 border px-2.5 py-1.5 text-sm ${
              active
                ? "border-[var(--heat)] bg-[var(--heat)] text-[var(--paper)]"
                : muted
                  ? "border-[var(--rule)] text-[var(--steel)]"
                  : "border-[var(--rule)] hover:border-[var(--charcoal)]"
            }`}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChoice(index);
              }}
              className="text-left"
            >
              {multiple ? (
                <span className="mr-1.5 font-mono text-[11px]">{active ? "☑" : "☐"}</span>
              ) : null}
              <span>{choice.name}</span>
            </button>
            {showChoicePrice ? (
              <PriceInput
                aria-label={`${property.name} ${choice.name} ek fiyat`}
                className="h-7 w-20 border-[var(--paper)]/40 bg-[var(--paper)] text-[var(--charcoal)]"
                value={extra}
                onCommit={onPrice}
              />
            ) : catalogAddon ? (
              <span
                className={`font-mono text-[11px] ${
                  active ? "text-[var(--paper)]" : muted ? "text-[var(--steel)]" : "text-[var(--heat)]"
                }`}
              >
                {catalogAddon}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}