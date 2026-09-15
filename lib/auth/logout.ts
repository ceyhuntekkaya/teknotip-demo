"use server";

import { redirect } from "next/navigation";
import { logout } from "@/lib/api/generated/endpoints/auth/auth";
import { clearAuthCookies } from "./session";

export async function logoutAction(): Promise<void> {
  try {
    await logout();
  } catch {
    // Cookie'ler yine de temizlenir.
  }
  await clearAuthCookies();
  redirect("/");
}
