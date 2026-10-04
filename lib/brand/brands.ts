import type { QuoteBrand } from "@/lib/api/generated/model";

export type BrandId = QuoteBrand;

export type BrandDefinition = {
  id: BrandId;
  displayName: string;
  logo: string;
};

export const BRANDS: readonly BrandDefinition[] = [
  {
    id: "TEKNOTIP",
    displayName: "TeknoTıp",
    logo: "/brand/teknotip/logo.png",
  },
  {
    id: "OPTOSENSE",
    displayName: "OptoSense",
    logo: "/brand/optosense/logo.png",
  },
  {
    id: "MILIMLAB",
    displayName: "MilimLab",
    logo: "/brand/milimlab/logo.png",
  },
] as const;

export const DEFAULT_BRAND: BrandId = "TEKNOTIP";

export const BRAND_STORAGE_KEY = "teknotip.active-brand";

export function isBrandId(value: unknown): value is BrandId {
  return (
    value === "TEKNOTIP" || value === "OPTOSENSE" || value === "MILIMLAB"
  );
}

export function brandOf(id: BrandId | null | undefined): BrandDefinition {
  return BRANDS.find((brand) => brand.id === id) ?? BRANDS[0];
}

export function brandLabel(id: BrandId | null | undefined): string {
  return brandOf(id).displayName;
}
