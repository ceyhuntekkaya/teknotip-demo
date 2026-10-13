"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { NotificationBell } from "@/components/layout/notification-bell";

const LINKS = [
  { href: "/teklif", label: "Teklif", emphasis: true },
  { href: "/products", label: "Ürünler" },
  { href: "/customers", label: "Müşteriler" },
  { href: "/quotes", label: "Önceki Teklifler" },
  { href: "/reports", label: "Raporlar" },
  { href: "/settings", label: "Ayarlar" },
] as const;

const linkClass =
  "inline-flex h-9 items-center px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--steel)] hover:text-[var(--charcoal)]";

const activeClass =
  "inline-flex h-9 items-center px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--charcoal)]";

const emphasisClass = "font-bold text-[var(--charcoal)]";

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={[
              active ? activeClass : linkClass,
              "emphasis" in link && link.emphasis ? emphasisClass : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
      <NotificationBell />
      <LogoutButton />
    </nav>
  );
}
