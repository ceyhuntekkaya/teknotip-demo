"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
} from "@/lib/api/generated/endpoints/customers/customers";
import {
  createInstitution,
  deleteInstitution,
  updateInstitution,
} from "@/lib/api/generated/endpoints/institutions/institutions";
import type {
  CustomerRequest,
  CustomerResponse,
  InstitutionRequest,
  InstitutionResponse,
} from "@/lib/api/generated/model";
import { InstitutionRequestType } from "@/lib/api/generated/model";
import { apiErrorMessage, isSuccessStatus } from "@/lib/api/errors";
import { customerLabel } from "@/lib/customer/display";
import { customerSearchValues, matchesQuery } from "@/lib/search/matches-query";
import { SplitWorkspace } from "@/components/layout/split-workspace";
import { ListSearchInput } from "@/components/layout/list-search-input";
import { RelatedQuotesPanel } from "@/components/quote/related-quotes-panel";
import {
  ActionButton,
  Field,
  Select,
  TextArea,
  TextInput,
} from "@/components/catalog/fields";

const NEW_INSTITUTION = "new";

function toInstitutionRequest(institution?: InstitutionResponse | null): InstitutionRequest {
  return {
    code: institution?.code,
    type:
      institution?.type === InstitutionRequestType.INDIVIDUAL
        ? InstitutionRequestType.INDIVIDUAL
        : InstitutionRequestType.CORPORATE,
    name: institution?.name ?? "",
    address: institution?.address,
    district: institution?.district,
    city: institution?.city,
    postalCode: institution?.postalCode,
    country: institution?.country ?? "TR",
    taxOffice: institution?.taxOffice,
    taxNumber: institution?.taxNumber,
  };
}

function emptyInstitution(): InstitutionRequest {
  return {
    type: InstitutionRequestType.CORPORATE,
    name: "",
    country: "TR",
  };
}

function toCustomerRequest(
  customer: CustomerResponse,
  institutionId: string,
): CustomerRequest {
  return {
    institutionId,
    department: customer.department,
    contactPerson: customer.contactPerson,
    title: customer.title,
    phone: customer.phone,
    extension: customer.extension,
    mobile: customer.mobile,
    fax: customer.fax,
    email: customer.email,
    notes: customer.notes,
  };
}

function emptyCustomer(institutionId: string): CustomerRequest {
  return { institutionId };
}

function sortCustomers(items: CustomerResponse[]): CustomerResponse[] {
  return [...items].sort((a, b) =>
    customerLabel(a).localeCompare(customerLabel(b), "tr"),
  );
}

function sortInstitutions(items: InstitutionResponse[]): InstitutionResponse[] {
  return [...items].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", "tr"),
  );
}

