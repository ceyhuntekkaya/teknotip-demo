"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader } from "@/components/layout/app-header";

const TABS = [
  { href: "/settings/users", label: "Kullanıcılar" },
  { href: "/settings/ai", label: "AI" },
  { href: "/settings/terms", label: "Koşullar" },
  { href: "/settings/organized-products", label: "Geçici Ürünler" },
] as const;

export function SettingsFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const activeTab = TABS.find(
    (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`),
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader section="Ayarlar" title={activeTab?.label ?? "Kullanıcılar"} />
      <nav className="flex shrink-0 gap-1 border-b border-[var(--rule)] px-5">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-10 items-center border-b-2 px-3 font-display text-[13px] uppercase tracking-[0.12em] ${
                active
                  ? "border-[var(--heat)] text-[var(--charcoal)]"
                  : "border-transparent text-[var(--steel)] hover:text-[var(--charcoal)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
