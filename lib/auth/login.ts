"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_SESSION_COOKIE, isDemoLogin } from "./demo";

export async function loginAction(
  _prev: string | null,
  formData: FormData,
): Promise<string | null> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!isDemoLogin(username, password)) {
    return "Kullanıcı adı veya şifre hatalı.";
  }
  const jar = await cookies();
  jar.set(DEMO_SESSION_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
  });
  redirect("/teklif");
}
