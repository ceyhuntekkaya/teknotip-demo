"use client";

import { GROUP_STATE_LABELS, GROUP_TYPE_LABELS } from "@/lib/catalog/types";
import type {
  Catalog,
  CatalogPath,
  GroupPreview,
  PreviewState,
  Product,
  Property,
  PropertyGroup,
} from "@/lib/catalog/types";
import { normalizeGroupState, normalizeGroupType } from "@/lib/catalog/normalize";
import { pathTouches, pathsEqual } from "@/lib/catalog/path";
import {
  formatAddOn,
  formatTry,
  previewTotal,
} from "@/lib/catalog/price";

type PreviewPaneProps = {
  catalog: Catalog;
  selection: CatalogPath | null;
  preview: PreviewState;
  onSelect: (path: CatalogPath) => void;
  onPreviewChange: (preview: PreviewState) => void;
  onAddProduct: () => void;
};

function selectedClass(selection: CatalogPath | null, path: CatalogPath): string {
  if (pathsEqual(selection, path)) {
    return "outline outline-2 outline-[var(--heat)] outline-offset-[-1px]";
  }
  if (pathTouches(selection, path)) {
    return "bg-[var(--glow)]";
  }
  return "";
}

function updateGroup(
  preview: PreviewState,
  groupIndex: number,
  nextGroup: GroupPreview,
): PreviewState {
  const groups = preview.groups.map((group, index) =>
    index === groupIndex ? nextGroup : group,
  );
  return { ...preview, groups };
}

function withChoice(
  group: GroupPreview,
  propertyIndex: number,
  choiceIndex: number,
  multiple: boolean,
): GroupPreview {
  const current = group.choices[propertyIndex] ?? [];
  let next: number[];
  if (multiple) {
    next = current.includes(choiceIndex)
      ? current.filter((index) => index !== choiceIndex)
      : [...current, choiceIndex];
    if (!next.length && current.length) next = current;
  } else {
    next = [choiceIndex];
  }
  return {
    ...group,
    selected: group.selected.includes(propertyIndex)
      ? group.selected
      : [...group.selected, propertyIndex],
    choices: { ...group.choices, [propertyIndex]: next },
  };
}

export function PreviewPane({
  catalog,
  selection,
  preview,
  onSelect,
  onPreviewChange,
  onAddProduct,
}: PreviewPaneProps) {
  const product = catalog[preview.productIndex];
  const totals = previewTotal(catalog, preview);

  return (
    <section className="flex min-h-0 flex-col border border-[var(--rule)] bg-[var(--paper)]">
      <header className="flex items-end justify-between gap-4 border-b border-[var(--rule)] px-4 py-3">
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
            Müşteri görünümü
          </p>
          <h2 className="font-display text-2xl leading-none tracking-wide">
            Yapılandır
          </h2>
        </div>
        <p className="max-w-48 text-right text-[11px] leading-snug text-[var(--steel)]">
          Bir öğeye tıkla, sağdaki form o kaydı açsın.
        </p>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--rule)] px-2 py-2">
        {catalog.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect({ kind: "product", p: index })}
            className={`shrink-0 px-3 py-2 font-display text-[13px] uppercase tracking-[0.14em] transition-colors ${
              preview.productIndex === index
                ? "bg-[var(--soot)] text-[var(--paper)]"
                : "text-[var(--steel)] hover:bg-[var(--alumina)] hover:text-[var(--charcoal)]"
            } ${selectedClass(selection, { kind: "product", p: index })}`}
          >
            {item.name}
          </button>
        ))}
        <button
          type="button"
          onClick={onAddProduct}
          className="shrink-0 border border-dashed border-[var(--rule)] px-3 py-2 font-display text-[13px] uppercase tracking-[0.14em] text-[var(--steel)] hover:border-[var(--heat)] hover:text-[var(--heat)]"
        >
          + Aile
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {product ? (
          <ProductPreview
            product={product}
            productIndex={preview.productIndex}
            preview={preview}
            selection={selection}
            onSelect={onSelect}
            onPreviewChange={onPreviewChange}
          />
        ) : (
          <div className="grid place-items-center px-6 py-16 text-center text-sm text-[var(--steel)]">
            Henüz ürün ailesi yok. Soldan veya sağdan bir aile ekle.
          </div>
        )}
      </div>

      <footer className="grid grid-cols-[1fr_auto] items-end gap-4 bg-[var(--soot)] px-4 py-3 text-[var(--paper)]">
        <div className="grid gap-1 text-[11px] uppercase tracking-[0.16em] text-[var(--heat-soft)]">
          <span>Taban {formatTry(totals.base)}</span>
          <span>Seçenek {formatTry(totals.extras)}</span>
        </div>
        <div className="text-right">
          <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--heat-soft)]">
            Toplam
          </p>
          <p className="kiln-readout font-mono text-3xl leading-none text-[var(--heat-soft)]">
            {formatTry(totals.total)}
          </p>
        </div>
      </footer>
    </section>
  );
}

