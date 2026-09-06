import { SettingsForm } from "./settings-form";

/**
 * The settings screen. Reached from the control in the shell header, or with
 * the keyboard shortcut that shell also installs (FR-036).
 *
 * The layout above has already established that a signed-in user with a
 * completed first login is here.
 */
export default function SettingsPage() {
  return <SettingsForm />;
}
