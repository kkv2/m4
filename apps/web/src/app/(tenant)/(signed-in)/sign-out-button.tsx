"use client";

import { useRouter } from "next/navigation";

import { useMessages } from "~/i18n/language-provider";
import { api } from "~/lib/trpc-client";

export function SignOutButton() {
  const router = useRouter();
  const messages = useMessages();
  const signOut = api.auth.signOut.useMutation({
    onSettled: () => {
      router.replace("/sign-in");
      router.refresh();
    },
  });

  return (
    <button
      type="button"
      onClick={() => signOut.mutate()}
      disabled={signOut.isPending}
      className="text-sm text-content-muted underline-offset-4 hover:text-content hover:underline disabled:opacity-50"
    >
      {messages.common.signOut}
    </button>
  );
}
