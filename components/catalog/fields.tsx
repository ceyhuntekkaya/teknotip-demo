import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  const invalid = Boolean(error?.trim());
  return (
    <label
      className={`grid gap-1.5 ${
        invalid ? "rounded-sm bg-[#fdf2f0] p-2 ring-1 ring-[#8f2d1f]/55" : ""
      }`}
    >
      <span
        className={`font-display text-[11px] uppercase tracking-[0.18em] ${
          invalid ? "text-[#8f2d1f]" : "text-[var(--steel)]"
        }`}
      >
        {label}
      </span>
      <div
        className={
          invalid
            ? "[&_input]:border-[#8f2d1f] [&_input]:focus:border-[#8f2d1f] [&_select]:border-[#8f2d1f] [&_select]:focus:border-[#8f2d1f] [&_textarea]:border-[#8f2d1f] [&_textarea]:focus:border-[#8f2d1f]"
            : ""
        }
      >
        {children}
      </div>
      {invalid ? (
        <span className="text-xs leading-snug text-[#8f2d1f]">{error}</span>
      ) : null}
    </label>
  );
}

const controlClass =
  "h-10 w-full border border-[var(--rule)] bg-[var(--paper)] px-3 text-sm text-[var(--charcoal)] outline-none transition-[border-color] placeholder:text-[var(--steel)] focus:border-[var(--heat)]";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${controlClass} ${props.className ?? ""}`} />;
}

export function NumberInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="number"
      className={`${controlClass} font-mono ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-24 w-full border border-[var(--rule)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-[var(--heat)] ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${controlClass} ${props.className ?? ""}`} />
  );
}

export function OptionalPriceInput({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <NumberInput
      min={0}
      value={value ?? ""}
      placeholder="Ek fiyat yok"
      onChange={(event) => {
        const next = event.target.value;
        onChange(next === "" ? undefined : Number(next));
      }}
    />
  );
}

export function ActionButton({
  children,
  onClick,
  tone = "default",
  disabled,
  type = "button",
  className = "",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: "default" | "heat" | "danger" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
}) {
  const tones = {
    default:
      "border-[var(--rule)] bg-[var(--paper)] text-[var(--charcoal)] hover:border-[var(--charcoal)]",
    heat: "border-[var(--heat)] bg-[var(--heat)] text-[var(--paper)] hover:brightness-110",
    danger:
      "border-[#8f2d1f] bg-transparent text-[#8f2d1f] hover:bg-[#8f2d1f] hover:text-[var(--paper)]",
    ghost:
      "border-transparent bg-transparent text-[var(--steel)] hover:text-[var(--charcoal)]",
  };

  return (
    <button
      type={type}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-1.5 border px-3 font-display text-[13px] uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}
