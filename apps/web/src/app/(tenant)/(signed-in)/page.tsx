import { getMessages } from "~/i18n";
import { currentUser } from "~/server/auth/current";

/**
 * The application root.
 *
 * Until issue #23 lands there is no chat here, so this says so rather than
 * showing an empty screen that looks broken. The layout above has already
 * established that a signed-in user with a completed first login is here.
 */
export default async function AppHomePage() {
  const user = await currentUser();
  const messages = getMessages(user?.language ?? "JA");

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">
        {messages.app.welcome}, {user?.name}
      </h1>
      <p className="text-sm text-content-muted">{messages.app.nothingHereYet}</p>
    </div>
  );
}
