"use client";

import { useState } from "react";
import { ActionButton, Field, NumberInput, TextInput } from "@/components/catalog/fields";
import { apiErrorMessage, apiFieldErrorMap, fieldError, isSuccessStatus } from "@/lib/api/errors";
import {
  activateOllamaSettings,
  activateSttSettings,
  activeOf,
  createOllamaSettings,
  createSttSettings,
  deleteOllamaSettings,
  deleteSttSettings,
  isAiSettings,
  updateOllamaSettings,
  updateSttSettings,
  type AiSettings,
  type OllamaSettings,
  type OllamaSettingsInput,
  type SttSettings,
  type SttSettingsInput,
} from "@/lib/api/settings";

type Selection = string | "new";

function blankStt(from?: SttSettings): SttSettingsInput {
  return {
    baseUrl: "",
    language: from?.language ?? "tr",
    timeoutMs: from?.timeoutMs ?? 25000,
  };
}

function toSttInput(item: SttSettings): SttSettingsInput {
  return {
    baseUrl: item.baseUrl,
    language: item.language,
    timeoutMs: item.timeoutMs,
  };
}

function blankOllama(from?: OllamaSettings): OllamaSettingsInput {
  return {
    baseUrl: "",
    model: from?.model ?? "qwen2.5:14b",
    timeoutMs: from?.timeoutMs ?? 30000,
    numCtx: from?.numCtx ?? 8192,
    numPredict: from?.numPredict ?? 400,
    keepAlive: from?.keepAlive ?? "30m",
    basicUser: from?.basicUser ?? "",
    basicPass: from?.basicPass ?? "",
    organizeTimeoutMs: from?.organizeTimeoutMs ?? 180000,
  };
}

function toOllamaInput(item: OllamaSettings): OllamaSettingsInput {
  return {
    baseUrl: item.baseUrl,
    model: item.model,
    timeoutMs: item.timeoutMs,
    numCtx: item.numCtx,
    numPredict: item.numPredict,
    keepAlive: item.keepAlive,
    basicUser: item.basicUser,
    basicPass: item.basicPass,
    organizeTimeoutMs: item.organizeTimeoutMs,
  };
}

