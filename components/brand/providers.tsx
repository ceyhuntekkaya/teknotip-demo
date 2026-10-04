"use client";

import type { ReactNode } from "react";
import { BrandProvider } from "@/components/brand/brand-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return <BrandProvider>{children}</BrandProvider>;
}
