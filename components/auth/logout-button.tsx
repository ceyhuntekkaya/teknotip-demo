"use client";

import { logoutAction } from "@/lib/auth/logout";
import { ActionButton } from "@/components/catalog/fields";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <ActionButton type="submit" tone="ghost">
        Çıkış
      </ActionButton>
    </form>
  );
}
