"use client";

import { KeyIcon } from "@heroicons/react/24/outline";
import { useState, type FormEvent } from "react";

import { Modal } from "~/components/modal";
import { ReadOnlyFacts } from "~/components/read-only-facts";
import type { Language } from "~/i18n";
import { admin } from "~/i18n/messages/admin";
import { api, type RouterOutputs } from "~/lib/trpc-client";

import { CredentialNotice } from "./credential-notice";

export type UserSummary = RouterOutputs["admin"]["users"]["listByTenant"][number];

/**
 * Registering a user, and editing one — and the one place a generated password
 * is ever shown.
 *
 * Putting the credential in here is the point of the dialog. It used to sit at
 * the top of the tenant screen, above a registration form and a list of every
 * other user, and with two or more users on screen it was no longer obvious
 * whose password it was. Here the address is right above it and nothing else is.
 */
export function UserFormModal({
  tenantId,
  user,
  defaultLanguage,
  onClose,
}: {
  tenantId: string;
  /** null registers a new user; a row edits that user. */
  user: UserSummary | null;
  /** FR-016: a new user starts on the tenant's default language. */
  defaultLanguage: Language;
  onClose: () => void;
}) {
  const utils = api.useUtils();

  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [language, setLanguage] = useState<Language>(user?.language ?? defaultLanguage);
  const [error, setError] = useState<string | null>(null);

  /**
   * The generated password, held in component state and nowhere else. It is
   * never written to the query cache, so no refetch can bring it back.
   */
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  async function republish() {
    await Promise.all([
      utils.admin.users.listByTenant.invalidate({ tenantId }),
      utils.admin.tenants.get.invalidate({ tenantId }),
      utils.admin.tenants.list.invalidate(),
    ]);
  }

  const create = api.admin.users.create.useMutation({
    onSuccess: async ({ generatedPassword }, variables) => {
      setIssued({ email: variables.email, password: generatedPassword });
      await republish();
    },
    onError: (mutationError) => {
      setError(
        mutationError.data?.code === "CONFLICT"
          ? admin.users.emailTaken
          : admin.signIn.unexpectedError,
      );
    },
  });

  const update = api.admin.users.update.useMutation({
    onSuccess: async () => {
      await republish();
      onClose();
    },
    onError: () => setError(admin.signIn.unexpectedError),
  });

  const reissue = api.admin.users.reissuePassword.useMutation({
    onSuccess: ({ generatedPassword }) =>
      setIssued({ email: user?.email ?? "", password: generatedPassword }),
    onError: () => setError(admin.signIn.unexpectedError),
  });

  const pending = create.isPending || update.isPending || reissue.isPending;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (user) {
      if (name.trim().length === 0) {
        setError(admin.users.nameRequired);
        return;
      }
      update.mutate({ userId: user.id, name, language });
      return;
    }

    if (email.trim().length === 0) {
      setError(admin.users.emailRequired);
      return;
    }
    if (name.trim().length === 0) {
      setError(admin.users.nameRequired);
      return;
    }

    create.mutate({ tenantId, email, name, language });
  }

  return (
    <Modal
      title={user ? admin.users.editHeading : admin.users.registerHeading}
      closeLabel={admin.common.close}
      onClose={onClose}
    >
      {user ? (
        // FR-018: the address is shown as a value, never as an input — and it is
        // shown at all so that editing the wrong of two similar users is a
        // mistake that can be caught before it is saved.
        <ReadOnlyFacts
          note={admin.users.emailImmutable}
          facts={[
            { label: admin.users.columnEmail, value: user.email },
            { label: admin.users.columnId, value: user.id, mono: true },
            {
              label: admin.users.firstLoginLabel,
              value: user.firstLoginCompletedAt
                ? admin.users.firstLoginDone
                : admin.users.firstLoginPending,
            },
          ]}
        />
      ) : null}

      {issued ? (
        <CredentialNotice
          // Keyed by the password, so a second reissue mounts a fresh notice
          // rather than reusing one whose copy control still says "copied".
          key={issued.password}
          email={issued.email}
          password={issued.password}
          onDismiss={() => (user ? setIssued(null) : onClose())}
        />
      ) : (
        /* POST so that an un-hydrated native submission cannot put the field
           values in the query string. `noValidate` because this form has its own
           refusals to give — `required` marks the fields for assistive
           technology, and the message stays ours. */
        <form method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
          {user ? null : (
            <div className="flex flex-col gap-1">
              {/* The hint sits outside the label: inside it, it would become
                  part of the field's accessible name. */}
              <label className="flex flex-col gap-1">
                <span className="required-field text-sm text-content-muted">
                  {admin.users.emailLabel}
                </span>
                <input
                  type="email"
                  name="email"
                  required
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
          )}

          <label className="flex flex-col gap-1">
            <span className="required-field text-sm text-content-muted">
              {admin.users.nameLabel}
            </span>
            <input
              type="text"
              name="name"
              required
              value={name}
              placeholder={admin.users.namePlaceholder}
              onChange={(event) => setName(event.target.value)}
              className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="required-field text-sm text-content-muted">
              {admin.users.languageLabel}
            </span>
            <select
              name="language"
              required
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
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

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
            >
              {user ? admin.common.save : admin.users.submit}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border-subtle px-3 py-2 text-sm text-content-muted hover:text-content"
            >
              {admin.common.cancel}
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  reissue.mutate({ userId: user.id });
                }}
                disabled={pending}
                title={admin.users.reissueConfirm}
                className="ml-auto flex items-center gap-1.5 text-sm text-content-muted underline-offset-4 hover:text-content hover:underline disabled:opacity-50"
              >
                <KeyIcon className="size-4" aria-hidden="true" />
                {admin.users.reissue}
              </button>
            ) : null}
          </div>
        </form>
      )}
    </Modal>
  );
}
