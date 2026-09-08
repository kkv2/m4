import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AccountBadge } from "~/components/account-badge";
import { Mark } from "~/components/mark";
import { getMessages, languageTag } from "~/i18n";
import { LanguageProvider } from "~/i18n/language-provider";
import { currentUser } from "~/server/auth/current";

import { SettingsControl } from "./settings-control";
import { SignOutButton } from "./sign-out-button";

/**
 * The tenant application shell and its two gates.
 *
 * Sign-in is a sibling route group, for the same reason as the operator
 * console: a gate that redirects to a page it also guards is an infinite
 * redirect. Route groups do not appear in the URL, so the application stays at
 * `/` and sign-in at `/sign-in`.
 *
 * The redirects here are a convenience. `protectedProcedure` already refuses a
 * caller whose first login is unfinished, so a user who reaches an application
 * screen by navigating directly gets nothing from it either way (FR-034).
 */
export default async function TenantLayout({ children }: { children: ReactNode }) {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }
  if (user.firstLoginCompletedAt === null) {
    redirect("/welcome");
  }

  const messages = getMessages(user.language);

  return (
    <LanguageProvider language={user.language}>
      <div lang={languageTag(user.language)} className="min-h-dvh">
        <header className="flex items-center justify-between border-b border-border-subtle px-6 py-3">
          {/* The mark is the way home. It names this surface too: the console an
              operator uses and the one a tenant user uses look alike, and the
              text beside the mark is what says which of the two you are in. */}
          <Link href="/" title={messages.app.home} className="flex items-center gap-3">
            <Mark size={28} />
            <span className="text-sm font-semibold tracking-tight">{messages.app.consoleName}</span>
          </Link>
          <div className="flex items-center gap-4">
            <AccountBadge displayName={user.name} email={user.email} />
            <SettingsControl />
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
      </div>
    </LanguageProvider>
  );
}
