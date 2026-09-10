"use client";

import Image from "next/image";
import { useActionState } from "react";
import { ActionButton, Field, TextInput } from "@/components/catalog/fields";
import { loginAction } from "@/lib/auth/login";

export function LoginForm() {
  const [error, action, pending] = useActionState(loginAction, null);

  return (
    <form action={action} className="grid w-full max-w-sm gap-8">
      <Image
        src="/brand/logo.png"
        alt="TeknoTip"
        width={812}
        height={298}
        priority
        className="mx-auto h-auto w-[220px]"
      />
      <div className="grid gap-4">
        <Field label="Kullanıcı adı">
          <TextInput
            name="username"
            autoComplete="username"
            autoFocus
            required
          />
        </Field>
        <Field label="Şifre">
          <TextInput
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        {error ? <p className="text-sm text-[#8f2d1f]">{error}</p> : null}
        <ActionButton type="submit" tone="heat" disabled={pending} className="w-full">
          Giriş yap
        </ActionButton>
      </div>
    </form>
  );
}
