"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ActionButton } from "@/components/catalog/fields";
import { InspectorPane, type InspectorHandlers } from "@/components/catalog/inspector-pane";
import { JsonPane } from "@/components/catalog/json-pane";
import { PreviewPane } from "@/components/catalog/preview-pane";
import { parseCatalog, stringifyCatalog } from "@/lib/catalog/normalize";
import {
  clampPath,
  disableChoices,
  enableChoices,
  insertChoice,
  insertGroup,
  insertModel,
  insertProduct,
  insertProperty,
  moveAt,
  removeAt,
  updateChoice,
  updateGroup,
  updateModel,
  updateProduct,
  updateProperty,
} from "@/lib/catalog/path";
import { alignPreview, initPreview } from "@/lib/catalog/price";
import type { Catalog, CatalogPath, PreviewState, PropertyState } from "@/lib/catalog/types";

function deleteCopy(path: CatalogPath): string {
  switch (path.kind) {
    case "product":
      return "Bu ürün ailesini ve içindeki tüm modelleri ile özellik gruplarını sil?";
    case "model":
      return "Bu modeli sil?";
    case "group":
      return "Bu özellik grubunu sil?";
    case "property":
      return "Bu özelliği sil?";
    case "choice":
      return "Bu seçeneği sil?";
  }
}

