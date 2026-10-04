"use client";

import { useMemo, useState } from "react";
import { createUser, deleteUser, updateUser } from "@/lib/api/users";
import type { UserRequest } from "@/lib/api/users";
import type { UserResponse } from "@/lib/api/generated/model";
import { apiErrorMessage, isSuccessStatus } from "@/lib/api/errors";
import { SplitWorkspace } from "@/components/layout/split-workspace";
import { ActionButton, Field, TextInput } from "@/components/catalog/fields";

const PASSWORD_PATTERN = /^(?=.*[A-Za-zÇĞİÖŞÜçğıöşü])(?=.*\d).{8,}$/;

function emptyDraft(): UserRequest {
  return {
    username: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  };
}

function toDraft(user: UserResponse): UserRequest {
  return {
    username: user.username ?? "",
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    password: "",
  };
}

function userLabel(user: UserResponse): string {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || user.username || "Kullanıcı";
}

function sortUsers(items: UserResponse[]): UserResponse[] {
  return [...items].sort((a, b) => userLabel(a).localeCompare(userLabel(b), "tr"));
}

function formatDateTime(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("tr-TR");
}

function matchesQuery(user: UserResponse, query: string): boolean {
  if (!query.trim()) return true;
  const haystack = [
    user.username,
    user.firstName,
    user.lastName,
    user.email,
    user.phone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr");
  return haystack.includes(query.trim().toLocaleLowerCase("tr"));
}

export function UserEditor({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserResponse[];
  currentUserId?: string;
}) {
  const [users, setUsers] = useState(() => sortUsers(initialUsers));
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | "new" | null>(
    initialUsers[0]?.id ?? "new",
  );
  const [draft, setDraft] = useState<UserRequest>(() =>
    initialUsers[0] ? toDraft(initialUsers[0]) : emptyDraft(),
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => users.find((item) => item.id === selectedId) ?? null,
    [users, selectedId],
  );
  const visible = useMemo(
    () => users.filter((item) => matchesQuery(item, query)),
    [users, query],
  );
  const isNew = !selectedId || selectedId === "new";
  const isSelf = Boolean(selectedId && selectedId === currentUserId);

  const select = (user: UserResponse | null) => {
    if (!user?.id) {
      setSelectedId("new");
      setDraft(emptyDraft());
      setStatus("idle");
      setError(null);
      return;
    }
    setSelectedId(user.id);
    setDraft(toDraft(user));
    setStatus("idle");
    setError(null);
  };

  const patch = (next: Partial<UserRequest>) => {
    setDraft((current) => ({ ...current, ...next }));
    setStatus("idle");
  };

  const save = async () => {
    const username = draft.username.trim();
    const firstName = draft.firstName.trim();
    const lastName = draft.lastName.trim();
    const password = draft.password?.trim() ?? "";
    if (!username || !firstName || !lastName) {
      setError("Kullanıcı adı, ad ve soyad zorunludur.");
      setStatus("error");
      return;
    }
    if (isNew && !password) {
      setError("Yeni kullanıcı için şifre zorunludur.");
      setStatus("error");
      return;
    }
    if (password && !PASSWORD_PATTERN.test(password)) {
      setError("Şifre en az 8 karakter olmalı; en az bir harf ve bir rakam içermelidir.");
      setStatus("error");
      return;
    }
    setStatus("saving");
    setError(null);
    const payload: UserRequest = {
      username,
      firstName,
      lastName,
      email: draft.email?.trim() || undefined,
      phone: draft.phone?.trim() || undefined,
      password: password || undefined,
    };
    const response =
      !isNew && selectedId
        ? await updateUser(selectedId, payload)
        : await createUser(payload);
    if (!isSuccessStatus(response.status)) {
      setError(apiErrorMessage(response.data));
      setStatus("error");
      return;
    }
    const saved = response.data as UserResponse;
    setUsers((current) =>
      sortUsers([...current.filter((item) => item.id !== saved.id), saved]),
    );
    if (saved.id) {
      setSelectedId(saved.id);
      setDraft(toDraft(saved));
    }
    setStatus("saved");
  };

  const remove = async () => {
    if (isNew || !selectedId) return;
    if (isSelf) {
      setError("Kendi hesabınızı silemezsiniz.");
      setStatus("error");
      return;
    }
    if (!window.confirm("Bu kullanıcıyı silmek istiyor musunuz?")) return;
    const response = await deleteUser(selectedId);
    if (!isSuccessStatus(response.status)) {
      setError(apiErrorMessage(response.data));
      setStatus("error");
      return;
    }
    const remaining = users.filter((item) => item.id !== selectedId);
    setUsers(remaining);
    select(remaining[0] ?? null);
  };

  return (
    <SplitWorkspace
      section="Kullanıcılar"
      title="Kayıtlar"
      listHeader={
        <div className="grid gap-2 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
              Liste
            </p>
            <ActionButton tone="heat" onClick={() => select(null)}>
              Yeni
            </ActionButton>
          </div>
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ad, kullanıcı adı veya e-posta"
            aria-label="Kullanıcı ara"
          />
        </div>
      }
      list={
        <ul>
          {visible.length === 0 ? (
            <li className="px-4 py-6 text-sm text-[var(--steel)]">Kullanıcı bulunamadı.</li>
          ) : (
            visible.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => select(user)}
                  className={`flex w-full flex-col items-start gap-0.5 border-t border-[var(--rule)] px-4 py-3 text-left text-sm ${
                    selectedId === user.id
                      ? "bg-[var(--mist)]"
                      : "text-[var(--steel)] hover:text-[var(--charcoal)]"
                  }`}
                >
                  <span>{userLabel(user)}</span>
                  <span className="text-xs">{user.username}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      }
    >
      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        <Field label="Kullanıcı adı">
          <TextInput
            value={draft.username}
            onChange={(event) => patch({ username: event.target.value })}
            autoComplete="off"
            required
          />
        </Field>
        <Field label="E-posta">
          <TextInput
            type="email"
            value={draft.email ?? ""}
            onChange={(event) => patch({ email: event.target.value })}
            autoComplete="off"
          />
        </Field>
        <Field label="Ad">
          <TextInput
            value={draft.firstName}
            onChange={(event) => patch({ firstName: event.target.value })}
            required
          />
        </Field>
        <Field label="Soyad">
          <TextInput
            value={draft.lastName}
            onChange={(event) => patch({ lastName: event.target.value })}
            required
          />
        </Field>
        <Field label="Telefon">
          <TextInput
            value={draft.phone ?? ""}
            onChange={(event) => patch({ phone: event.target.value })}
          />
        </Field>
        <Field label={isNew ? "Şifre" : "Yeni şifre"}>
          <TextInput
            type="password"
            value={draft.password ?? ""}
            onChange={(event) => patch({ password: event.target.value })}
            autoComplete="new-password"
            placeholder={isNew ? "" : "Değiştirmek istemezseniz boş bırakın"}
            required={isNew}
          />
        </Field>
        {error ? (
          <p className="sm:col-span-2 text-sm text-[#8f2d1f]">{error}</p>
        ) : null}
        {status === "saved" ? (
          <p className="sm:col-span-2 text-sm text-[var(--steel)]">Kaydedildi.</p>
        ) : null}
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <ActionButton tone="heat" disabled={status === "saving"} onClick={() => void save()}>
            Kaydet
          </ActionButton>
          {!isNew ? (
            <ActionButton tone="danger" disabled={isSelf} onClick={() => void remove()}>
              Sil
            </ActionButton>
          ) : null}
        </div>
        {selected?.lastLoginAt ? (
          <p className="sm:col-span-2 text-xs text-[var(--steel)]">
            Son giriş: {formatDateTime(selected.lastLoginAt)}
          </p>
        ) : null}
        {isSelf ? (
          <p className="sm:col-span-2 text-xs text-[var(--steel)]">
            Bu sizin hesabınız. Kendi kaydınızı silemezsiniz.
          </p>
        ) : null}
      </div>
    </SplitWorkspace>
  );
}