function AddressList({
  items,
  selectedId,
  onSelect,
}: {
  items: { id: string; baseUrl: string; active: boolean; detail?: string }[];
  selectedId: Selection;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="grid gap-1">
      {items.map((item) => {
        const selected = selectedId === item.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              className={`flex w-full items-center justify-between gap-3 border px-3 py-2 text-left text-sm ${
                selected
                  ? "border-[var(--charcoal)] bg-[var(--mist)] text-[var(--charcoal)]"
                  : "border-[var(--rule)] text-[var(--steel)] hover:text-[var(--charcoal)]"
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate">{item.baseUrl}</span>
                {item.detail ? (
                  <span className="block truncate text-xs">{item.detail}</span>
                ) : null}
              </span>
              {item.active ? (
                <span className="shrink-0 font-display text-[11px] uppercase tracking-[0.14em] text-[var(--heat)]">
                  Aktif
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function AiSettingsForm({ initial }: { initial: AiSettings }) {
  const [settings, setSettings] = useState(initial);
  const [sttSelection, setSttSelection] = useState<Selection>(
    () => activeOf(initial.stt)?.id ?? initial.stt[0]?.id ?? "new",
  );
  const [ollamaSelection, setOllamaSelection] = useState<Selection>(
    () => activeOf(initial.llm.ollama)?.id ?? initial.llm.ollama[0]?.id ?? "new",
  );
  const [sttDraft, setSttDraft] = useState<SttSettingsInput>(() => {
    const current = activeOf(initial.stt) ?? initial.stt[0];
    return current ? toSttInput(current) : blankStt();
  });
  const [ollamaDraft, setOllamaDraft] = useState<OllamaSettingsInput>(() => {
    const current = activeOf(initial.llm.ollama) ?? initial.llm.ollama[0];
    return current ? toOllamaInput(current) : blankOllama();
  });
  const [sttStatus, setSttStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [ollamaStatus, setOllamaStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sttError, setSttError] = useState<string | null>(null);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [sttFieldErrors, setSttFieldErrors] = useState<Record<string, string>>({});
  const [ollamaFieldErrors, setOllamaFieldErrors] = useState<Record<string, string>>({});

  const selectedStt = settings.stt.find((item) => item.id === sttSelection);
  const selectedOllama = settings.llm.ollama.find((item) => item.id === ollamaSelection);

  const selectStt = (id: string) => {
    const item = settings.stt.find((entry) => entry.id === id);
    if (!item) return;
    setSttSelection(id);
    setSttDraft(toSttInput(item));
    setSttStatus("idle");
    setSttError(null);
    setSttFieldErrors({});
  };

  const startNewStt = () => {
    setSttSelection("new");
    setSttDraft(blankStt(activeOf(settings.stt)));
    setSttStatus("idle");
    setSttError(null);
    setSttFieldErrors({});
  };

  const selectOllama = (id: string) => {
    const item = settings.llm.ollama.find((entry) => entry.id === id);
    if (!item) return;
    setOllamaSelection(id);
    setOllamaDraft(toOllamaInput(item));
    setOllamaStatus("idle");
    setOllamaError(null);
    setOllamaFieldErrors({});
  };

  const startNewOllama = () => {
    setOllamaSelection("new");
    setOllamaDraft(blankOllama(activeOf(settings.llm.ollama)));
    setOllamaStatus("idle");
    setOllamaError(null);
    setOllamaFieldErrors({});
  };

  const applySettings = (next: AiSettings, focus: "stt" | "ollama", createdFromNew: boolean) => {
    setSettings(next);
    if (focus === "stt") {
      const created = createdFromNew
        ? next.stt.find((item) => !settings.stt.some((previous) => previous.id === item.id))
        : undefined;
      const selected = created ?? next.stt.find((item) => item.id === sttSelection) ?? activeOf(next.stt);
      if (selected) {
        setSttSelection(selected.id);
        setSttDraft(toSttInput(selected));
      }
      return;
    }
    const created = createdFromNew
      ? next.llm.ollama.find((item) => !settings.llm.ollama.some((previous) => previous.id === item.id))
      : undefined;
    const selected =
      created ?? next.llm.ollama.find((item) => item.id === ollamaSelection) ?? activeOf(next.llm.ollama);
    if (selected) {
      setOllamaSelection(selected.id);
      setOllamaDraft(toOllamaInput(selected));
    }
  };

  const readSettings = (data: unknown): AiSettings | null => (isAiSettings(data) ? data : null);

  const saveStt = async () => {
    setSttStatus("saving");
    setSttError(null);
    setSttFieldErrors({});
    const body: SttSettingsInput = {
      baseUrl: sttDraft.baseUrl.trim(),
      language: sttDraft.language.trim(),
      timeoutMs: sttDraft.timeoutMs,
    };
    const creating = sttSelection === "new";
    const response = creating
      ? await createSttSettings(body)
      : await updateSttSettings(sttSelection, body);
    const next = readSettings(response.data);
    if (!isSuccessStatus(response.status) || !next) {
      setSttFieldErrors(apiFieldErrorMap(response.data));
      setSttError(apiErrorMessage(response.data));
      setSttStatus("error");
      return;
    }
    applySettings(next, "stt", creating);
    setSttStatus("saved");
  };

  const removeStt = async () => {
    if (sttSelection === "new" || settings.stt.length < 2) return;
    if (!window.confirm("Bu STT adresini silmek istiyor musunuz?")) return;
    const response = await deleteSttSettings(sttSelection);
    const next = readSettings(response.data);
    if (!isSuccessStatus(response.status) || !next) {
      setSttError(apiErrorMessage(response.data));
      setSttStatus("error");
      return;
    }
    const selected = activeOf(next.stt) ?? next.stt[0];
    setSettings(next);
    if (selected) {
      setSttSelection(selected.id);
      setSttDraft(toSttInput(selected));
    }
    setSttStatus("saved");
    setSttError(null);
  };

  const makeSttActive = async () => {
    if (sttSelection === "new" || selectedStt?.active) return;
    const response = await activateSttSettings(sttSelection);
    const next = readSettings(response.data);
    if (!isSuccessStatus(response.status) || !next) {
      setSttError(apiErrorMessage(response.data));
      setSttStatus("error");
      return;
    }
    applySettings(next, "stt", false);
    setSttStatus("saved");
  };

  const saveOllama = async () => {
    setOllamaStatus("saving");
    setOllamaError(null);
    setOllamaFieldErrors({});
    const body: OllamaSettingsInput = {
      ...ollamaDraft,
      baseUrl: ollamaDraft.baseUrl.trim(),
      model: ollamaDraft.model.trim(),
      keepAlive: ollamaDraft.keepAlive.trim(),
      basicUser: ollamaDraft.basicUser.trim(),
    };
    const creating = ollamaSelection === "new";
    const response = creating
      ? await createOllamaSettings(body)
      : await updateOllamaSettings(ollamaSelection, body);
    const next = readSettings(response.data);
    if (!isSuccessStatus(response.status) || !next) {
      setOllamaFieldErrors(apiFieldErrorMap(response.data));
      setOllamaError(apiErrorMessage(response.data));
      setOllamaStatus("error");
      return;
    }
    applySettings(next, "ollama", creating);
    setOllamaStatus("saved");
  };

  const removeOllama = async () => {
    if (ollamaSelection === "new" || settings.llm.ollama.length < 2) return;
    if (!window.confirm("Bu Ollama adresini silmek istiyor musunuz?")) return;
    const response = await deleteOllamaSettings(ollamaSelection);
    const next = readSettings(response.data);
    if (!isSuccessStatus(response.status) || !next) {
      setOllamaError(apiErrorMessage(response.data));
      setOllamaStatus("error");
      return;
    }
    const selected = activeOf(next.llm.ollama) ?? next.llm.ollama[0];
    setSettings(next);
    if (selected) {
      setOllamaSelection(selected.id);
      setOllamaDraft(toOllamaInput(selected));
    }
    setOllamaStatus("saved");
    setOllamaError(null);
  };

  const makeOllamaActive = async () => {
    if (ollamaSelection === "new" || selectedOllama?.active) return;
    const response = await activateOllamaSettings(ollamaSelection);
    const next = readSettings(response.data);
    if (!isSuccessStatus(response.status) || !next) {
      setOllamaError(apiErrorMessage(response.data));
      setOllamaStatus("error");
      return;
    }
    applySettings(next, "ollama", false);
    setOllamaStatus("saved");
  };

  return (
    <div className="mx-auto grid max-w-3xl gap-12">
      <section className="grid gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl tracking-wide">STT</h2>
            <p className="text-sm text-[var(--steel)]">
              Ses kaydı yalnızca aktif adrese gider.
            </p>
          </div>
          <ActionButton tone="heat" onClick={startNewStt}>
            Yeni
          </ActionButton>
        </div>
        <AddressList
          items={settings.stt}
          selectedId={sttSelection}
          onSelect={selectStt}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Adres" error={fieldError(sttFieldErrors, "baseUrl")}>
            <TextInput
              value={sttDraft.baseUrl}
              onChange={(event) => {
                setSttDraft((current) => ({ ...current, baseUrl: event.target.value }));
                setSttStatus("idle");
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Dil" error={fieldError(sttFieldErrors, "language")}>
            <TextInput
              value={sttDraft.language}
              onChange={(event) => {
                setSttDraft((current) => ({ ...current, language: event.target.value }));
                setSttStatus("idle");
              }}
              autoComplete="off"
              placeholder="tr"
            />
          </Field>
          <Field label="Zaman aşımı (ms)" error={fieldError(sttFieldErrors, "timeoutMs")}>
            <NumberInput
              min={1000}
              value={sttDraft.timeoutMs}
              onChange={(event) => {
                setSttDraft((current) => ({ ...current, timeoutMs: Number(event.target.value) }));
                setSttStatus("idle");
              }}
            />
          </Field>
        </div>
        {sttError ? <p className="text-sm text-[#8f2d1f]">{sttError}</p> : null}
        {sttStatus === "saved" ? (
          <p className="text-sm text-[var(--steel)]">Kaydedildi.</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <ActionButton tone="heat" disabled={sttStatus === "saving"} onClick={() => void saveStt()}>
            Kaydet
          </ActionButton>
          {sttSelection !== "new" && !selectedStt?.active ? (
            <ActionButton onClick={() => void makeSttActive()}>Aktif yap</ActionButton>
          ) : null}
          {sttSelection !== "new" ? (
            <ActionButton
              tone="danger"
              disabled={settings.stt.length < 2}
              onClick={() => void removeStt()}
            >
              Sil
            </ActionButton>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl tracking-wide">LLM</h2>
            <h3 className="mt-3 font-display text-xl tracking-wide">Ollama</h3>
            <p className="text-sm text-[var(--steel)]">
              Teklif sohbeti ve ürün düzenleme yalnızca aktif adresi kullanır.
            </p>
          </div>
          <ActionButton tone="heat" onClick={startNewOllama}>
            Yeni
          </ActionButton>
        </div>
        <AddressList
          items={settings.llm.ollama.map((item) => ({
            id: item.id,
            baseUrl: item.baseUrl,
            active: item.active,
            detail: item.model,
          }))}
          selectedId={ollamaSelection}
          onSelect={selectOllama}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Adres" error={fieldError(ollamaFieldErrors, "baseUrl")}>
            <TextInput
              value={ollamaDraft.baseUrl}
              onChange={(event) => {
                setOllamaDraft((current) => ({ ...current, baseUrl: event.target.value }));
                setOllamaStatus("idle");
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Model" error={fieldError(ollamaFieldErrors, "model")}>
            <TextInput
              value={ollamaDraft.model}
              onChange={(event) => {
                setOllamaDraft((current) => ({ ...current, model: event.target.value }));
                setOllamaStatus("idle");
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Kullanıcı adı" error={fieldError(ollamaFieldErrors, "basicUser")}>
            <TextInput
              value={ollamaDraft.basicUser}
              onChange={(event) => {
                setOllamaDraft((current) => ({ ...current, basicUser: event.target.value }));
                setOllamaStatus("idle");
              }}
              autoComplete="off"
            />
          </Field>
          <Field label="Şifre" error={fieldError(ollamaFieldErrors, "basicPass")}>
            <TextInput
              value={ollamaDraft.basicPass}
              onChange={(event) => {
                setOllamaDraft((current) => ({ ...current, basicPass: event.target.value }));
                setOllamaStatus("idle");
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <Field label="Sohbet zaman aşımı (ms)" error={fieldError(ollamaFieldErrors, "timeoutMs")}>
            <NumberInput
              min={1000}
              value={ollamaDraft.timeoutMs}
              onChange={(event) => {
                setOllamaDraft((current) => ({ ...current, timeoutMs: Number(event.target.value) }));
                setOllamaStatus("idle");
              }}
            />
          </Field>
          <Field
            label="Düzenleme zaman aşımı (ms)"
            error={fieldError(ollamaFieldErrors, "organizeTimeoutMs")}
          >
            <NumberInput
              min={1000}
              value={ollamaDraft.organizeTimeoutMs}
              onChange={(event) => {
                setOllamaDraft((current) => ({
                  ...current,
                  organizeTimeoutMs: Number(event.target.value),
                }));
                setOllamaStatus("idle");
              }}
            />
          </Field>
          <Field label="Bağlam (num_ctx)" error={fieldError(ollamaFieldErrors, "numCtx")}>
            <NumberInput
              min={1}
              value={ollamaDraft.numCtx}
              onChange={(event) => {
                setOllamaDraft((current) => ({ ...current, numCtx: Number(event.target.value) }));
                setOllamaStatus("idle");
              }}
            />
          </Field>
          <Field label="Üretim limiti" error={fieldError(ollamaFieldErrors, "numPredict")}>
            <NumberInput
              min={1}
              value={ollamaDraft.numPredict}
              onChange={(event) => {
                setOllamaDraft((current) => ({ ...current, numPredict: Number(event.target.value) }));
                setOllamaStatus("idle");
              }}
            />
          </Field>
          <Field label="Keep alive" error={fieldError(ollamaFieldErrors, "keepAlive")}>
            <TextInput
              value={ollamaDraft.keepAlive}
              onChange={(event) => {
                setOllamaDraft((current) => ({ ...current, keepAlive: event.target.value }));
                setOllamaStatus("idle");
              }}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>
        {ollamaError ? <p className="text-sm text-[#8f2d1f]">{ollamaError}</p> : null}
        {ollamaStatus === "saved" ? (
          <p className="text-sm text-[var(--steel)]">Kaydedildi.</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <ActionButton
            tone="heat"
            disabled={ollamaStatus === "saving"}
            onClick={() => void saveOllama()}
          >
            Kaydet
          </ActionButton>
          {ollamaSelection !== "new" && !selectedOllama?.active ? (
            <ActionButton onClick={() => void makeOllamaActive()}>Aktif yap</ActionButton>
          ) : null}
          {ollamaSelection !== "new" ? (
            <ActionButton
              tone="danger"
              disabled={settings.llm.ollama.length < 2}
              onClick={() => void removeOllama()}
            >
              Sil
            </ActionButton>
          ) : null}
        </div>
      </section>
    </div>
  );
}
