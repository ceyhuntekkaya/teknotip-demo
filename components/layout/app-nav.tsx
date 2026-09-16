"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { NotificationBell } from "@/components/layout/notification-bell";

const LINKS = [
  { href: "/products", label: "Katalog" },
  { href: "/customers", label: "Müşteriler" },
  { href: "/quotes", label: "Teklifler" },
  { href: "/teklif", label: "Teklif" },
  { href: "/reports", label: "Raporlar" },
  { href: "/organized-products", label: "Geçici Ürünler" },
  { href: "/temp-product-transfer", label: "Eski Ürün" },
] as const;

const linkClass =
  "inline-flex h-9 items-center px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--steel)] hover:text-[var(--charcoal)]";

const activeClass =
  "inline-flex h-9 items-center px-3 font-display text-[13px] uppercase tracking-[0.12em] text-[var(--charcoal)]";

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
            className={active ? activeClass : linkClass}
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