export function CustomerEditor({
  initialCustomers,
  initialInstitutions,
}: {
  initialCustomers: CustomerResponse[];
  initialInstitutions: InstitutionResponse[];
}) {
  const [customers, setCustomers] = useState(() => sortCustomers(initialCustomers));
  const [institutions, setInstitutions] = useState(() =>
    sortInstitutions(initialInstitutions),
  );
  const [selectedId, setSelectedId] = useState<string | "new" | null>(
    initialCustomers[0]?.id ?? "new",
  );
  const [institutionChoice, setInstitutionChoice] = useState<string>(
    initialCustomers[0]?.institution?.id ?? NEW_INSTITUTION,
  );
  const [institutionDraft, setInstitutionDraft] = useState<InstitutionRequest>(() =>
    toInstitutionRequest(initialCustomers[0]?.institution ?? initialInstitutions[0] ?? null),
  );
  const [draft, setDraft] = useState<CustomerRequest>(() =>
    initialCustomers[0]
      ? toCustomerRequest(
          initialCustomers[0],
          initialCustomers[0].institution?.id ?? "",
        )
      : emptyCustomer(""),
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => customers.find((item) => item.id === selectedId) ?? null,
    [customers, selectedId],
  );
  const filteredCustomers = useMemo(
    () =>
      customers.filter((item) => matchesQuery(customerSearchValues(item), query)),
    [customers, query],
  );

  const select = (customer: CustomerResponse | null) => {
    if (!customer?.id) {
      setSelectedId("new");
      setInstitutionChoice(NEW_INSTITUTION);
      setInstitutionDraft(emptyInstitution());
      setDraft(emptyCustomer(""));
      setStatus("idle");
      setError(null);
      return;
    }
    setSelectedId(customer.id);
    setInstitutionChoice(customer.institution?.id ?? NEW_INSTITUTION);
    setInstitutionDraft(toInstitutionRequest(customer.institution));
    setDraft(toCustomerRequest(customer, customer.institution?.id ?? ""));
    setStatus("idle");
    setError(null);
  };

  useEffect(() => {
    if (selectedId === "new" || selectedId === null) return;
    if (filteredCustomers.some((item) => item.id === selectedId)) return;
    if (filteredCustomers[0]) select(filteredCustomers[0]);
  }, [filteredCustomers, selectedId]);

  const pickInstitution = (id: string) => {
    setInstitutionChoice(id);
    if (id === NEW_INSTITUTION) {
      setInstitutionDraft(emptyInstitution());
      setDraft((current) => ({ ...current, institutionId: "" }));
      return;
    }
    const found = institutions.find((item) => item.id === id) ?? null;
    setInstitutionDraft(toInstitutionRequest(found));
    setDraft((current) => ({ ...current, institutionId: id }));
  };

  const patchInstitution = (next: Partial<InstitutionRequest>) => {
    setInstitutionDraft((current) => ({ ...current, ...next }));
    setStatus("idle");
  };

  const patch = (next: Partial<CustomerRequest>) => {
    setDraft((current) => ({ ...current, ...next }));
    setStatus("idle");
  };

  const upsertInstitution = async (): Promise<InstitutionResponse | null> => {
    const name = institutionDraft.name.trim();
    if (!name) {
      setError("Kurum veya kişi adı zorunludur.");
      setStatus("error");
      return null;
    }
    const payload: InstitutionRequest = { ...institutionDraft, name };
    const response =
      institutionChoice !== NEW_INSTITUTION
        ? await updateInstitution(institutionChoice, payload)
        : await createInstitution(payload);
    if (!isSuccessStatus(response.status)) {
      setError(apiErrorMessage(response.data));
      setStatus("error");
      return null;
    }
    const saved = response.data as InstitutionResponse;
    setInstitutions((current) =>
      sortInstitutions([...current.filter((item) => item.id !== saved.id), saved]),
    );
    if (saved.id) {
      setInstitutionChoice(saved.id);
      setInstitutionDraft(toInstitutionRequest(saved));
      setDraft((current) => ({ ...current, institutionId: saved.id! }));
    }
    return saved;
  };

  const save = async () => {
    setStatus("saving");
    setError(null);
    const institution = await upsertInstitution();
    if (!institution?.id) return;
    const payload: CustomerRequest = { ...draft, institutionId: institution.id };
    const response =
      selectedId && selectedId !== "new"
        ? await updateCustomer(selectedId, payload)
        : await createCustomer(payload);
    if (!isSuccessStatus(response.status)) {
      setError(apiErrorMessage(response.data));
      setStatus("error");
      return;
    }
    const saved = response.data as CustomerResponse;
    setCustomers((current) =>
      sortCustomers([...current.filter((item) => item.id !== saved.id), saved]),
    );
    if (saved.institution) {
      const nested = saved.institution;
      setInstitutions((current) =>
        sortInstitutions([...current.filter((item) => item.id !== nested.id), nested]),
      );
    }
    if (saved.id) {
      setSelectedId(saved.id);
      setInstitutionChoice(saved.institution?.id ?? institution.id);
      setInstitutionDraft(toInstitutionRequest(saved.institution));
      setDraft(toCustomerRequest(saved, saved.institution?.id ?? institution.id));
    }
    setStatus("saved");
  };

  const remove = async () => {
    if (!selectedId || selectedId === "new") return;
    if (!window.confirm("Bu kontak kişiyi silmek istiyor musunuz?")) return;
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

  const removeInstitution = async () => {
    if (institutionChoice === NEW_INSTITUTION) return;
    if (!window.confirm("Bu kurumu silmek istiyor musunuz? Bağlı kontak varsa silinmez.")) {
      return;
    }
    const response = await deleteInstitution(institutionChoice);
    if (!isSuccessStatus(response.status)) {
      setError(apiErrorMessage(response.data));
      setStatus("error");
      return;
    }
    const remainingInstitutions = institutions.filter((item) => item.id !== institutionChoice);
    const remainingCustomers = customers.filter(
      (item) => item.institution?.id !== institutionChoice,
    );
    setInstitutions(remainingInstitutions);
    setCustomers(remainingCustomers);
    select(remainingCustomers[0] ?? null);
  };

  return (
    <SplitWorkspace
      section="Müşteriler"
      title="Kayıtlar"
      listHeader={
        <div className="grid gap-2 border-b border-[var(--rule)] px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
              Liste
            </p>
            <ActionButton tone="heat" onClick={() => select(null)}>
              Yeni
            </ActionButton>
          </div>
          <ListSearchInput value={query} onChange={setQuery} />
        </div>
      }
      list={
        <ul>
          {filteredCustomers.length === 0 ? (
            <li className="px-4 py-6 text-sm text-[var(--steel)]">
              Kayıt bulunamadı.
            </li>
          ) : (
            filteredCustomers.map((customer) => (
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
                <span>{customer.institution?.name || "Kurum yok"}</span>
                <span className="text-xs">{customer.contactPerson || "Yetkili yok"}</span>
              </button>
            </li>
            ))
          )}
        </ul>
      }
    >
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-2">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
            Kurum
          </p>
        </div>
        <div className="sm:col-span-2">
          <Field label="Kayıtlı kurum">
            <Select
              value={institutionChoice}
              onChange={(event) => pickInstitution(event.target.value)}
            >
              <option value={NEW_INSTITUTION}>Yeni kurum</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Tür">
          <Select
            value={institutionDraft.type}
            onChange={(event) =>
              patchInstitution({ type: event.target.value as InstitutionRequest["type"] })
            }
          >
            <option value={InstitutionRequestType.CORPORATE}>Kurumsal</option>
            <option value={InstitutionRequestType.INDIVIDUAL}>Bireysel</option>
          </Select>
        </Field>
        <Field label="Kod">
          <TextInput
            value={institutionDraft.code ?? ""}
            onChange={(event) => patchInstitution({ code: event.target.value })}
          />
        </Field>
        <Field label="Kurum / kişi">
          <TextInput
            value={institutionDraft.name}
            onChange={(event) => patchInstitution({ name: event.target.value })}
            required
          />
        </Field>
        <Field label="İl">
          <TextInput
            value={institutionDraft.city ?? ""}
            onChange={(event) => patchInstitution({ city: event.target.value })}
          />
        </Field>
        <Field label="Vergi dairesi">
          <TextInput
            value={institutionDraft.taxOffice ?? ""}
            onChange={(event) => patchInstitution({ taxOffice: event.target.value })}
          />
        </Field>
        <Field label="Vergi no / TCKN">
          <TextInput
            value={institutionDraft.taxNumber ?? ""}
            onChange={(event) => patchInstitution({ taxNumber: event.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Adres">
            <TextArea
              value={institutionDraft.address ?? ""}
              onChange={(event) => patchInstitution({ address: event.target.value })}
            />
          </Field>
        </div>

        <div className="sm:col-span-2 pt-2">
          <p className="font-display text-[11px] uppercase tracking-[0.18em] text-[var(--steel)]">
            Kontak kişi
          </p>
        </div>
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
              Kontağı sil
            </ActionButton>
          ) : null}
          {institutionChoice !== NEW_INSTITUTION ? (
            <ActionButton tone="danger" onClick={() => void removeInstitution()}>
              Kurumu sil
            </ActionButton>
          ) : null}
        </div>
        {selected?.updatedAt ? (
          <p className="sm:col-span-2 text-xs text-[var(--steel)]">
            Son güncelleme: {selected.updatedAt}
          </p>
        ) : null}
      </div>
        <RelatedQuotesPanel
          customerId={selectedId !== "new" ? selected?.id : undefined}
        />
      </div>
    </SplitWorkspace>
  );
}
