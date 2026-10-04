"use client";

import { useState } from "react";
import {
  ActionButton,
  Field,
  Select,
  TextInput,
} from "@/components/catalog/fields";
import { createCustomer } from "@/lib/api/generated/endpoints/customers/customers";
import { createInstitution } from "@/lib/api/generated/endpoints/institutions/institutions";
import type {
  CustomerResponse,
  InstitutionResponse,
  QuoteResponse,
} from "@/lib/api/generated/model";
import { InstitutionRequestType } from "@/lib/api/generated/model";
import {
  apiErrorMessage,
  apiFieldErrorMap,
  fieldError,
  isSuccessStatus,
} from "@/lib/api/errors";

export type SavePartyMode = "institution" | "contact";

export function SavePartyModal({
  quote,
  mode,
  onClose,
  onSaved,
}: {
  quote: QuoteResponse;
  mode: SavePartyMode;
  onClose: () => void;
  onSaved: (result: {
    institution?: InstitutionResponse;
    customer?: CustomerResponse;
  }) => void;
}) {
  const quoted = quote.quotedTo ?? {};
  const [name, setName] = useState(quoted.institution ?? "");
  const [type, setType] = useState<InstitutionRequestType>(
    InstitutionRequestType.CORPORATE,
  );
  const [contactPerson, setContactPerson] = useState(quoted.contactPerson ?? "");
  const [title, setTitle] = useState(quoted.title ?? "");
  const [phone, setPhone] = useState(quoted.phone ?? "");
  const [email, setEmail] = useState(quoted.email ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const needsInstitution = !quoted.institutionId;
  const titleText =
    mode === "institution" ? "Kurumu kaydet" : "Kişiyi kaydet";

  const applyApiFailure = (data: unknown, fallback: string) => {
    setFieldErrors(apiFieldErrorMap(data));
    setError(apiErrorMessage(data, fallback));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      let institutionId = quoted.institutionId;
      let institution: InstitutionResponse | undefined;

      if (needsInstitution || mode === "institution") {
        const institutionName = name.trim();
        if (!institutionName) {
          setFieldErrors({ name: "Kurum adı zorunludur." });
          setError("Lütfen işaretli alanları düzeltin.");
          return;
        }
        const createdInstitution = await createInstitution({
          type,
          name: institutionName,
          country: "TR",
          address: quoted.address,
          taxOffice: quoted.taxOffice,
          taxNumber: quoted.taxNumber,
        });
        if (!isSuccessStatus(createdInstitution.status)) {
          applyApiFailure(createdInstitution.data, "Kurum kaydedilemedi.");
          return;
        }
        institution = createdInstitution.data as InstitutionResponse;
        institutionId = institution.id;
        if (mode === "institution") {
          onSaved({ institution });
          return;
        }
      }

      if (mode === "contact") {
        if (!institutionId) {
          setFieldErrors({ name: "Kişi için önce kurum kaydı gerekir." });
          setError("Lütfen işaretli alanları düzeltin.");
          return;
        }
        const person = contactPerson.trim();
        if (!person) {
          setFieldErrors({ contactPerson: "İlgili kişi adı zorunludur." });
          setError("Lütfen işaretli alanları düzeltin.");
          return;
        }
        const createdCustomer = await createCustomer({
          institutionId,
          contactPerson: person,
          title: title.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          department: quoted.department,
        });
        if (!isSuccessStatus(createdCustomer.status)) {
          applyApiFailure(createdCustomer.data, "Kişi kaydedilemedi.");
          return;
        }
        onSaved({
          institution,
          customer: createdCustomer.data as CustomerResponse,
        });
      }
    } catch {
      setError("Kayıt sırasında bağlantı hatası oluştu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
      <div className="w-full max-w-lg border border-[var(--rule)] bg-[var(--paper)] p-5 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-[11px] uppercase tracking-[0.16em] text-[var(--steel)]">
              Veritabanı
            </p>
            <h3 className="font-display text-2xl tracking-wide">{titleText}</h3>
          </div>
          <ActionButton onClick={onClose}>Kapat</ActionButton>
        </div>

        <div className="grid gap-3">
          {(needsInstitution || mode === "institution") && (
            <>
              <Field label="Kurum adı" error={fieldError(fieldErrors, "name")}>
                <TextInput
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setFieldErrors((current) => {
                      const next = { ...current };
                      delete next.name;
                      return next;
                    });
                  }}
                />
              </Field>
              <Field label="Kurum türü" error={fieldError(fieldErrors, "type")}>
                <Select
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as InstitutionRequestType)
                  }
                >
                  <option value={InstitutionRequestType.CORPORATE}>Kurumsal</option>
                  <option value={InstitutionRequestType.INDIVIDUAL}>Bireysel</option>
                </Select>
              </Field>
            </>
          )}

          {mode === "contact" ? (
            <>
              <Field
                label="İlgili kişi"
                error={fieldError(fieldErrors, "contactPerson")}
              >
                <TextInput
                  value={contactPerson}
                  onChange={(event) => {
                    setContactPerson(event.target.value);
                    setFieldErrors((current) => {
                      const next = { ...current };
                      delete next.contactPerson;
                      return next;
                    });
                  }}
                />
              </Field>
              <Field label="Unvan" error={fieldError(fieldErrors, "title")}>
                <TextInput value={title} onChange={(event) => setTitle(event.target.value)} />
              </Field>
              <Field label="Telefon" error={fieldError(fieldErrors, "phone")}>
                <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} />
              </Field>
              <Field label="E-posta" error={fieldError(fieldErrors, "email")}>
                <TextInput value={email} onChange={(event) => setEmail(event.target.value)} />
              </Field>
            </>
          ) : null}

          {error ? (
            <p className="rounded-sm bg-[#fdf2f0] px-3 py-2 text-sm text-[#8f2d1f] ring-1 ring-[#8f2d1f]/40">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <ActionButton tone="heat" disabled={saving} onClick={() => void save()}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </ActionButton>
            <ActionButton onClick={onClose}>Vazgeç</ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
