import type {
  OrganizedProductRequest,
  OrganizedProductResponse,
} from "@/lib/api/organized-products";

export function organizedProductToRequest(
  product: OrganizedProductResponse,
): OrganizedProductRequest {
  return {
    code: product.code ?? "",
    name: product.name ?? "",
    price: product.price ?? 0,
    description: product.description,
    image: product.image,
    category: product.category,
    properties: (product.properties ?? []).map((property) => ({
      name: property.name ?? "",
      type: property.type === "MULTIPLE_CHOICE" ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE",
      values: property.values ?? [],
    })),
    accessories: (product.accessories ?? []).map((accessory) => ({
      name: accessory.name ?? "",
    })),
  };
}

export function emptyOrganizedProductDraft(): OrganizedProductRequest {
  return {
    code: "",
    name: "",
    price: 0,
    description: "",
    image: "",
    category: "",
    properties: [],
    accessories: [],
  };
}
