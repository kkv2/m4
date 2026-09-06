"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { admin } from "~/i18n/messages/admin";
import { api } from "~/lib/trpc-client";

/**
 * Sign-in goes over HTTP rather than through a Server Action, because the
 * session cookie is set by the procedure's response (`ctx.resHeaders`). A
 * server-side caller has no HTTP response to attach it to.
 */
export function OperatorSignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const signIn = api.operatorAuth.signIn.useMutation({
    onSuccess: () => {
      router.replace("/admin");
      router.refresh();
    },
    onError: (mutationError) => {
      // Throttling is distinguishable from bad credentials on purpose: the
      // counter behaves identically for an address with no account, so saying
      // "too many attempts" reveals nothing about whether one exists (FR-022e).
      if (mutationError.data?.code === "TOO_MANY_REQUESTS") {
        setError(admin.signIn.throttled);
      } else if (mutationError.data?.code === "UNAUTHORIZED") {
        setError(admin.signIn.failed);
      } else {
        setError(admin.signIn.unexpectedError);
      }
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    signIn.mutate({ email, password });
  }

  return (
    // `method="post"` matters even though the handler always calls
    // preventDefault: if JavaScript has not hydrated yet, or fails, the browser
    // performs a native submission. A GET would put the password in the query
    // string, the browser history, the server log and the Referer header.
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-content-muted">{admin.signIn.emailLabel}</span>
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
        <span className="text-sm text-content-muted">{admin.signIn.passwordLabel}</span>
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
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={signIn.isPending}
        className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-surface disabled:opacity-50"
      >
        {admin.signIn.submit}
      </button>
    </form>
  );
}
