"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { useBrand } from "@/components/brand/brand-provider";
import { BRANDS, brandOf } from "@/lib/brand/brands";

export function BrandSwitcher() {
  const { brand, setBrand } = useBrand();
  const active = brandOf(brand);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Aktif marka: ${active.displayName}. Değiştirmek için tıklayın.`}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 items-center rounded border border-transparent px-1.5 hover:border-[var(--rule)] focus:border-[var(--heat)] focus:outline-none"
      >
        <Image
          src={active.logo}
          alt={active.displayName}
          width={160}
          height={40}
          className="h-8 w-auto max-w-[9.5rem] object-contain object-left"
          priority
        />
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Marka seç"
          className="absolute left-0 top-[calc(100%+0.35rem)] z-40 min-w-[12rem] border border-[var(--rule)] bg-[var(--paper)] py-1 shadow-sm"
        >
          {BRANDS.map((item) => {
            const selected = item.id === brand;
            return (
              <li key={item.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={[
                    "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[var(--mist)]",
                    selected ? "bg-[var(--mist)]" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => {
                    setBrand(item.id);
                    setOpen(false);
                  }}
                >
                  <Image
                    src={item.logo}
                    alt=""
                    width={120}
                    height={28}
                    className="h-6 w-auto max-w-[7rem] object-contain object-left"
                  />
                  <span className="font-display text-[12px] uppercase tracking-[0.12em] text-[var(--charcoal)]">
                    {item.displayName}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
