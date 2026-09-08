"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * The dialog every registration and edit form is shown in.
 *
 * A modal rather than a section on the page because these forms are about *one*
 * subject at a time. The console's tenant screen used to stack a registration
 * form, a one-time password notice and a list of existing users on top of each
 * other, and with more than one user on screen it stopped being obvious which
 * of them the password belonged to. A dialog names its subject in the title and
 * puts everything about it in one place.
 *
 * Three ways out, because a dialog that traps you is worse than no dialog: the
 * close control, Escape, and a click on the scrim.
 */
export function Modal({
  title,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  /** The accessible name of the close control — the surface's own language. */
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    // The page behind must not scroll away underneath the dialog.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  // Move focus into the dialog on open, so the keyboard is already here.
  useEffect(() => panel.current?.focus(), []);

  return (
    <div
      // `onMouseDown` rather than `onClick`: a click whose press began inside
      // the panel — selecting text and releasing outside it — is not a click on
      // the scrim, and must not close anything.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-scrim p-4 sm:p-8"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="my-auto flex w-full max-w-lg flex-col gap-5 rounded-lg border border-border-subtle bg-surface p-6 shadow-xl outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-base font-semibold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="-m-1 rounded-md p-1 text-content-muted hover:text-content"
          >
            <XMarkIcon className="size-5" aria-hidden="true" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
