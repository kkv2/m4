import type { ReactNode } from "react";

/**
 * The values an edit form shows but cannot change.
 *
 * Every edit dialog opens on a subject that was chosen from a list, and the
 * list rows look alike — two users of the same tenant differ by an address the
 * form is forbidden to touch. Showing those values inside the dialog is what
 * makes "this is the wrong one" catchable before the save, so it is a fixture
 * of every edit form rather than a decision each one makes.
 *
 * Rendered as text, never as disabled inputs: a disabled input still looks like
 * something you would be allowed to edit if only you had permission.
 */
export function ReadOnlyFacts({
  facts,
  note,
}: {
  facts: { label: string; value: ReactNode; mono?: boolean }[];
  /** Says in words that these cannot be changed. */
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-raised px-3 py-2.5">
      <dl className="flex flex-col gap-1.5 text-sm">
        {facts.map((fact) => (
          <div key={fact.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
            <dt className="text-content-muted sm:w-40 sm:shrink-0">{fact.label}</dt>
            <dd className={fact.mono ? "font-mono text-xs break-all" : "break-words"}>
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
      {note ? <p className="text-xs text-content-muted">{note}</p> : null}
    </div>
  );
}
