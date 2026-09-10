"use client";

import { GROUP_STATES, GROUP_TYPES, PROPERTY_STATES } from "@/lib/catalog/types";
import type { Catalog, CatalogPath, GroupState, GroupType, PropertyState } from "@/lib/catalog/types";
import { GROUP_STATE_LABELS, GROUP_TYPE_LABELS, PROPERTY_STATE_LABELS } from "@/lib/catalog/types";
import { breadcrumbLabels, canMove } from "@/lib/catalog/path";
import {
  ActionButton,
  Field,
  NumberInput,
  OptionalPriceInput,
  Select,
  TextArea,
  TextInput,
} from "./fields";

export type InspectorHandlers = {
  onSelect: (path: CatalogPath) => void;
  onAddProduct: () => void;
  onAddModel: (p: number) => void;
  onAddGroup: (p: number) => void;
  onAddProperty: (p: number, g: number) => void;
  onAddChoice: (p: number, g: number, pr: number) => void;
  onUpdateProductName: (p: number, name: string) => void;
  onUpdateModel: (
    p: number,
    m: number,
    patch: Partial<{
      name: string;
      price: number;
      description: string;
      image: string;
      category: string;
    }>,
  ) => void;
  onUpdateGroup: (
    p: number,
    g: number,
    patch: Partial<{ name: string; state: GroupState; type: GroupType }>,
  ) => void;
  onUpdateProperty: (
    p: number,
    g: number,
    pr: number,
    patch: Partial<{
      name: string;
      price: number | undefined;
      state: PropertyState | undefined;
    }>,
  ) => void;
  onToggleChoices: (p: number, g: number, pr: number, enabled: boolean) => void;
  onUpdateChoice: (
    p: number,
    g: number,
    pr: number,
    c: number,
    patch: Partial<{ name: string; price: number | undefined }>,
  ) => void;
  onMove: (path: CatalogPath, dir: -1 | 1) => void;
  onRequestDelete: (path: CatalogPath) => void;
};

type InspectorPaneProps = {
  catalog: Catalog;
  selection: CatalogPath | null;
  handlers: InspectorHandlers;
};

