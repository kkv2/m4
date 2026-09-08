"use client";

import { PencilSquareIcon, PlusIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useState } from "react";

import { admin } from "~/i18n/messages/admin";
import { FRESH, api } from "~/lib/trpc-client";

import { TenantFormModal, type TenantSummary } from "./tenant-form-modal";

/**
 * Tenant registration and the tenant list (FR-010 to FR-013).
 *
 * A client component calling tRPC over HTTP, like every other screen in this
 * feature. The alternative — reading through `createCaller` in a Server
 * Component and mutating over HTTP — would give the same data two paths and two
 * caching stories for no gain on an internal console.
 *
 * Registration and editing both happen in a dialog, so the list stays the whole
 * screen and a form is only ever on screen for the one tenant it is about.
 */
export function TenantConsole() {
  const tenants = api.admin.tenants.list.useQuery(undefined, FRESH);

  /** null when closed; `{ tenant: null }` registers, a row edits that row. */
  const [editing, setEditing] = useState<{ tenant: TenantSummary | null } | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold tracking-tight">{admin.tenants.heading}</h2>
        <button
          type="button"
          onClick={() => setEditing({ tenant: null })}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-surface"
        >
          <PlusIcon className="size-4" aria-hidden="true" />
          {admin.tenants.registerHeading}
        </button>
      </div>

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
                <th className="py-2 font-medium">{admin.tenants.columnActions}</th>
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
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setEditing({ tenant })}
                        className="flex items-center gap-1 text-xs text-content-muted underline-offset-4 hover:text-content hover:underline"
                      >
                        <PencilSquareIcon className="size-4" aria-hidden="true" />
                        {admin.common.edit}
                      </button>
                      <Link
                        href={`/admin/tenants/${tenant.id}`}
                        className="text-xs text-content-muted underline-offset-4 hover:text-content hover:underline"
                      >
                        {admin.tenants.detail}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-content-muted">{admin.tenants.empty}</p>
      )}

      {editing ? (
        <TenantFormModal tenant={editing.tenant} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
