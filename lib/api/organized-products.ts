import { customFetch } from "@/lib/api/fetcher";
import type { ApiError, MessageResponse } from "@/lib/api/generated/model";

export type OrganizedPropertyType = "SINGLE_CHOICE" | "MULTIPLE_CHOICE";

export type OrganizedProductPropertyRequest = {
  name: string;
  type: OrganizedPropertyType;
  values?: string[];
};

export type OrganizedProductAccessoryRequest = {
  name: string;
};

export type OrganizedProductRequest = {
  code?: string;
  name: string;
  price?: number;
  description?: string | null;
  image?: string | null;
  category?: string | null;
  properties?: OrganizedProductPropertyRequest[];
  accessories?: OrganizedProductAccessoryRequest[];
};

export type OrganizedProductPropertyResponse = {
  id?: string;
  name?: string;
  type?: OrganizedPropertyType;
  sortOrder?: number;
  values?: string[];
};

export type OrganizedProductAccessoryResponse = {
  id?: string;
  name?: string;
  sortOrder?: number;
};

export type OrganizedProductResponse = {
  id?: string;
  code?: string | null;
  name?: string;
  price?: number | null;
  description?: string | null;
  image?: string | null;
  category?: string | null;
  properties?: OrganizedProductPropertyResponse[];
  accessories?: OrganizedProductAccessoryResponse[];
  transferred?: boolean;
  productId?: string | null;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PageOrganizedProductResponse = {
  content?: OrganizedProductResponse[];
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
};

export type ListOrganizedProductsParams = {
  q?: string;
  page?: number;
  size?: number;
  sort?: string[];
};

type ApiResult<T> = {
  data: T | ApiError;
  status: number;
  headers: Headers;
};

function queryString(params?: ListOrganizedProductsParams): string {
  if (!params) return "";
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.size !== undefined) search.set("size", String(params.size));
  for (const value of params.sort ?? []) {
    search.append("sort", value);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export async function listOrganizedProducts(
  params?: ListOrganizedProductsParams,
): Promise<ApiResult<PageOrganizedProductResponse>> {
  return customFetch(`/backend/v1/organized-products${queryString(params)}`, {
    method: "GET",
  });
}

export async function createOrganizedProduct(
  body: OrganizedProductRequest,
): Promise<ApiResult<OrganizedProductResponse>> {
  return customFetch(`/backend/v1/organized-products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function updateOrganizedProduct(
  id: string,
  body: OrganizedProductRequest,
): Promise<ApiResult<OrganizedProductResponse>> {
  return customFetch(`/backend/v1/organized-products/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteOrganizedProduct(
  id: string,
): Promise<ApiResult<MessageResponse>> {
  return customFetch(`/backend/v1/organized-products/${id}`, {
    method: "DELETE",
  });
}

export async function transferOrganizedProduct(
  id: string,
): Promise<ApiResult<OrganizedProductResponse>> {
  return customFetch(`/backend/v1/organized-products/${id}/transfer`, {
    method: "POST",
  });
}
