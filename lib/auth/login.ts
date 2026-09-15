"use server";

import { redirect } from "next/navigation";
import { login } from "@/lib/api/generated/endpoints/auth/auth";
import { apiErrorMessage } from "@/lib/api/errors";
import { setAuthCookies } from "./session";

export async function loginAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) {
    return "Kullanıcı adı ve şifre zorunludur.";
  }

  let response;
  try {
    response = await login({ username, password });
  } catch {
    return "Sunucuya bağlanılamadı. Lütfen tekrar deneyin.";
  }

  if (response.status !== 200) {
    return apiErrorMessage(response.data, "Kullanıcı adı veya şifre hatalı.");
  }

  await setAuthCookies(response.data);
  redirect("/teklif");
}
