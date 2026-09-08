"use client";

import { ArrowLeftIcon, PencilSquareIcon, PlusIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useState } from "react";

import { admin } from "~/i18n/messages/admin";
import { FRESH, api } from "~/lib/trpc-client";

import { TenantFormModal } from "../../tenant-form-modal";
import { UserFormModal, type UserSummary } from "./user-form-modal";

/**
 * One tenant: its summary, its users, and the dialogs that register, edit and
 * reissue.
 *
 * Nothing on this screen is a form. Registering a user, editing one and showing
 * the password that either of those produces all happen in a dialog about that
 * one user, so the screen itself is only ever a list of who is here.
 */
export function TenantDetail({ tenantId }: { tenantId: string }) {
  const tenant = api.admin.tenants.get.useQuery({ tenantId }, FRESH);
  const users = api.admin.users.listByTenant.useQuery({ tenantId }, FRESH);

  /** null when closed; `{ user: null }` registers, a row edits that row. */
  const [editingUser, setEditingUser] = useState<{ user: UserSummary | null } | null>(null);
  const [editingTenant, setEditingTenant] = useState(false);

  if (tenant.isError) {
    return <p className="text-sm text-content-muted">{admin.tenants.notFound}</p>;
  }

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin"
          className="flex items-center gap-1 self-start text-sm text-content-muted underline-offset-4 hover:text-content hover:underline"
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          {admin.tenants.backToList}
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight">{tenant.data?.name ?? ""}</h1>
          {tenant.data ? (
            <button
              type="button"
              onClick={() => setEditingTenant(true)}
              className="flex items-center gap-1.5 rounded-md border border-border-subtle px-3 py-1.5 text-sm text-content-muted hover:text-content"
            >
              <PencilSquareIcon className="size-4" aria-hidden="true" />
              {admin.common.edit}
            </button>
          ) : null}
        </div>

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

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold tracking-tight">{admin.users.heading}</h2>
          <button
            type="button"
            onClick={() => setEditingUser({ user: null })}
            // FR-016 needs the tenant's default language, so registration waits
            // for the tenant rather than opening on a guess.
            disabled={!tenant.data}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            {admin.users.registerHeading}
          </button>
        </div>

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
                  <th className="py-2 font-medium">{admin.users.columnActions}</th>
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
                        onClick={() => setEditingUser({ user })}
                        className="flex items-center gap-1 text-xs text-content-muted underline-offset-4 hover:text-content hover:underline"
                      >
                        <PencilSquareIcon className="size-4" aria-hidden="true" />
                        {admin.common.edit}
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

      {editingUser && tenant.data ? (
        <UserFormModal
          tenantId={tenantId}
          user={editingUser.user}
          defaultLanguage={tenant.data.defaultLanguage}
          onClose={() => setEditingUser(null)}
        />
      ) : null}

      {editingTenant && tenant.data ? (
        <TenantFormModal tenant={tenant.data} onClose={() => setEditingTenant(false)} />
      ) : null}
    </div>
  );
}