export function InspectorPane({ catalog, selection, handlers }: InspectorPaneProps) {
  const crumbs = selection ? breadcrumbLabels(catalog, selection) : [];

  return (
    <section className="flex min-h-0 flex-col border border-[var(--rule)] bg-[var(--paper)]">
      <header className="border-b border-[var(--rule)] px-4 py-3">
        <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
          Düzenle
        </p>
        <h2 className="font-display text-2xl leading-none tracking-wide">Kayıt</h2>
        {crumbs.length ? (
          <p className="mt-2 truncate text-xs text-[var(--steel)]">{crumbs.join(" › ")}</p>
        ) : (
          <p className="mt-2 text-xs text-[var(--steel)]">
            Soldan bir öğe seç veya yeni bir aile ekle.
          </p>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!selection ? (
          <div className="grid gap-4">
            <p className="text-sm text-[var(--steel)]">
              Katalog boş veya seçim yok. Yeni bir ürün ailesi ile başla.
            </p>
            <ActionButton tone="heat" onClick={handlers.onAddProduct}>
              Ürün ailesi ekle
            </ActionButton>
          </div>
        ) : (
          <div key={JSON.stringify(selection)} className="grid gap-5">
            <Toolbar
              catalog={catalog}
              path={selection}
              onMove={handlers.onMove}
              onRequestDelete={handlers.onRequestDelete}
            />
            {selection.kind === "product" ? (
              <ProductForm catalog={catalog} path={selection} handlers={handlers} />
            ) : null}
            {selection.kind === "model" ? (
              <ModelForm catalog={catalog} path={selection} handlers={handlers} />
            ) : null}
            {selection.kind === "group" ? (
              <GroupForm catalog={catalog} path={selection} handlers={handlers} />
            ) : null}
            {selection.kind === "property" ? (
              <PropertyForm catalog={catalog} path={selection} handlers={handlers} />
            ) : null}
            {selection.kind === "choice" ? (
              <ChoiceForm catalog={catalog} path={selection} handlers={handlers} />
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function Toolbar({
  catalog,
  path,
  onMove,
  onRequestDelete,
}: {
  catalog: Catalog;
  path: CatalogPath;
  onMove: (path: CatalogPath, dir: -1 | 1) => void;
  onRequestDelete: (path: CatalogPath) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <ActionButton disabled={!canMove(catalog, path, -1)} onClick={() => onMove(path, -1)}>
        Yukarı
      </ActionButton>
      <ActionButton disabled={!canMove(catalog, path, 1)} onClick={() => onMove(path, 1)}>
        Aşağı
      </ActionButton>
      <ActionButton tone="danger" onClick={() => onRequestDelete(path)}>
        Sil
      </ActionButton>
    </div>
  );
}

function IdField({ id }: { id: string }) {
  return (
    <Field label="Kimlik">
      <div className="flex gap-2">
        <TextInput readOnly value={id} className="font-mono text-xs" />
        <ActionButton
          onClick={() => {
            void navigator.clipboard.writeText(id);
          }}
        >
          Kopyala
        </ActionButton>
      </div>
    </Field>
  );
}

function ProductForm({
  catalog,
  path,
  handlers,
}: {
  catalog: Catalog;
  path: Extract<CatalogPath, { kind: "product" }>;
  handlers: InspectorHandlers;
}) {
  const product = catalog[path.p];
  if (!product) return null;

  return (
    <div className="grid gap-4">
      <IdField id={product.id} />
      <Field label="Aile adı">
        <TextInput
          autoFocus
          value={product.name}
          onChange={(event) => handlers.onUpdateProductName(path.p, event.target.value)}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        <ActionButton onClick={() => handlers.onAddModel(path.p)}>Model ekle</ActionButton>
        <ActionButton onClick={() => handlers.onAddGroup(path.p)}>
          Özellik grubu ekle
        </ActionButton>
      </div>
      <ChildList
        title="Modeller"
        empty="Model yok."
        items={product.models.map((model, index) => ({
          label: model.name,
          meta: String(model.price),
          onClick: () => handlers.onSelect({ kind: "model", p: path.p, m: index }),
        }))}
      />
      <ChildList
        title="Özellik grupları"
        empty="Grup yok."
        items={product.propertyGroups.map((group, index) => ({
          label: group.name,
          meta: `${GROUP_STATE_LABELS[group.state] ?? group.state} · ${GROUP_TYPE_LABELS[group.type] ?? group.type}`,
          onClick: () => handlers.onSelect({ kind: "group", p: path.p, g: index }),
        }))}
      />
    </div>
  );
}

function ModelForm({
  catalog,
  path,
  handlers,
}: {
  catalog: Catalog;
  path: Extract<CatalogPath, { kind: "model" }>;
  handlers: InspectorHandlers;
}) {
  const model = catalog[path.p]?.models[path.m];
  if (!model) return null;

  return (
    <div className="grid gap-4">
      <IdField id={model.id} />
      <Field label="Model adı">
        <TextInput
          autoFocus
          value={model.name}
          onChange={(event) =>
            handlers.onUpdateModel(path.p, path.m, { name: event.target.value })
          }
        />
      </Field>
      <Field label="Taban fiyat">
        <NumberInput
          min={0}
          value={model.price}
          onChange={(event) =>
            handlers.onUpdateModel(path.p, path.m, {
              price: Number(event.target.value) || 0,
            })
          }
        />
      </Field>
      <Field label="Açıklama">
        <TextArea
          value={model.description}
          onChange={(event) =>
            handlers.onUpdateModel(path.p, path.m, { description: event.target.value })
          }
        />
      </Field>
      <Field label="Görsel URL">
        <TextInput
          value={model.image}
          onChange={(event) =>
            handlers.onUpdateModel(path.p, path.m, { image: event.target.value })
          }
        />
      </Field>
      <Field label="Kategori">
        <TextInput
          value={model.category}
          onChange={(event) =>
            handlers.onUpdateModel(path.p, path.m, { category: event.target.value })
          }
        />
      </Field>
    </div>
  );
}

function GroupForm({
  catalog,
  path,
  handlers,
}: {
  catalog: Catalog;
  path: Extract<CatalogPath, { kind: "group" }>;
  handlers: InspectorHandlers;
}) {
  const group = catalog[path.p]?.propertyGroups[path.g];
  if (!group) return null;

  return (
    <div className="grid gap-4">
      <IdField id={group.id} />
      <Field label="Grup adı">
        <TextInput
          autoFocus
          value={group.name}
          onChange={(event) =>
            handlers.onUpdateGroup(path.p, path.g, { name: event.target.value })
          }
        />
      </Field>
      <Field label="Durum">
        <Select
          value={group.state}
          onChange={(event) =>
            handlers.onUpdateGroup(path.p, path.g, {
              state: event.target.value as GroupState,
            })
          }
        >
          {GROUP_STATES.map((state) => (
            <option key={state} value={state}>
              {GROUP_STATE_LABELS[state]} ({state})
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Tip">
        <Select
          value={group.type}
          onChange={(event) =>
            handlers.onUpdateGroup(path.p, path.g, {
              type: event.target.value as GroupType,
            })
          }
        >
          {GROUP_TYPES.map((type) => (
            <option key={type} value={type}>
              {GROUP_TYPE_LABELS[type]} ({type})
            </option>
          ))}
        </Select>
      </Field>
      <ActionButton onClick={() => handlers.onAddProperty(path.p, path.g)}>
        Özellik ekle
      </ActionButton>
      <ChildList
        title="Özellikler"
        empty="Özellik yok."
        items={group.properties.map((property, index) => ({
          label: property.name,
          meta: property.choice?.length
            ? `${property.choice.length} seçenek`
            : "Toggle",
          onClick: () =>
            handlers.onSelect({
              kind: "property",
              p: path.p,
              g: path.g,
              pr: index,
            }),
        }))}
      />
    </div>
  );
}

function PropertyForm({
  catalog,
  path,
  handlers,
}: {
  catalog: Catalog;
  path: Extract<CatalogPath, { kind: "property" }>;
  handlers: InspectorHandlers;
}) {
  const property = catalog[path.p]?.propertyGroups[path.g]?.properties[path.pr];
  if (!property) return null;
  const hasChoices = Boolean(property.choice?.length);

  return (
    <div className="grid gap-4">
      <IdField id={property.id} />
      <Field label="Özellik adı">
        <TextInput
          autoFocus
          value={property.name}
          onChange={(event) =>
            handlers.onUpdateProperty(path.p, path.g, path.pr, {
              name: event.target.value,
            })
          }
        />
      </Field>
      <Field label="Zorunluluk (grup kuralını geçersiz kılar)">
        <Select
          value={property.state ?? ""}
          onChange={(event) =>
            handlers.onUpdateProperty(path.p, path.g, path.pr, {
              state: (event.target.value || undefined) as PropertyState | undefined,
            })
          }
        >
          <option value="">Gruptan miras</option>
          {PROPERTY_STATES.map((state) => (
            <option key={state} value={state}>
              {PROPERTY_STATE_LABELS[state]}
            </option>
          ))}
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hasChoices}
          onChange={(event) =>
            handlers.onToggleChoices(path.p, path.g, path.pr, event.target.checked)
          }
        />
        Seçenekli özellik
      </label>
      {hasChoices ? (
        <>
          <ActionButton onClick={() => handlers.onAddChoice(path.p, path.g, path.pr)}>
            Seçenek ekle
          </ActionButton>
          <ChildList
            title="Seçenekler"
            empty="Seçenek yok."
            items={(property.choice ?? []).map((choice, index) => ({
              label: choice.name,
              meta: choice.price !== undefined ? String(choice.price) : "",
              onClick: () =>
                handlers.onSelect({
                  kind: "choice",
                  p: path.p,
                  g: path.g,
                  pr: path.pr,
                  c: index,
                }),
            }))}
          />
        </>
      ) : (
        <Field label="Ek fiyat">
          <OptionalPriceInput
            value={property.price}
            onChange={(price) =>
              handlers.onUpdateProperty(path.p, path.g, path.pr, { price })
            }
          />
        </Field>
      )}
    </div>
  );
}

function ChoiceForm({
  catalog,
  path,
  handlers,
}: {
  catalog: Catalog;
  path: Extract<CatalogPath, { kind: "choice" }>;
  handlers: InspectorHandlers;
}) {
  const choice =
    catalog[path.p]?.propertyGroups[path.g]?.properties[path.pr]?.choice?.[path.c];
  if (!choice) return null;

  return (
    <div className="grid gap-4">
      <IdField id={choice.id} />
      <Field label="Seçenek adı">
        <TextInput
          autoFocus
          value={choice.name}
          onChange={(event) =>
            handlers.onUpdateChoice(path.p, path.g, path.pr, path.c, {
              name: event.target.value,
            })
          }
        />
      </Field>
      <Field label="Ek fiyat">
        <OptionalPriceInput
          value={choice.price}
          onChange={(price) =>
            handlers.onUpdateChoice(path.p, path.g, path.pr, path.c, { price })
          }
        />
      </Field>
    </div>
  );
}

function ChildList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: { label: string; meta?: string; onClick: () => void }[];
}) {
  return (
    <div className="grid gap-2">
      <p className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--steel)]">{empty}</p>
      ) : (
        <ul className="grid gap-1">
          {items.map((item, index) => (
            <li key={`${index}-${item.label}`}>
              <button
                type="button"
                onClick={item.onClick}
                className="flex w-full items-center justify-between gap-3 border border-[var(--rule)] px-3 py-2 text-left text-sm hover:border-[var(--charcoal)]"
              >
                <span>{item.label}</span>
                {item.meta ? (
                  <span className="font-mono text-[11px] text-[var(--steel)]">{item.meta}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
