import { redirect } from "next/navigation";

import { Mark } from "~/components/mark";
import { admin } from "~/i18n/messages/admin";
import { currentOperator } from "~/server/auth/current";

import { OperatorSignInForm } from "./sign-in-form";

/**
 * Operator sign-in. Japanese only, with no language control (FR-006) — unlike
 * the tenant sign-in screen, which has to offer both because no account
 * language is known there yet.
 */
export default async function OperatorSignInPage() {
  if (await currentOperator()) {
    redirect("/admin");
  }

  return (
    <div lang="ja" className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-3">
        <Mark size={48} />
        <h1 className="text-lg font-semibold tracking-tight">{admin.signIn.title}</h1>
      </div>
      <OperatorSignInForm />
    </div>
  );
}
