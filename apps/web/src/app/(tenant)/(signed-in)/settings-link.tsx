"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useMessages } from "~/i18n/language-provider";

/**
 * The two ways into settings (FR-036): a visible control, and a keyboard
 * shortcut.
 *
 * The shortcut is ⌘ + , on macOS and Ctrl + , elsewhere — the platform
 * convention in both cases. It is deliberately not configurable; the spec's
 * Open Questions leave that for later, and the visible control is always there
 * for anyone whose browser or OS has already claimed the combination.
 */
export function SettingsLink() {
  const router = useRouter();
  const messages = useMessages();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "," || !(event.metaKey || event.ctrlKey)) return;
      // Do not steal the key from a field the user is typing in.
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;

      event.preventDefault();
      router.push("/settings");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <Link
      href="/settings"
      title={messages.settings.shortcutHint}
      className="text-sm text-content-muted underline-offset-4 hover:text-content hover:underline"
    >
      {messages.app.settings}
    </Link>
  );
}
