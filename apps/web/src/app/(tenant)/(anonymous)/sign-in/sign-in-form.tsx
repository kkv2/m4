"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { getMessages, languageTag, type Language } from "~/i18n";
import {
  SIGN_IN_LANGUAGE_COOKIE,
  SIGN_IN_LANGUAGE_MAX_AGE_SECONDS,
} from "~/lib/sign-in-language-cookie";
import { api } from "~/lib/trpc-client";

/**
 * Sign-in goes over HTTP rather than through a Server Action, because the
 * session cookie is set from the procedure's response headers.
 *
 * The language toggle writes a cookie rather than component state so the choice
 * survives a reload and a later visit (FR-043b). It is not `httpOnly` — it is a
 * display preference, never a credential, and this component is what sets it.
 */
export function SignInForm({ initialLanguage }: { initialLanguage: Language }) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>(initialLanguage);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const messages = getMessages(language);

  const signIn = api.auth.signIn.useMutation({
    onSuccess: ({ next }) => {
      router.replace(next === "app" ? "/" : "/welcome");
      router.refresh();
    },
    onError: (mutationError) => {
      // Throttling is distinguishable from bad credentials on purpose: the
      // counter behaves identically for an address with no account, so saying
      // "too many attempts" reveals nothing about whether one exists (FR-022e).
      if (mutationError.data?.code === "TOO_MANY_REQUESTS") {
        setError(messages.signIn.throttled);
      } else if (mutationError.data?.code === "UNAUTHORIZED") {
        setError(messages.signIn.failed);
      } else {
        setError(messages.common.unexpectedError);
      }
    },
  });

  function switchLanguage() {
    const next: Language = language === "JA" ? "EN" : "JA";
    setLanguage(next);
    setError(null);
    // One year, root path — see cookies.ts for why this one is readable here.
    document.cookie = `${SIGN_IN_LANGUAGE_COOKIE}=${languageTag(next)}; Path=/; Max-Age=${SIGN_IN_LANGUAGE_MAX_AGE_SECONDS}; SameSite=Lax`;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    signIn.mutate({ email, password });
  }

  return (
    <div lang={languageTag(language)} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">{messages.signIn.title}</h1>
        <button
          type="button"
          onClick={switchLanguage}
          className="text-sm text-content-muted underline-offset-4 hover:text-content hover:underline"
        >
          {messages.signIn.switchLanguage}
        </button>
      </div>

      {/* POST: with JavaScript not yet hydrated a native submission would
          otherwise be a GET, putting the password in the query string. */}
      <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-content-muted">{messages.signIn.emailLabel}</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-content-muted">{messages.signIn.passwordLabel}</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-content outline-none focus:border-accent"
          />
        </label>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={signIn.isPending}
          className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
        >
          {messages.signIn.submit}
        </button>
      </form>
    </div>
  );
}
