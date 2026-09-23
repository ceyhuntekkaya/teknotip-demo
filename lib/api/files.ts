import { apiErrorMessage, isSuccessStatus } from "@/lib/api/errors";
import { customFetch } from "@/lib/api/fetcher";

type UploadResult = {
  data: { path?: string; message?: string };
  status: number;
};

export async function uploadProductImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const response = await customFetch<UploadResult>("/backend/v1/files", {
    method: "POST",
    body,
  });
  const path = response.data?.path;
  if (!isSuccessStatus(response.status) || !path) {
    throw new Error(apiErrorMessage(response.data, "Görsel yüklenemedi."));
  }
  return path;
}
