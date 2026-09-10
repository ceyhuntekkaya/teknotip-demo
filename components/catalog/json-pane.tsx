"use client";

import { ActionButton } from "./fields";

type JsonPaneProps = {
  value: string;
  error: string | null;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onCopy: () => void;
  onFormat: () => void;
};

export function JsonPane({
  value,
  error,
  onChange,
  onFocus,
  onBlur,
  onCopy,
  onFormat,
}: JsonPaneProps) {
  return (
    <section className="flex min-h-0 flex-col border border-[var(--rule)] bg-[var(--paper)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div>
            <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
              Kaynak
            </p>
            <h2 className="font-display text-xl leading-none tracking-wide">JSON</h2>
          </div>
          <span
            className={`px-2 py-0.5 font-display text-[11px] uppercase tracking-[0.14em] ${
              error
                ? "bg-[#8f2d1f]/15 text-[#8f2d1f]"
                : "bg-[var(--vacuum-soft)] text-[var(--vacuum)]"
            }`}
          >
            {error ? "Geçersiz" : "Geçerli"}
          </span>
          {error ? <p className="text-xs text-[#8f2d1f]">{error}</p> : null}
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={onCopy}>Kopyala</ActionButton>
          <ActionButton onClick={onFormat}>Biçimlendir</ActionButton>
        </div>
      </header>
      <textarea
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        className="h-72 w-full resize-y bg-[var(--soot)] px-4 py-3 font-mono text-[12px] leading-relaxed text-[var(--heat-soft)] outline-none"
      />
    </section>
  );
}
