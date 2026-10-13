"use client";

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
};

function ToolbarButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPress}
      className="inline-flex h-7 min-w-7 items-center justify-center border border-[var(--rule)] px-2 font-display text-[12px] text-[var(--charcoal)] hover:border-[var(--charcoal)]"
    >
      {label}
    </button>
  );
}

export function HtmlEditor({ value, onChange }: Props) {
  const field = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = field.current;
    if (!node || node.innerHTML === value) return;
    if (document.activeElement === node) return;
    node.innerHTML = value;
  }, [value]);

  const publish = () => {
    onChange(field.current?.innerHTML ?? "");
  };

  const exec = (command: string) => {
    field.current?.focus();
    document.execCommand(command);
    publish();
  };

  return (
    <div className="border border-[var(--rule)] bg-[var(--paper)]">
      <div className="flex gap-1 border-b border-[var(--rule)] px-2 py-1">
        <ToolbarButton label="B" onPress={() => exec("bold")} />
        <ToolbarButton label="I" onPress={() => exec("italic")} />
        <ToolbarButton label="•" onPress={() => exec("insertUnorderedList")} />
        <ToolbarButton label="1." onPress={() => exec("insertOrderedList")} />
      </div>
      <div
        ref={field}
        contentEditable
        suppressContentEditableWarning
        onInput={publish}
        className="min-h-40 px-3 py-2 text-sm leading-relaxed outline-none [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
      />
    </div>
  );
}
