import { redirect } from "next/navigation";

import { AccountBadge } from "~/components/account-badge";
import { Mark } from "~/components/mark";
import { currentUser } from "~/server/auth/current";

import { WelcomeSteps } from "./welcome-steps";

/**
 * First login: choose a language, then replace the issued password.
 *
 * A route group of its own, between anonymous and signed-in. It cannot sit
 * under the application layout, which redirects an unfinished user *here* — a
 * gate that redirects to a page it also guards is an infinite redirect.
 *
 * Which step to show is computed from the account, so a user who abandons
 * halfway resumes at the step they still owe (FR-033).
 *
 * The mark and the signed-in address are here too (FR-044, FR-044a). This
 * screen renders to a signed-in user, and it is the one place where seeing
 * whose account is being set up matters most: the credentials arrived by hand,
 * so "this is not my address" is a mistake worth catching before the password
 * is replaced.
 */
export default async function WelcomePage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in");
  }
  if (user.firstLoginCompletedAt !== null) {
    redirect("/");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-6 py-3">
        <Mark size={28} />
        <AccountBadge email={user.email} />
      </header>
      <div className="flex flex-1 flex-col justify-center">
        <WelcomeSteps
          step={user.languageConfirmedAt === null ? "language" : "password"}
          operatorLanguage={user.language}
          displayName={user.name}
        />
      </div>
    </div>
  );
}
