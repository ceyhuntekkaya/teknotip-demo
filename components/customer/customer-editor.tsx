"use client";

import { useMemo, useState } from "react";
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
} from "@/lib/api/generated/endpoints/customers/customers";
import type { CustomerRequest, CustomerResponse } from "@/lib/api/generated/model";
import { CustomerRequestType } from "@/lib/api/generated/model";
import { apiErrorMessage, isSuccessStatus } from "@/lib/api/errors";
import { SplitWorkspace } from "@/components/layout/split-workspace";
import {
  ActionButton,
  Field,
  Select,
  TextArea,
  TextInput,
} from "@/components/catalog/fields";

function toRequest(customer: CustomerResponse): CustomerRequest {
  return {
    code: customer.code,
    type:
      customer.type === CustomerRequestType.INDIVIDUAL
        ? CustomerRequestType.INDIVIDUAL
        : CustomerRequestType.CORPORATE,
    institution: customer.institution ?? "",
    department: customer.department,
    contactPerson: customer.contactPerson,
    title: customer.title,
    phone: customer.phone,
    extension: customer.extension,
    mobile: customer.mobile,
    fax: customer.fax,
    email: customer.email,
    address: customer.address,
    district: customer.district,
    city: customer.city,
    postalCode: customer.postalCode,
    country: customer.country ?? "TR",
    taxOffice: customer.taxOffice,
    taxNumber: customer.taxNumber,
    notes: customer.notes,
  };
}

function emptyCustomer(): CustomerRequest {
  return {
    type: CustomerRequestType.CORPORATE,
    institution: "",
    country: "TR",
  };
}

