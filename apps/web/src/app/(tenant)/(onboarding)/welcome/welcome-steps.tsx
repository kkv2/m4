"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { format, getMessages, languageTag, type Language } from "~/i18n";
import { MINIMUM_PASSWORD_LENGTH } from "~/lib/password-rules";
import { api } from "~/lib/trpc-client";

/**
 * The two first-login steps, in order, resumable (FR-027 to FR-033).
 *
 * Which step to show comes from the server — `next`, computed in one place in
 * `auth.ts` — rather than from anything this component infers. A user who
 * abandons halfway and signs in again lands here on the step they still owe.
 */
export function WelcomeSteps({
  step,
  operatorLanguage,
  displayName,
}: {
  step: "language" | "password";
  operatorLanguage: Language;
  displayName: string;
}) {
  const router = useRouter();

  // Once the language step is confirmed the copy switches immediately, so the
  // password step is shown in the language just chosen (US4 scenario 3).
  const [language, setLanguage] = useState<Language>(operatorLanguage);
  const [currentStep, setCurrentStep] = useState(step);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const messages = getMessages(language);

  const confirmLanguage = api.onboarding.confirmLanguage.useMutation({
    onSuccess: () => setCurrentStep("password"),
    onError: () => setError(messages.common.unexpectedError),
  });

  const replacePassword = api.onboarding.replacePassword.useMutation({
    onSuccess: () => {
      router.replace("/");
      router.refresh();
    },
    onError: (mutationError) => {
      // The procedure sends back which rule failed, so the message can name it
      // rather than saying "invalid password" (FR-032b).
      setError(messageForRule(mutationError.message));
    },
  });

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
      case "same-as-issued":
        return messages.password.sameAsIssued;
      default:
        return messages.common.unexpectedError;
    }
  }

  function onConfirmLanguage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    confirmLanguage.mutate({ language });
  }

  function onReplacePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    replacePassword.mutate({ newPassword });
  }

  return (
    <div
      lang={languageTag(language)}
      className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6"
    >
      {currentStep === "language" ? (
        <form method="post" onSubmit={onConfirmLanguage} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold tracking-tight">
              {messages.firstLogin.languageTitle}
            </h1>
            <p className="text-sm text-content-muted">{messages.firstLogin.languageDescription}</p>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-content-muted">{messages.settings.languageLabel}</span>
            <select
              name="language"
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
              className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
            >
              <option value="JA">{messages.language.ja}</option>
              <option value="EN">{messages.language.en}</option>
            </select>
          </label>

          {error ? (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={confirmLanguage.isPending}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
          >
            {messages.firstLogin.languageSubmit}
          </button>
        </form>
      ) : (
        <form method="post" onSubmit={onReplacePassword} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold tracking-tight">
              {messages.firstLogin.passwordTitle}
            </h1>
            <p className="text-sm text-content-muted">{messages.firstLogin.passwordDescription}</p>
          </div>

          {/* A hidden username field so password managers file the new password
              against the right account. */}
          <input
            type="text"
            name="username"
            autoComplete="username"
            hidden
            readOnly
            value={displayName}
          />

          <label className="flex flex-col gap-1">
            <span className="text-sm text-content-muted">
              {messages.firstLogin.newPasswordLabel}
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

          {error ? (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={replacePassword.isPending}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
          >
            {messages.firstLogin.passwordSubmit}
          </button>
        </form>
      )}
    </div>
  );
}
