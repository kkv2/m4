import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AccountBadge } from "~/components/account-badge";
import { Mark } from "~/components/mark";
import { admin } from "~/i18n/messages/admin";
import { currentOperator } from "~/server/auth/current";

import { SignOutButton } from "./sign-out-button";

/**
 * The operator console shell and its gate (FR-007).
 *
 * The sign-in screen is a sibling route group rather than a child, because a
 * gate that redirects to a page it also guards is an infinite redirect. Route
 * groups do not appear in the URL, so both still resolve under /admin.
 *
 * This redirect is a convenience: every procedure the console calls is already
 * `operatorProcedure`, which refuses anyone else. A layout that forgot the
 * check would waste a render; a procedure that forgot one would be a breach.
 *
 * `lang="ja"` is set here rather than on <html> because the root layout is
 * shared with the tenant application, which renders in the signed-in user's
 * language. The console is Japanese regardless (FR-006).
 */
export default async function OperatorConsoleLayout({ children }: { children: ReactNode }) {
  const operator = await currentOperator();

  if (!operator) {
    redirect("/admin/sign-in");
  }

  return (
    <div lang="ja" className="min-h-dvh">
      <header className="flex items-center justify-between border-b border-border-subtle px-6 py-3">
        {/* The mark is the way home, as it is on every site — and it goes to the
            console's home, not the tenant application's. The two surfaces share
            a header shape and nothing else. */}
        <Link href="/admin" title={admin.common.home} className="flex items-center gap-3">
          <Mark size={28} />
          <span className="text-sm font-semibold tracking-tight">{admin.consoleName}</span>
        </Link>
        <div className="flex items-center gap-4">
          <AccountBadge email={operator.email} />
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
