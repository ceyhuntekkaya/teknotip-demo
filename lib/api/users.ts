import { customFetch } from "@/lib/api/fetcher";
import type { ApiError, MessageResponse, UserResponse } from "@/lib/api/generated/model";

export type UserRequest = {
  username: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  password?: string;
};

type ApiResult<T> = {
  data: T | ApiError;
  status: number;
  headers: Headers;
};

export async function createUser(
  body: UserRequest,
): Promise<ApiResult<UserResponse>> {
  return customFetch(`/backend/v1/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function updateUser(
  id: string,
  body: UserRequest,
): Promise<ApiResult<UserResponse>> {
  return customFetch(`/backend/v1/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteUser(id: string): Promise<ApiResult<MessageResponse>> {
  return customFetch(`/backend/v1/users/${id}`, {
    method: "DELETE",
  });
}
