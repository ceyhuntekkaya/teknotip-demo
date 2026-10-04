"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BRAND_STORAGE_KEY,
  DEFAULT_BRAND,
  isBrandId,
  type BrandId,
} from "@/lib/brand/brands";

type SetBrandOptions = {
  /** Skip brand-change event (e.g. syncing header from a loaded quote). */
  silent?: boolean;
};

type BrandContextValue = {
  brand: BrandId;
  setBrand: (brand: BrandId, options?: SetBrandOptions) => void;
};

const BrandContext = createContext<BrandContextValue | null>(null);

function readStoredBrand(): BrandId {
  if (typeof window === "undefined") return DEFAULT_BRAND;
  try {
    const raw = window.localStorage.getItem(BRAND_STORAGE_KEY);
    return isBrandId(raw) ? raw : DEFAULT_BRAND;
  } catch {
    return DEFAULT_BRAND;
  }
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrandState] = useState<BrandId>(DEFAULT_BRAND);
  const brandRef = useRef<BrandId>(DEFAULT_BRAND);

  useEffect(() => {
    const stored = readStoredBrand();
    brandRef.current = stored;
    setBrandState(stored);
  }, []);

  const setBrand = useCallback((next: BrandId, options?: SetBrandOptions) => {
    if (brandRef.current === next) return;
    brandRef.current = next;
    try {
      window.localStorage.setItem(BRAND_STORAGE_KEY, next);
    } catch {
      // ignore quota / private mode
    }
    setBrandState(next);
    if (!options?.silent) {
      window.dispatchEvent(
        new CustomEvent<BrandId>("teknotip:brand-change", { detail: next }),
      );
    }
  }, []);

  const value = useMemo(() => ({ brand, setBrand }), [brand, setBrand]);

  return (
    <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
  );
}

export function useBrand(): BrandContextValue {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error("useBrand must be used within BrandProvider");
  }
  return context;
}
