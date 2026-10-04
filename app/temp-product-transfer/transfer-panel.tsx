"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";

type PendingItem = {
  id: string;
  code: string;
  productName: string;
  brand?: string | null;
  unit?: string | null;
};

type PendingResponse = {
  items: PendingItem[];
  pendingTotal: number;
  successTotal: number;
  failedTotal: number;
};

type OrganizeResponse = {
  tempProductId: string;
  success: boolean;
  organizedProductId?: string | null;
  organizedProductName?: string | null;
  mode?: string | null;
  addedProperties?: number;
  addedValues?: number;
  addedAccessories?: number;
  error?: string | null;
};

type RowStatus = "pending" | "running" | "success" | "failed";

type Row = PendingItem & {
  status: RowStatus;
  result?: OrganizeResponse;
};

const API = "/backend/v1/temp-product-transfer";

export function TransferPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [successTotal, setSuccessTotal] = useState(0);
  const [failedTotal, setFailedTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const stopRef = useRef(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const response = await fetch(`${API}/pending?limit=1000`, {
      credentials: "same-origin",
    });
    if (!response.ok) {
      setLoadError(`Liste alınamadı (${response.status})`);
      return;
    }
    const data = (await response.json()) as PendingResponse;
    setRows(
      (data.items ?? []).map((item) => ({
        ...item,
        status: "pending",
      })),
    );
    setPendingTotal(data.pendingTotal ?? 0);
    setSuccessTotal(data.successTotal ?? 0);
    setFailedTotal(data.failedTotal ?? 0);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    if (running) return;
    stopRef.current = false;
    setRunning(true);
    const queue = rows.filter((row) => row.status === "pending");
    for (const row of queue) {
      if (stopRef.current) break;
      setRows((current) =>
        current.map((item) =>
          item.id === row.id ? { ...item, status: "running" } : item,
        ),
      );
      try {
        const response = await fetch(`${API}/organize/${row.id}`, {
          method: "POST",
          credentials: "same-origin",
        });
        const data = (await response.json()) as OrganizeResponse;
        const ok = response.ok && data.success;
        setRows((current) =>
          current.map((item) =>
            item.id === row.id
              ? { ...item, status: ok ? "success" : "failed", result: data }
              : item,
          ),
        );
        if (ok) {
          setSuccessTotal((value) => value + 1);
          setPendingTotal((value) => Math.max(0, value - 1));
        } else if (response.ok) {
          setFailedTotal((value) => value + 1);
          setPendingTotal((value) => Math.max(0, value - 1));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "İstek başarısız";
        setRows((current) =>
          current.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  status: "failed",
                  result: {
                    tempProductId: row.id,
                    success: false,
                    error: message,
                  },
                }
              : item,
          ),
        );
      }
    }
    setRunning(false);
  };

  const stop = () => {
    stopRef.current = true;
  };

  const processed = rows.filter(
    (row) => row.status === "success" || row.status === "failed",
  ).length;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader section="Geçici" title="Temp Product Transfer" />

      <section className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
        <div className="mx-auto grid max-w-6xl gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 font-mono text-sm text-[var(--steel)]">
              <span>
                Bekleyen <strong className="text-[var(--charcoal)]">{pendingTotal}</strong>
              </span>
              <span>
                Başarılı <strong className="text-[var(--charcoal)]">{successTotal}</strong>
              </span>
              <span>
                Başarısız <strong className="text-[var(--charcoal)]">{failedTotal}</strong>
              </span>
              <span>
                Bu sayfa {processed}/{rows.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={running || rows.length === 0}
                onClick={() => void start()}
                className="inline-flex h-9 items-center border border-[var(--heat)] bg-[var(--heat)] px-4 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--paper)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Başlat
              </button>
              <button
                type="button"
                disabled={!running}
                onClick={stop}
                className="inline-flex h-9 items-center border border-[#8f2d1f] px-4 font-display text-[13px] uppercase tracking-[0.12em] text-[#8f2d1f] hover:bg-[#8f2d1f] hover:text-[var(--paper)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Durdur
              </button>
              <button
                type="button"
                disabled={running}
                onClick={() => void load()}
                className="inline-flex h-9 items-center border border-[var(--rule)] bg-[var(--paper)] px-4 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--charcoal)] hover:border-[var(--charcoal)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Yenile
              </button>
            </div>
          </div>

          {loadError ? (
            <p className="text-sm text-[#8f2d1f]">{loadError}</p>
          ) : null}

          <div className="overflow-x-auto border border-[var(--rule)] bg-[var(--paper)]">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-[var(--rule)] font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Kod</th>
                  <th className="px-3 py-2 font-medium">Ürün adı</th>
                  <th className="px-3 py-2 font-medium">Durum</th>
                  <th className="px-3 py-2 font-medium">Sonuç</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-[var(--steel)]" colSpan={5}>
                      organizedSuccess = null kayıt yok.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={row.id} className="border-t border-[var(--rule)] align-top">
                      <td className="px-3 py-2 font-mono text-xs text-[var(--steel)]">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
                      <td className="px-3 py-2">{row.productName}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-3 py-2 text-[var(--steel)]">
                        <ResultCell row={row} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: RowStatus }) {
  const labels: Record<RowStatus, string> = {
    pending: "bekliyor",
    running: "işleniyor...",
    success: "başarılı",
    failed: "başarısız",
  };
  const tones: Record<RowStatus, string> = {
    pending: "text-[var(--steel)]",
    running: "text-[var(--heat)]",
    success: "text-[#2f6b3a]",
    failed: "text-[#8f2d1f]",
  };
  return <span className={`font-display text-[12px] uppercase tracking-[0.12em] ${tones[status]}`}>{labels[status]}</span>;
}

function ResultCell({ row }: { row: Row }) {
  if (row.status === "failed") {
    return <span>{row.result?.error || "Ayrıştırma başarısız"}</span>;
  }
  if (row.status !== "success" || !row.result) {
    return null;
  }
  const modeLabel =
    row.result.mode === "CREATED"
      ? "yeni"
      : row.result.mode === "MERGED"
        ? "birleşti"
        : row.result.mode ?? "";
  const bits = [
    row.result.organizedProductName,
    modeLabel,
    row.result.addedProperties ? `+${row.result.addedProperties} özellik` : null,
    row.result.addedValues ? `+${row.result.addedValues} değer` : null,
    row.result.addedAccessories ? `+${row.result.addedAccessories} aksesuar` : null,
  ].filter(Boolean);
  return <span>{bits.join(" · ")}</span>;
}