export function CustomerEditor({
  initialCustomers,
}: {
  initialCustomers: CustomerResponse[];
}) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(
    initialCustomers[0]?.id ?? "new",
  );
  const [draft, setDraft] = useState<CustomerRequest>(() =>
    initialCustomers[0] ? toRequest(initialCustomers[0]) : emptyCustomer(),
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => customers.find((item) => item.id === selectedId) ?? null,
    [customers, selectedId],
  );

  const select = (customer: CustomerResponse | null) => {
    if (!customer?.id) {
      setSelectedId("new");
      setDraft(emptyCustomer());
      return;
    }
    setSelectedId(customer.id);
    setDraft(toRequest(customer));
    setStatus("idle");
    setError(null);
  };

  const patch = (next: Partial<CustomerRequest>) => {
    setDraft((current) => ({ ...current, ...next }));
    setStatus("idle");
  };

  const save = async () => {
    if (!draft.institution.trim()) {
      setError("Kurum veya kişi adı zorunludur.");
      setStatus("error");
      return;
    }
    setStatus("saving");
    setError(null);
    const response =
      selectedId && selectedId !== "new"
        ? await updateCustomer(selectedId, draft)
        : await createCustomer(draft);
    if (!isSuccessStatus(response.status)) {
      setError(apiErrorMessage(response.data));
      setStatus("error");
      return;
    }
    const saved = response.data as CustomerResponse;
    setCustomers((current) => {
      const without = current.filter((item) => item.id !== saved.id);
      return [...without, saved].sort((a, b) =>
        (a.institution ?? "").localeCompare(b.institution ?? "", "tr"),
      );
    });
    if (saved.id) {
      setSelectedId(saved.id);
      setDraft(toRequest(saved));
    }
    setStatus("saved");
  };

  const remove = async () => {
    if (!selectedId || selectedId === "new") return;
    if (!window.confirm("Bu müşteriyi silmek istiyor musunuz?")) return;
    const response = await deleteCustomer(selectedId);
    if (!isSuccessStatus(response.status)) {
      setError(apiErrorMessage(response.data));
      setStatus("error");
      return;
    }
    const remaining = customers.filter((item) => item.id !== selectedId);
    setCustomers(remaining);
    select(remaining[0] ?? null);
  };

  return (
    <SplitWorkspace
      eyebrow="TeknoTip · Müşteriler"
      title="Kayıtlar"
      listHeader={
        <div className="flex items-center justify-between px-4 py-3">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
            Liste
          </p>
          <ActionButton tone="heat" onClick={() => select(null)}>
            Yeni
          </ActionButton>
        </div>
      }
      list={
        <ul>
          {customers.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                onClick={() => select(customer)}
                className={`flex w-full flex-col items-start gap-0.5 border-t border-[var(--rule)] px-4 py-3 text-left text-sm ${
                  selectedId === customer.id
                    ? "bg-[var(--mist)]"
                    : "text-[var(--steel)] hover:text-[var(--charcoal)]"
                }`}
              >
                <span>{customer.institution}</span>
                <span className="text-xs">{customer.contactPerson}</span>
              </button>
            </li>
          ))}
        </ul>
      }
    >
      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        <Field label="Tür">
          <Select
            value={draft.type}
            onChange={(event) =>
              patch({ type: event.target.value as CustomerRequest["type"] })
            }
          >
            <option value={CustomerRequestType.CORPORATE}>Kurumsal</option>
            <option value={CustomerRequestType.INDIVIDUAL}>Bireysel</option>
          </Select>
        </Field>
        <Field label="Kod">
          <TextInput
            value={draft.code ?? ""}
            onChange={(event) => patch({ code: event.target.value })}
          />
        </Field>
        <Field label="Kurum / kişi">
          <TextInput
            value={draft.institution}
            onChange={(event) => patch({ institution: event.target.value })}
            required
          />
        </Field>
        <Field label="Departman">
          <TextInput
            value={draft.department ?? ""}
            onChange={(event) => patch({ department: event.target.value })}
          />
        </Field>
        <Field label="Yetkili">
          <TextInput
            value={draft.contactPerson ?? ""}
            onChange={(event) => patch({ contactPerson: event.target.value })}
          />
        </Field>
        <Field label="Unvan">
          <TextInput
            value={draft.title ?? ""}
            onChange={(event) => patch({ title: event.target.value })}
          />
        </Field>
        <Field label="Telefon">
          <TextInput
            value={draft.phone ?? ""}
            onChange={(event) => patch({ phone: event.target.value })}
          />
        </Field>
        <Field label="Dahili">
          <TextInput
            value={draft.extension ?? ""}
            onChange={(event) => patch({ extension: event.target.value })}
          />
        </Field>
        <Field label="Cep">
          <TextInput
            value={draft.mobile ?? ""}
            onChange={(event) => patch({ mobile: event.target.value })}
          />
        </Field>
        <Field label="E-posta">
          <TextInput
            value={draft.email ?? ""}
            onChange={(event) => patch({ email: event.target.value })}
          />
        </Field>
        <Field label="İl">
          <TextInput
            value={draft.city ?? ""}
            onChange={(event) => patch({ city: event.target.value })}
          />
        </Field>
        <Field label="Vergi dairesi">
          <TextInput
            value={draft.taxOffice ?? ""}
            onChange={(event) => patch({ taxOffice: event.target.value })}
          />
        </Field>
        <Field label="Vergi no / TCKN">
          <TextInput
            value={draft.taxNumber ?? ""}
            onChange={(event) => patch({ taxNumber: event.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Adres">
            <TextArea
              value={draft.address ?? ""}
              onChange={(event) => patch({ address: event.target.value })}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Not">
            <TextArea
              value={draft.notes ?? ""}
              onChange={(event) => patch({ notes: event.target.value })}
            />
          </Field>
        </div>
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
          {selectedId && selectedId !== "new" ? (
            <ActionButton tone="danger" onClick={() => void remove()}>
              Sil
            </ActionButton>
          ) : null}
        </div>
        {selected?.updatedAt ? (
          <p className="sm:col-span-2 text-xs text-[var(--steel)]">
            Son güncelleme: {selected.updatedAt}
          </p>
        ) : null}
      </div>
    </SplitWorkspace>
  );
}
