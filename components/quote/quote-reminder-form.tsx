"use client";

import { useCallback, useEffect, useState } from "react";
import { ActionButton, Field, TextArea, TextInput } from "@/components/catalog/fields";
import { apiErrorMessage } from "@/lib/api/errors";
import {
  createReminder,
  listReminders,
} from "@/lib/api/generated/endpoints/reminders/reminders";
import type { ReminderResponse } from "@/lib/api/generated/model";

function todayIso() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR");
}

export function QuoteReminderForm({ quoteId }: { quoteId: string }) {
  const [remindOn, setRemindOn] = useState(todayIso);
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ReminderResponse[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await listReminders({ quoteId });
      if (response.status !== 200) {
        setError(apiErrorMessage(response.data, "Hatırlatmalar yüklenemedi."));
        return;
      }
      setItems(response.data.content ?? []);
    } catch {
      setError("Hatırlatmalar yüklenemedi.");
    }
  }, [quoteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!remindOn) {
      setError("Tarih zorunludur.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await createReminder({
        quoteId,
        remindOn,
        note: note.trim() || undefined,
      });
      if (response.status !== 201) {
        setError(apiErrorMessage(response.data, "Hatırlatma kaydedilemedi."));
        return;
      }
      setNote("");
      setRemindOn(todayIso());
      await load();
    } catch {
      setError("Hatırlatma kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-3 border-b border-[var(--rule)] px-4 py-3">
      <p className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
        Hatırlat
      </p>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto]">
        <Field label="Tarih">
          <TextInput
            type="date"
            value={remindOn}
            onChange={(event) => setRemindOn(event.target.value)}
          />
        </Field>
        <Field label="Not">
          <TextArea
            rows={2}
            className="min-h-10"
            placeholder="Bu teklifi bana hatırlat"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        <div className="self-end">
          <ActionButton tone="heat" disabled={saving} onClick={() => void submit()}>
            Kaydet
          </ActionButton>
        </div>
      </div>
      {error ? <p className="text-xs text-[#8f2d1f]">{error}</p> : null}
      {items.length === 0 ? (
        <p className="text-xs text-[var(--steel)]">Bu teklif için açık hatırlatma yok.</p>
      ) : (
        <ul className="grid gap-1">
          {items.map((item) => (
            <li key={item.id} className="text-sm text-[var(--charcoal)]">
              <span className="font-mono text-xs">{formatDate(item.remindOn)}</span>
              {item.note ? ` · ${item.note}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
