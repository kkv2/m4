import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Mark } from "~/components/mark";
import { languageFromTag, languageTag } from "~/i18n";
import { SIGN_IN_LANGUAGE_COOKIE } from "~/server/auth/cookies";
import { currentUser } from "~/server/auth/current";

import { SignInForm } from "./sign-in-form";

/**
 * Tenant sign-in — the only screen a tenant user sees before we know who they
 * are, and therefore the only one whose language cannot come from an account.
 *
 * FR-043a: it opens in Japanese and offers a switch to English. FR-043b: the
 * choice is remembered on that device. FR-043d: once signed in, the account
 * language supersedes it — which the shell layout does simply by reading the
 * account rather than this cookie.
 */
export default async function SignInPage() {
  const user = await currentUser();
  if (user) {
    redirect(user.firstLoginCompletedAt === null ? "/welcome" : "/");
  }

  const preference = (await cookies()).get(SIGN_IN_LANGUAGE_COOKIE)?.value;
  const language = languageFromTag(preference);

  return (
    <div
      lang={languageTag(language)}
      className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6"
    >
      <div className="flex flex-col items-center gap-3">
        <Mark size={48} />
      </div>
      <SignInForm initialLanguage={language} />
    </div>
  );
}
