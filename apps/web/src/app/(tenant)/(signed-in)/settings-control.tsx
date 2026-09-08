"use client";

import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

import { Modal } from "~/components/modal";
import { useMessages } from "~/i18n/language-provider";

import { SettingsForm } from "./settings-form";

/**
 * The two ways into settings (FR-036): a visible control, and a keyboard
 * shortcut. Both open a dialog rather than navigating.
 *
 * Settings used to be a screen of its own, which left no way back to the
 * application except the browser's Back button — the shell it was rendered in
 * offered none. A dialog has the way out built in, which is why Slack and
 * ChatGPT both put settings in one, and it costs the `/settings` URL that
 * nothing else linked to.
 *
 * The shortcut is ⌘ + , on macOS and Ctrl + , elsewhere — the platform
 * convention in both cases. It is deliberately not configurable; the spec's
 * Open Questions leave that for later, and the visible control is always there
 * for anyone whose browser or OS has already claimed the combination.
 */
export function SettingsControl() {
  const messages = useMessages();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "," || !(event.metaKey || event.ctrlKey)) return;
      // Do not steal the key from a field the user is typing in.
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;

      event.preventDefault();
      setOpen(true);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={messages.settings.shortcutHint}
        className="flex items-center gap-1.5 text-sm text-content-muted underline-offset-4 hover:text-content hover:underline"
      >
        <Cog6ToothIcon className="size-5" aria-hidden="true" />
        {messages.app.settings}
      </button>

      {open ? (
        <Modal
          title={messages.settings.title}
          closeLabel={messages.common.close}
          onClose={() => setOpen(false)}
        >
          <SettingsForm />
        </Modal>
      ) : null}
    </>
  );
}
