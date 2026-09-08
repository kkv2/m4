"use client";

import { useState, type FormEvent } from "react";

import { Modal } from "~/components/modal";
import { ReadOnlyFacts } from "~/components/read-only-facts";
import type { Language } from "~/i18n";
import { admin } from "~/i18n/messages/admin";
import { api, type RouterOutputs } from "~/lib/trpc-client";

export type TenantSummary = RouterOutputs["admin"]["tenants"]["list"][number];

/**
 * Registering a tenant, and editing one — the same two fields either way, so
 * the same dialog.
 *
 * `tenant` is what tells them apart: null registers a new one, a row edits that
 * one. In edit mode the identifier and the counts come along as text, because
 * two customers may legitimately share a display name and the identifier is the
 * only thing that says which of them this dialog is about.
 */
export function TenantFormModal({
  tenant,
  onClose,
}: {
  tenant: TenantSummary | null;
  onClose: () => void;
}) {
  const utils = api.useUtils();

  const [name, setName] = useState(tenant?.name ?? "");
  const [defaultLanguage, setDefaultLanguage] = useState<Language>(tenant?.defaultLanguage ?? "JA");
  const [error, setError] = useState<string | null>(null);

  async function republish() {
    await Promise.all([
      utils.admin.tenants.list.invalidate(),
      utils.admin.tenants.get.invalidate(),
    ]);
  }

  // The list behind the dialog is the confirmation: it carries the new row, or
  // the edited one, the moment this closes.
  const create = api.admin.tenants.create.useMutation({
    onSuccess: async () => {
      await republish();
      onClose();
    },
    onError: () => setError(admin.signIn.unexpectedError),
  });

  const update = api.admin.tenants.update.useMutation({
    onSuccess: async () => {
      await republish();
      onClose();
    },
    onError: () => setError(admin.signIn.unexpectedError),
  });

  const pending = create.isPending || update.isPending;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (name.trim().length === 0) {
      setError(admin.tenants.nameRequired);
      return;
    }

    if (tenant) {
      update.mutate({ tenantId: tenant.id, name, defaultLanguage });
    } else {
      create.mutate({ name, defaultLanguage });
    }
  }

  return (
    <Modal
      title={tenant ? admin.tenants.editHeading : admin.tenants.registerHeading}
      closeLabel={admin.common.close}
      onClose={onClose}
    >
      {tenant ? (
        <ReadOnlyFacts
          note={admin.common.readOnlyNote}
          facts={[
            { label: admin.tenants.columnId, value: tenant.id, mono: true },
            { label: admin.tenants.columnUsers, value: tenant.userCount },
            { label: admin.tenants.columnChats, value: tenant.conversationCount },
          ]}
        />
      ) : null}

      {/* POST for the same reason as the sign-in form: an un-hydrated native
          submission must not put field values in the query string. `noValidate`
          because this form has its own refusals to give — `required` marks the
          fields for assistive technology, and the message stays ours. */}
      <form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="required-field text-sm text-content-muted">
            {admin.tenants.nameLabel}
          </span>
          <input
            type="text"
            name="name"
            required
            value={name}
            placeholder={admin.tenants.namePlaceholder}
            onChange={(event) => setName(event.target.value)}
            className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="required-field text-sm text-content-muted">
            {admin.tenants.defaultLanguageLabel}
          </span>
          <select
            name="defaultLanguage"
            required
            value={defaultLanguage}
            onChange={(event) => setDefaultLanguage(event.target.value as Language)}
            className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
          >
            <option value="JA">{admin.language.JA}</option>
            <option value="EN">{admin.language.EN}</option>
          </select>
        </label>

        <p className="text-xs text-content-muted">{admin.common.requiredLegend}</p>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
          >
            {tenant ? admin.common.save : admin.tenants.submit}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border-subtle px-3 py-2 text-sm text-content-muted hover:text-content"
          >
            {admin.common.cancel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
