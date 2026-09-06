import { redirect } from "next/navigation";

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
    <WelcomeSteps
      step={user.languageConfirmedAt === null ? "language" : "password"}
      operatorLanguage={user.language}
      displayName={user.name}
    />
  );
}
