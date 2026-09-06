"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import type { Language } from "~/i18n";
import { admin } from "~/i18n/messages/admin";
import { api } from "~/lib/trpc-client";

import { CredentialNotice } from "./credential-notice";

/**
 * One tenant: its summary, its users, and the two ways a credential is issued —
 * registering a user, and reissuing a lost password.
 */
export function TenantDetail({ tenantId }: { tenantId: string }) {
  const utils = api.useUtils();
  const tenant = api.admin.tenants.get.useQuery({ tenantId });
  const users = api.admin.users.listByTenant.useQuery({ tenantId });

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<Language | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * The generated password, held in component state and nowhere else. It is
   * never written to the query cache, so no refetch can bring it back.
   */
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  // FR-016: the language field defaults to the tenant's default at the moment
  // the form is opened. The tenant loads asynchronously, so the default is
  // applied once it arrives and not thereafter — an operator who has already
  // chosen must not have their choice overwritten by a background refetch.
  useEffect(() => {
    if (language === null && tenant.data) setLanguage(tenant.data.defaultLanguage);
  }, [language, tenant.data]);

  const create = api.admin.users.create.useMutation({
    onSuccess: async ({ generatedPassword }, variables) => {
      setIssued({ email: variables.email, password: generatedPassword });
      setEmail("");
      setName("");
      setLanguage(tenant.data?.defaultLanguage ?? null);
      await Promise.all([
        utils.admin.users.listByTenant.invalidate({ tenantId }),
        utils.admin.tenants.get.invalidate({ tenantId }),
      ]);
    },
    onError: (mutationError) => {
      setError(
        mutationError.data?.code === "CONFLICT"
          ? admin.users.emailTaken
          : admin.signIn.unexpectedError,
      );
    },
  });

  const reissue = api.admin.users.reissuePassword.useMutation({
    onError: () => setError(admin.signIn.unexpectedError),
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (email.trim().length === 0) {
      setError(admin.users.emailRequired);
      return;
    }
    if (name.trim().length === 0) {
      setError(admin.users.nameRequired);
      return;
    }
    if (language === null) return;

    create.mutate({ tenantId, email, name, language });
  }

  function onReissue(userId: string, userEmail: string) {
    setError(null);
    reissue.mutate(
      { userId },
      {
        onSuccess: ({ generatedPassword }) =>
          setIssued({ email: userEmail, password: generatedPassword }),
      },
    );
  }

  if (tenant.isError) {
    return <p className="text-sm text-content-muted">{admin.tenants.notFound}</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin"
          className="text-sm text-content-muted underline-offset-4 hover:text-content hover:underline"
        >
          {admin.tenants.backToList}
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">{tenant.data?.name ?? ""}</h1>
        {tenant.data ? (
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-content-muted">
            <div className="flex gap-2">
              <dt>{admin.tenants.columnId}</dt>
              <dd className="font-mono text-xs">{tenant.data.id}</dd>
            </div>
            <div className="flex gap-2">
              <dt>{admin.tenants.columnLanguage}</dt>
              <dd>{admin.language[tenant.data.defaultLanguage]}</dd>
            </div>
            <div className="flex gap-2">
              <dt>{admin.tenants.columnUsers}</dt>
              <dd className="tabular-nums">{tenant.data.userCount}</dd>
            </div>
            <div className="flex gap-2">
              <dt>{admin.tenants.columnChats}</dt>
              <dd className="tabular-nums">{tenant.data.conversationCount}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      {issued ? (
        <CredentialNotice
          email={issued.email}
          password={issued.password}
          onDismiss={() => setIssued(null)}
        />
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold tracking-tight">{admin.users.registerHeading}</h2>

        {/* POST so that an un-hydrated native submission cannot put the field
            values in the query string. */}
        <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4 sm:max-w-md">
          <div className="flex flex-col gap-1">
            {/* The hint sits outside the label: inside it, it would become part
                of the field's accessible name. */}
            <label className="flex flex-col gap-1">
              <span className="text-sm text-content-muted">{admin.users.emailLabel}</span>
              <input
                type="email"
                name="email"
                value={email}
                placeholder={admin.users.emailPlaceholder}
                aria-describedby="email-immutable"
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
              />
            </label>
            <p id="email-immutable" className="text-xs text-content-muted">
              {admin.users.emailImmutable}
            </p>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-content-muted">{admin.users.nameLabel}</span>
            <input
              type="text"
              name="name"
              value={name}
              placeholder={admin.users.namePlaceholder}
              onChange={(event) => setName(event.target.value)}
              className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-content-muted">{admin.users.languageLabel}</span>
            <select
              name="language"
              value={language ?? ""}
              disabled={language === null}
              onChange={(event) => setLanguage(event.target.value as Language)}
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

          <button
            type="submit"
            disabled={create.isPending || language === null}
            className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
          >
            {admin.users.submit}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold tracking-tight">{admin.users.heading}</h2>

        {users.isPending ? null : users.data && users.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-content-muted">
                <tr className="border-b border-border-subtle">
                  <th className="py-2 pr-4 font-medium">{admin.users.columnName}</th>
                  <th className="py-2 pr-4 font-medium">{admin.users.columnEmail}</th>
                  <th className="py-2 pr-4 font-medium">{admin.users.columnId}</th>
                  <th className="py-2 pr-4 font-medium">{admin.users.columnLanguage}</th>
                  <th className="py-2 pr-4 font-medium">{admin.users.columnFirstLogin}</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {users.data.map((user) => (
                  <tr key={user.id} className="border-b border-border-subtle last:border-0">
                    <td className="py-2 pr-4">{user.name}</td>
                    {/* FR-018: shown as a value, never as an input. */}
                    <td className="py-2 pr-4">{user.email}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-content-muted">{user.id}</td>
                    <td className="py-2 pr-4">{admin.language[user.language]}</td>
                    <td className="py-2 pr-4">
                      {user.firstLoginCompletedAt
                        ? admin.users.firstLoginDone
                        : admin.users.firstLoginPending}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => onReissue(user.id, user.email)}
                        disabled={reissue.isPending}
                        title={admin.users.reissueConfirm}
                        className="text-xs text-content-muted underline-offset-4 hover:text-content hover:underline disabled:opacity-50"
                      >
                        {admin.users.reissue}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-content-muted">{admin.users.empty}</p>
        )}
      </section>
    </div>
  );
}
