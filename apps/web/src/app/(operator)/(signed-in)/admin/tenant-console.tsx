"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import type { Language } from "~/i18n";
import { admin } from "~/i18n/messages/admin";
import { FRESH, api } from "~/lib/trpc-client";

/**
 * Tenant registration and the tenant list (FR-010 to FR-013).
 *
 * A client component calling tRPC over HTTP, like every other screen in this
 * feature. The alternative — reading through `createCaller` in a Server
 * Component and mutating over HTTP — would give the same data two paths and two
 * caching stories for no gain on an internal console.
 */
export function TenantConsole() {
  const utils = api.useUtils();
  const tenants = api.admin.tenants.list.useQuery(undefined, FRESH);

  const [name, setName] = useState("");
  const [defaultLanguage, setDefaultLanguage] = useState<Language>("JA");
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  const create = api.admin.tenants.create.useMutation({
    onSuccess: async () => {
      setName("");
      setDefaultLanguage("JA");
      setRegistered(true);
      await utils.admin.tenants.list.invalidate();
    },
    onError: () => setError(admin.signIn.unexpectedError),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRegistered(false);

    if (name.trim().length === 0) {
      setError(admin.tenants.nameRequired);
      return;
    }

    create.mutate({ name, defaultLanguage });
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold tracking-tight">{admin.tenants.registerHeading}</h2>

        {/* POST for the same reason as the sign-in form: an un-hydrated native
            submission must not put field values in the query string. */}
        <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4 sm:max-w-md">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-content-muted">{admin.tenants.nameLabel}</span>
            <input
              type="text"
              name="name"
              value={name}
              placeholder={admin.tenants.namePlaceholder}
              onChange={(event) => setName(event.target.value)}
              className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-content-muted">{admin.tenants.defaultLanguageLabel}</span>
            <select
              name="defaultLanguage"
              value={defaultLanguage}
              onChange={(event) => setDefaultLanguage(event.target.value as Language)}
              className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
            >
              <option value="JA">{admin.language.JA}</option>
              <option value="EN">{admin.language.EN}</option>
            </select>
          </label>

          {error ? (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          ) : null}
          {registered ? (
            <p role="status" className="text-sm text-content-muted">
              {admin.tenants.registered}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={create.isPending}
            className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
          >
            {admin.tenants.submit}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold tracking-tight">{admin.tenants.heading}</h2>

        {tenants.isPending ? null : tenants.data && tenants.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-content-muted">
                <tr className="border-b border-border-subtle">
                  <th className="py-2 pr-4 font-medium">{admin.tenants.columnName}</th>
                  <th className="py-2 pr-4 font-medium">{admin.tenants.columnId}</th>
                  <th className="py-2 pr-4 font-medium">{admin.tenants.columnLanguage}</th>
                  <th className="py-2 pr-4 font-medium">{admin.tenants.columnUsers}</th>
                  <th className="py-2 pr-4 font-medium">{admin.tenants.columnChats}</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {tenants.data.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-border-subtle last:border-0">
                    <td className="py-2 pr-4">{tenant.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-content-muted">{tenant.id}</td>
                    <td className="py-2 pr-4">{admin.language[tenant.defaultLanguage]}</td>
                    <td className="py-2 pr-4 tabular-nums">{tenant.userCount}</td>
                    <td className="py-2 pr-4 tabular-nums">{tenant.conversationCount}</td>
                    <td className="py-2">
                      <Link
                        href={`/admin/tenants/${tenant.id}`}
                        className="text-xs text-content-muted underline-offset-4 hover:text-content hover:underline"
                      >
                        {admin.tenants.detail}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-content-muted">{admin.tenants.empty}</p>
        )}
      </section>
    </div>
  );
}
