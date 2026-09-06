"use client";

import { useState } from "react";

import { admin } from "~/i18n/messages/admin";

/**
 * The one place a generated password is ever shown (FR-003).
 *
 * It lives only in this component's props — never in a query cache, never
 * refetched, and gone the moment the operator dismisses it. If they lose it,
 * the recovery is a reissue, not a second look.
 */
export function CredentialNotice({
  email,
  password,
  onDismiss,
}: {
  email: string;
  password: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
  }

  return (
    <section
      role="alert"
      aria-label={admin.credential.heading}
      className="flex flex-col gap-3 rounded-md border border-accent bg-surface-raised p-4"
    >
      <h3 className="text-sm font-semibold">{admin.credential.heading}</h3>
      <p className="text-sm text-content-muted">{admin.credential.onceOnly}</p>

      <dl className="flex flex-col gap-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-32 text-content-muted">{admin.credential.emailLabel}</dt>
          <dd className="font-mono">{email}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 text-content-muted">{admin.credential.passwordLabel}</dt>
          <dd className="font-mono select-all">{password}</dd>
        </div>
      </dl>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-sm text-content"
        >
          {copied ? admin.credential.copied : admin.credential.copy}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-surface"
        >
          {admin.credential.dismiss}
        </button>
      </div>
    </section>
  );
}