export function CatalogEditor({ initialCatalog }: { initialCatalog: Catalog }) {
  const [catalog, setCatalog] = useState<Catalog>(initialCatalog);
  const [selection, setSelection] = useState<CatalogPath | null>(
    initialCatalog.length ? { kind: "product", p: 0 } : null,
  );
  const [preview, setPreview] = useState<PreviewState>(() =>
    initPreview(initialCatalog, 0, 0),
  );
  const [jsonText, setJsonText] = useState(() => stringifyCatalog(initialCatalog));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonFocused, setJsonFocused] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    stringifyCatalog(initialCatalog),
  );
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [deleteTarget, setDeleteTarget] = useState<CatalogPath | null>(null);

  const catalogJson = useMemo(() => stringifyCatalog(catalog), [catalog]);
  const dirty = catalogJson !== savedSnapshot || jsonText !== savedSnapshot;

  const selectPath = useCallback(
    (path: CatalogPath | null) => {
      setSelection(path);
      if (!path) return;
      setPreview((prev) => {
        if (path.kind === "model") {
          if (prev.productIndex === path.p) {
            return prev.modelIndex === path.m ? prev : { ...prev, modelIndex: path.m };
          }
          return initPreview(catalog, path.p, path.m);
        }
        if (prev.productIndex !== path.p) {
          return initPreview(catalog, path.p, 0);
        }
        return prev;
      });
    },
    [catalog],
  );

  useEffect(() => {
    if (jsonFocused) return;
    setJsonText(catalogJson);
    setJsonError(null);
  }, [catalogJson, jsonFocused]);

  useEffect(() => {
    setPreview((prev) => alignPreview(catalog, prev));
    setSelection((prev) => clampPath(catalog, prev));
  }, [catalog]);

  useEffect(() => {
    if (!jsonFocused) return;
    const timer = window.setTimeout(() => {
      const parsed = parseCatalog(jsonText);
      if (!parsed.ok) {
        setJsonError(parsed.error);
        return;
      }
      setJsonError(null);
      setCatalog(parsed.catalog);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [jsonText, jsonFocused]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const apply = (result: { catalog: Catalog; path: CatalogPath | null }) => {
    setCatalog(result.catalog);
    if (result.path) selectPath(result.path);
    else setSelection(null);
  };

  const parseJsonNow = (text: string) => {
    const parsed = parseCatalog(text);
    if (!parsed.ok) {
      setJsonError(parsed.error);
      return false;
    }
    setJsonError(null);
    setCatalog(parsed.catalog);
    setJsonText(stringifyCatalog(parsed.catalog));
    return true;
  };

  const save = async () => {
    let payload = catalogJson;
    if (jsonFocused) {
      const parsed = parseCatalog(jsonText);
      if (!parsed.ok) {
        setJsonError(parsed.error);
        return;
      }
      payload = stringifyCatalog(parsed.catalog);
      setCatalog(parsed.catalog);
      setJsonError(null);
    } else if (jsonError) {
      return;
    }

    setSaveStatus("saving");
    try {
      const response = await fetch("/api/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: payload,
      });
      if (!response.ok) {
        setSaveStatus("error");
        return;
      }
      setSavedSnapshot(payload);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  };

  const handlers: InspectorHandlers = {
    onSelect: selectPath,
    onAddProduct: () => apply(insertProduct(catalog)),
    onAddModel: (p) => apply(insertModel(catalog, p)),
    onAddGroup: (p) => apply(insertGroup(catalog, p)),
    onAddProperty: (p, g) => apply(insertProperty(catalog, p, g)),
    onAddChoice: (p, g, pr) => apply(insertChoice(catalog, p, g, pr)),
    onUpdateProductName: (p, name) => setCatalog(updateProduct(catalog, p, { name })),
    onUpdateModel: (p, m, patch) => setCatalog(updateModel(catalog, p, m, patch)),
    onUpdateGroup: (p, g, patch) =>
      setCatalog(updateGroup(catalog, p, g, patch)),
    onUpdateProperty: (p, g, pr, patch) =>
      setCatalog(
        updateProperty(catalog, p, g, pr, patch as {
          name?: string;
          price?: number | undefined;
          state?: PropertyState | undefined;
        }),
      ),
    onToggleChoices: (p, g, pr, enabled) => {
      setCatalog(
        enabled ? enableChoices(catalog, p, g, pr) : disableChoices(catalog, p, g, pr),
      );
      if (enabled) {
        selectPath({ kind: "choice", p, g, pr, c: 0 });
      }
    },
    onUpdateChoice: (p, g, pr, c, patch) =>
      setCatalog(updateChoice(catalog, p, g, pr, c, patch)),
    onMove: (path, dir) => apply(moveAt(catalog, path, dir)),
    onRequestDelete: setDeleteTarget,
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    apply(removeAt(catalog, deleteTarget));
    setDeleteTarget(null);
  };

  const saveLabel =
    saveStatus === "saving"
      ? "Kaydediliyor"
      : saveStatus === "saved" && !dirty
        ? "Kaydedildi"
        : saveStatus === "error"
          ? "Kayıt başarısız"
          : "Kaydet";

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] px-4 py-3">
        <div>
          <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
            TeknoTip · Katalog
          </p>
          <h1 className="font-display text-3xl leading-none tracking-wide">
            Veri masası
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/teklif"
            className="inline-flex h-9 items-center justify-center border border-transparent px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--steel)] hover:text-[var(--charcoal)]"
          >
            Teklif
          </Link>
          {dirty ? (
            <span className="flex items-center gap-2 font-display text-[11px] uppercase tracking-[0.16em] text-[var(--heat)]">
              <span className="h-2 w-2 rounded-full bg-[var(--heat)]" />
              Kaydedilmedi
            </span>
          ) : (
            <span className="font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
              Güncel
            </span>
          )}
          <ActionButton
            tone="heat"
            disabled={!dirty || Boolean(jsonError) || saveStatus === "saving"}
            onClick={() => void save()}
          >
            {saveLabel}
          </ActionButton>
        </div>
      </header>

      <div className="grid min-h-[28rem] flex-1 grid-cols-1 gap-3 p-3 lg:h-[calc(100dvh-22rem)] lg:grid-cols-2">
        <PreviewPane
          catalog={catalog}
          selection={selection}
          preview={preview}
          onSelect={selectPath}
          onPreviewChange={setPreview}
          onAddProduct={handlers.onAddProduct}
        />
        <InspectorPane catalog={catalog} selection={selection} handlers={handlers} />
      </div>

      <div className="px-3 pb-3">
        <JsonPane
          value={jsonText}
          error={jsonError}
          onChange={(value) => {
            setJsonText(value);
            setSaveStatus("idle");
          }}
          onFocus={() => setJsonFocused(true)}
          onBlur={() => {
            setJsonFocused(false);
            parseJsonNow(jsonText);
          }}
          onCopy={() => {
            void navigator.clipboard.writeText(jsonText);
          }}
          onFormat={() => {
            parseJsonNow(jsonText);
          }}
        />
      </div>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[var(--soot)]/50 p-4">
          <div className="w-full max-w-md border border-[var(--rule)] bg-[var(--paper)] p-5 shadow-xl">
            <p className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
              Silinsin mi
            </p>
            <p className="mt-2 text-sm leading-relaxed">{deleteCopy(deleteTarget)}</p>
            <div className="mt-5 flex justify-end gap-2">
              <ActionButton onClick={() => setDeleteTarget(null)}>Vazgeç</ActionButton>
              <ActionButton tone="danger" onClick={confirmDelete}>
                Sil
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
