"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BrandSwitcher } from "@/components/brand/brand-switcher";
import { AppNav } from "@/components/layout/app-nav";
import { useBrand } from "@/components/brand/brand-provider";
import { brandLabel } from "@/lib/brand/brands";

type AppHeaderProps = {
  /** Section label after brand name, e.g. "Teklif" → "TeknoTıp · Teklif" */
  section?: string;
  title?: string;
  actions?: ReactNode;
  compact?: boolean;
};

export function AppHeader({
  section,
  title,
  actions,
  compact = false,
}: AppHeaderProps) {
  const { brand } = useBrand();
  const eyebrow = section
    ? `${brandLabel(brand)} · ${section}`
    : brandLabel(brand);

  return (
    <header
      className={`app-header flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] ${
        compact ? "px-4 py-3" : "px-5 py-3"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/teklif"
          className={`shrink-0 font-display uppercase leading-none tracking-wide text-[var(--charcoal)] hover:text-[var(--heat)] focus:outline-none focus-visible:text-[var(--heat)] ${
            compact ? "text-3xl" : "text-2xl"
          }`}
          aria-label="Teklif ana sayfa"
        >
          TEKLİF
        </Link>
        <BrandSwitcher />
        {title ? (
          <div className="min-w-0">
            <p className="font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
              {eyebrow}
            </p>
            <h1
              className={`font-display leading-none tracking-wide ${
                compact ? "text-3xl" : "text-2xl"
              }`}
            >
              {title}
            </h1>
          </div>
        ) : (
          <p className="min-w-0 font-display text-[11px] uppercase tracking-[0.22em] text-[var(--steel)]">
            {eyebrow}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <AppNav />
      </div>
    </header>
  );
}
