"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/catalog/fields";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  deleteReminder,
  listDueReminders,
} from "@/lib/api/generated/endpoints/reminders/reminders";
import type { ReminderResponse } from "@/lib/api/generated/model";

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR");
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ReminderResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await listDueReminders();
      if (response.status !== 200) {
        setError(apiErrorMessage(response.data, "Bildirimler yüklenemedi."));
        return;
      }
      setError(null);
      setItems(response.data.content ?? []);
    } catch {
      setError("Bildirimler yüklenemedi.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    void load();
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open, load]);

  const closeItem = async (id: string) => {
    setClosingId(id);
    try {
      const response = await deleteReminder(id);
      if (response.status !== 200) {
        setError(apiErrorMessage(response.data, "Bildirim kapatılamadı."));
        return;
      }
      setItems((current) => current.filter((item) => item.id !== id));
    } catch {
      setError("Bildirim kapatılamadı.");
    } finally {
      setClosingId(null);
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label="Bildirimler"
        onClick={() => setOpen((current) => !current)}
        className="relative inline-flex h-9 w-9 items-center justify-center text-[var(--steel)] hover:text-[var(--charcoal)]"
      >
        <BellIcon />
        {items.length > 0 ? (
          <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center bg-[var(--heat)] px-1 font-mono text-[10px] text-[var(--paper)]">
            {items.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-[min(22rem,calc(100vw-2rem))] border border-[var(--rule)] bg-[var(--paper)] shadow-sm">
          <div className="border-b border-[var(--rule)] px-3 py-2">
            <p className="font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
              Hatırlatmalar
            </p>
          </div>
          {error ? (
            <p className="px-3 py-2 text-xs text-[#8f2d1f]">{error}</p>
          ) : null}
          {items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-[var(--steel)]">
              Vadesi gelen hatırlatma yok.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="grid gap-2 border-t border-[var(--rule)] px-3 py-3"
                >
                  <div className="grid gap-0.5">
                    <p className="font-mono text-xs">
                      {item.quoteNumber || "—"} · {formatDate(item.remindOn)}
                    </p>
                    <p className="text-sm">
                      {item.institution || "Müşteri yok"}
                    </p>
                    {item.note ? (
                      <p className="text-sm text-[var(--steel)]">{item.note}</p>
                    ) : null}
                  </div>
                  {item.id ? (
                    <ActionButton
                      tone="danger"
                      disabled={closingId === item.id}
                      onClick={() => void closeItem(item.id!)}
                    >
                      Kapat
                    </ActionButton>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      <path
        fill="currentColor"
        d="M10 2.2a4.3 4.3 0 0 0-4.3 4.3v1.7c0 .7-.2 1.3-.6 1.9L4 12.2h12l-1.1-2.1c-.4-.6-.6-1.2-.6-1.9V6.5A4.3 4.3 0 0 0 10 2.2Zm0 15.1a2.1 2.1 0 0 0 2.1-2H7.9a2.1 2.1 0 0 0 2.1 2Z"
      />
    </svg>
  );
}
