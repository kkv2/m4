"use client";

import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";

import { admin } from "~/i18n/messages/admin";
import { api } from "~/lib/trpc-client";

export function SignOutButton() {
  const router = useRouter();
  const signOut = api.operatorAuth.signOut.useMutation({
    onSettled: () => {
      // The session is gone either way; let the layout gate send us onwards.
      router.replace("/admin/sign-in");
      router.refresh();
    },
  });

  return (
    <button
      type="button"
      onClick={() => signOut.mutate()}
      disabled={signOut.isPending}
      className="flex items-center gap-1.5 text-sm text-content-muted underline-offset-4 hover:text-content hover:underline disabled:opacity-50"
    >
      <ArrowRightStartOnRectangleIcon className="size-5" aria-hidden="true" />
      {admin.nav.signOut}
    </button>
  );
}