function ProductPreview({
  product,
  productIndex,
  preview,
  selection,
  onSelect,
  onPreviewChange,
}: {
  product: Product;
  productIndex: number;
  preview: PreviewState;
  selection: CatalogPath | null;
  onSelect: (path: CatalogPath) => void;
  onPreviewChange: (preview: PreviewState) => void;
}) {
  return (
    <div className="grid gap-5 p-4">
      <div>
        <p className="mb-2 font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
          Model
        </p>
        {product.models.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {product.models.map((model, modelIndex) => (
              <button
                key={model.id}
                type="button"
                onClick={() => onSelect({ kind: "model", p: productIndex, m: modelIndex })}
                className={`border border-[var(--rule)] bg-[var(--alumina)] text-left transition-colors hover:border-[var(--charcoal)] ${
                  preview.modelIndex === modelIndex ? "border-[var(--charcoal)]" : ""
                } ${selectedClass(selection, { kind: "model", p: productIndex, m: modelIndex })}`}
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
            ))}
          </div>
        ) : (
          <p className="border border-dashed border-[var(--rule)] px-3 py-4 text-sm text-[var(--steel)]">
            Bu ailede model yok. Sağdan model ekle.
          </p>
        )}
      </div>

      {product.propertyGroups.map((group, groupIndex) => (
        <GroupSection
          key={group.id}
          group={group}
          groupIndex={groupIndex}
          productIndex={productIndex}
          preview={preview.groups[groupIndex] ?? { selected: [], choices: {} }}
          selection={selection}
          onSelect={onSelect}
          onGroupChange={(next) =>
            onPreviewChange(updateGroup(preview, groupIndex, next))
          }
        />
      ))}
    </div>
  );
}

