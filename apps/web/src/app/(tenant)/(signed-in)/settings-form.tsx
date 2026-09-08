"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { format, type Language } from "~/i18n";
import { useMessages } from "~/i18n/language-provider";
import { MINIMUM_PASSWORD_LENGTH } from "~/lib/password-rules";
import { api } from "~/lib/trpc-client";

/**
 * The settings screen (FR-036 to FR-041), shown in the dialog above.
 *
 * Every procedure it calls works from the session, so there is nothing here
 * that could name another user even by mistake.
 */
export function SettingsForm() {
  const router = useRouter();
  const utils = api.useUtils();
  const messages = useMessages();
  const account = api.account.get.useQuery();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function messageForRule(rule: string): string {
    switch (rule) {
      case "too-short":
        return format(messages.password.tooShort, { minimumLength: MINIMUM_PASSWORD_LENGTH });
      case "too-common":
        return messages.password.tooCommon;
      case "matches-email":
        return messages.password.matchesEmail;
      case "matches-display-name":
        return messages.password.matchesDisplayName;
      case "current-incorrect":
        return messages.password.currentIncorrect;
      case "same-as-current":
        return messages.password.sameAsCurrent;
      default:
        return messages.common.unexpectedError;
    }
  }

  const updateDisplayName = api.account.updateDisplayName.useMutation({
    onSuccess: async () => {
      setProfileSaved(true);
      await utils.account.get.invalidate();
      // The shell renders the display name, so it has to re-read the account.
      router.refresh();
    },
    onError: () => setProfileError(messages.common.unexpectedError),
  });

  const updateLanguage = api.account.updateLanguage.useMutation({
    onSuccess: async () => {
      // The field showed the cached account rather than the choice just made,
      // so selecting a language moved everything except the control that
      // selected it. Invalidating is what puts the cache back in step; the
      // local state above is what makes the field respond immediately.
      await utils.account.get.invalidate();
      // FR-040: the change takes effect immediately, which means re-rendering
      // the server components that chose the language in the first place.
      router.refresh();
    },
    onError: () => {
      // Fall back to whatever the account still says, rather than leaving the
      // field claiming a language the server never accepted.
      setLanguage(null);
      setProfileError(messages.common.unexpectedError);
    },
  });

  const changePassword = api.account.changePassword.useMutation({
    onSuccess: () => {
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => setPasswordError(messageForRule(error.message)),
  });

  function onSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileSaved(false);

    const name = displayName ?? account.data?.displayName ?? "";
    if (name.trim().length === 0) return;

    updateDisplayName.mutate({ displayName: name });
  }

  function onChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSaved(false);

    // A password nobody can read back is one a typo locks you out of, so it is
    // typed twice and the two have to agree before anything is sent.
    if (newPassword !== confirmPassword) {
      setPasswordError(messages.password.mismatch);
      return;
    }

    changePassword.mutate({ currentPassword, newPassword });
  }

  if (!account.data) return null;

  const name = displayName ?? account.data.displayName;
  const chosenLanguage = language ?? account.data.language;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        {/* FR-037: read-only values, rendered as text rather than disabled
            inputs — a disabled input still looks like something you could have
            edited if only you were allowed to. */}
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-content-muted">{messages.settings.userIdLabel}</dt>
            <dd className="font-mono text-xs">{account.data.id}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-content-muted">{messages.settings.emailLabel}</dt>
            <dd>{account.data.email}</dd>
          </div>
        </dl>
        <p className="text-xs text-content-muted">{messages.settings.readOnlyNote}</p>
      </section>

      <section className="flex flex-col gap-4">
        <form method="post" onSubmit={onSaveProfile} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="required-field text-sm text-content-muted">
              {messages.settings.displayNameLabel}
            </span>
            <input
              type="text"
              name="displayName"
              required
              value={name}
              onChange={(event) => setDisplayName(event.target.value)}
              className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="required-field text-sm text-content-muted">
              {messages.settings.languageLabel}
            </span>
            <select
              name="language"
              required
              value={chosenLanguage}
              onChange={(event) => {
                const next = event.target.value as Language;
                setProfileError(null);
                setLanguage(next);
                updateLanguage.mutate({ language: next });
              }}
              className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
            >
              <option value="JA">{messages.language.ja}</option>
              <option value="EN">{messages.language.en}</option>
            </select>
          </label>

          <p className="text-xs text-content-muted">{messages.common.requiredLegend}</p>

          {profileError ? (
            <p role="alert" className="text-sm text-danger">
              {profileError}
            </p>
          ) : null}
          {profileSaved ? (
            <p role="status" className="text-sm text-content-muted">
              {messages.settings.saved}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={updateDisplayName.isPending}
            className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
          >
            {messages.common.save}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <form method="post" onSubmit={onChangePassword} className="flex flex-col gap-4">
          <input
            type="text"
            name="username"
            autoComplete="username"
            hidden
            readOnly
            value={account.data.email}
          />

          <label className="flex flex-col gap-1">
            <span className="required-field text-sm text-content-muted">
              {messages.settings.currentPasswordLabel}
            </span>
            <input
              type="password"
              name="currentPassword"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="required-field text-sm text-content-muted">
              {messages.settings.newPasswordLabel}
            </span>
            <input
              type="password"
              name="newPassword"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="required-field text-sm text-content-muted">
              {messages.password.confirmLabel}
            </span>
            <input
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              aria-invalid={mismatch}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={`rounded-md border bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent ${
                mismatch ? "border-danger" : "border-border-subtle"
              }`}
            />
          </label>

          <p className="text-xs text-content-muted">{messages.common.requiredLegend}</p>

          {/* Told as it is typed, not held back until submit: the point of the
              second field is to catch the typo before it costs anything. */}
          {mismatch ? (
            <p role="alert" className="text-sm text-danger">
              {messages.password.mismatch}
            </p>
          ) : null}
          {passwordError && !mismatch ? (
            <p role="alert" className="text-sm text-danger">
              {passwordError}
            </p>
          ) : null}
          {passwordSaved ? (
            <p role="status" className="text-sm text-content-muted">
              {messages.settings.saved}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={changePassword.isPending || mismatch}
            className="self-start rounded-md bg-accent px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
          >
            {messages.settings.changePassword}
          </button>
        </form>
      </section>
    </div>
  );
}