function GroupSection({
  group,
  groupIndex,
  productIndex,
  preview,
  selection,
  onSelect,
  onGroupChange,
}: {
  group: PropertyGroup;
  groupIndex: number;
  productIndex: number;
  preview: GroupPreview;
  selection: CatalogPath | null;
  onSelect: (path: CatalogPath) => void;
  onGroupChange: (preview: GroupPreview) => void;
}) {
  const state = normalizeGroupState(group.state);
  const choiceType = normalizeGroupType(group.type);
  const multipleChoices = choiceType === "multiple_choice";
  const groupPath: CatalogPath = { kind: "group", p: productIndex, g: groupIndex };
  const badgeTone =
    state === "optional"
      ? "bg-[var(--vacuum-soft)] text-[var(--vacuum)]"
      : "bg-[var(--heat)]/15 text-[var(--heat)]";

  return (
    <section
      className={`border border-[var(--rule)] ${selectedClass(selection, groupPath)}`}
    >
      <button
        type="button"
        onClick={() => onSelect(groupPath)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
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
      </button>
      <div className="grid gap-3 border-t border-[var(--rule)] px-3 py-3">
        {group.properties.length === 0 ? (
          <p className="text-sm text-[var(--steel)]">Bu grupta özellik yok.</p>
        ) : state === "required_one" ? (
          <div className="grid gap-2">
            {group.properties.map((property, propertyIndex) => (
              <PropertyCard
                key={property.id}
                property={property}
                selected={preview.selected.includes(propertyIndex)}
                exclusive
                path={{ kind: "property", p: productIndex, g: groupIndex, pr: propertyIndex }}
                selection={selection}
                preview={preview}
                multipleChoices={multipleChoices}
                onSelect={onSelect}
                onSelectProperty={() => {
                  const choices = { ...preview.choices };
                  if (property.choice?.length && choices[propertyIndex] === undefined) {
                    choices[propertyIndex] = [0];
                  }
                  onGroupChange({ selected: [propertyIndex], choices });
                }}
                onChoice={(choiceIndex) =>
                  onGroupChange(
                    withChoice(
                      { ...preview, selected: [propertyIndex] },
                      propertyIndex,
                      choiceIndex,
                      multipleChoices,
                    ),
                  )
                }
              />
            ))}
          </div>
        ) : (
          group.properties.map((property, propertyIndex) => {
            const locked =
              (state === "required" && true) ||
              (state === "optional" && property.state === "required") ||
              (state === "required_multiple" &&
                preview.selected.length === 1 &&
                preview.selected[0] === propertyIndex);
            const selected = preview.selected.includes(propertyIndex);

            return (
              <PropertyRow
                key={property.id}
                property={property}
                selectable={state !== "required"}
                selected={selected}
                locked={Boolean(locked && selected)}
                path={{ kind: "property", p: productIndex, g: groupIndex, pr: propertyIndex }}
                selection={selection}
                preview={preview}
                multipleChoices={multipleChoices}
                onSelect={onSelect}
                onToggle={() => {
                  if (state === "required") return;
                  if (selected && locked) return;
                  const selectedIndexes = selected
                    ? preview.selected.filter((index) => index !== propertyIndex)
                    : [...preview.selected, propertyIndex];
                  const choices = { ...preview.choices };
                  if (!selected && property.choice?.length && choices[propertyIndex] === undefined) {
                    choices[propertyIndex] = [0];
                  }
                  onGroupChange({ selected: selectedIndexes, choices });
                }}
                onChoice={(choiceIndex) =>
                  onGroupChange(withChoice(preview, propertyIndex, choiceIndex, multipleChoices))
                }
              />
            );
          })
        )}
      </div>
    </section>
  );
}

function PropertyCard({
  property,
  selected,
  exclusive,
  path,
  selection,
  preview,
  multipleChoices,
  onSelect,
  onSelectProperty,
  onChoice,
}: {
  property: Property;
  selected: boolean;
  exclusive?: boolean;
  path: Extract<CatalogPath, { kind: "property" }>;
  selection: CatalogPath | null;
  preview: GroupPreview;
  multipleChoices: boolean;
  onSelect: (path: CatalogPath) => void;
  onSelectProperty: () => void;
  onChoice: (choiceIndex: number) => void;
}) {
  return (
    <div
      className={`border px-3 py-2 ${
        selected ? "border-[var(--heat)] bg-[var(--glow)]" : "border-[var(--rule)]"
      } ${selectedClass(selection, path)}`}
    >
      <button
        type="button"
        onClick={() => {
          onSelectProperty();
          onSelect(path);
        }}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-sm font-medium">
          {exclusive ? (
            <span className="mr-2 font-mono text-[var(--heat)]">{selected ? "●" : "○"}</span>
          ) : null}
          {property.name}
        </span>
        {property.state ? (
          <span className="font-display text-[10px] uppercase tracking-[0.14em] text-[var(--steel)]">
            {property.state === "required" ? "Zorunlu" : "Opsiyonel"}
          </span>
        ) : null}
      </button>
      {selected ? (
        <ChoiceList
          property={property}
          path={path}
          selection={selection}
          choiceIndexes={preview.choices[path.pr] ?? []}
          multiple={multipleChoices}
          onSelect={onSelect}
          onChoice={onChoice}
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
  path,
  selection,
  preview,
  multipleChoices,
  onSelect,
  onToggle,
  onChoice,
}: {
  property: Property;
  selectable: boolean;
  selected: boolean;
  locked: boolean;
  path: Extract<CatalogPath, { kind: "property" }>;
  selection: CatalogPath | null;
  preview: GroupPreview;
  multipleChoices: boolean;
  onSelect: (path: CatalogPath) => void;
  onToggle: () => void;
  onChoice: (choiceIndex: number) => void;
}) {
  const addon = property.choice?.length ? null : formatAddOn(property.price);

  return (
    <div className={`grid gap-2 ${selectedClass(selection, path)} p-1`}>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            if (selectable) onToggle();
            onSelect(path);
          }}
          className="flex min-w-0 items-center gap-2 text-left"
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
          <span className="text-sm font-medium">{property.name}</span>
          {locked && selectable ? (
            <span className="font-display text-[10px] uppercase tracking-[0.12em] text-[var(--steel)]">
              kilitli
            </span>
          ) : null}
        </button>
        {addon ? <span className="font-mono text-xs text-[var(--heat)]">{addon}</span> : null}
      </div>
      {selected || !selectable ? (
        <ChoiceList
          property={property}
          path={path}
          selection={selection}
          choiceIndexes={preview.choices[path.pr] ?? []}
          multiple={multipleChoices}
          onSelect={onSelect}
          onChoice={onChoice}
        />
      ) : null}
    </div>
  );
}

function ChoiceList({
  property,
  path,
  selection,
  choiceIndexes,
  multiple,
  onSelect,
  onChoice,
}: {
  property: Property;
  path: Extract<CatalogPath, { kind: "property" }>;
  selection: CatalogPath | null;
  choiceIndexes: number[];
  multiple: boolean;
  onSelect: (path: CatalogPath) => void;
  onChoice: (choiceIndex: number) => void;
}) {
  if (!property.choice?.length) return null;
  const selected = choiceIndexes.length ? choiceIndexes : [0];

  return (
    <div className="flex flex-wrap gap-1.5">
      {property.choice.map((choice, index) => {
        const choicePath: CatalogPath = { ...path, kind: "choice", c: index };
        const active = selected.includes(index);
        return (
          <button
            key={choice.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onChoice(index);
              onSelect(choicePath);
            }}
            className={`border px-2.5 py-1.5 text-left text-sm ${
              active
                ? "border-[var(--heat)] bg-[var(--heat)] text-[var(--paper)]"
                : "border-[var(--rule)] hover:border-[var(--charcoal)]"
            } ${selectedClass(selection, choicePath)}`}
          >
            {multiple ? (
              <span className="mr-1.5 font-mono text-[11px]">{active ? "☑" : "☐"}</span>
            ) : null}
            <span>{choice.name}</span>
            {formatAddOn(choice.price) ? (
              <span className={`ml-2 font-mono text-[11px] ${active ? "text-[var(--paper)]" : "text-[var(--heat)]"}`}>
                {formatAddOn(choice.price)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
