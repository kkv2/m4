import { UserCircleIcon } from "@heroicons/react/24/outline";

/**
 * Who the viewer is signed in as: FR-009 for operators, FR-044a for tenant
 * users.
 *
 * Takes props rather than fetching. Every screen that renders it already has
 * the account in hand, and a component that fetched would make each of them
 * wait on a request they have already made.
 *
 * The icon is decorative — `aria-hidden`, as Heroicons ships them. The address
 * beside it is what says whose account this is, and an icon that repeated
 * "account" would only make a screen reader say it twice.
 */
export function AccountBadge({
  displayName,
  email,
  className,
}: {
  /** Omitted for operators, who have an address and no display name. */
  displayName?: string;
  email: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`.trim()}>
      <UserCircleIcon className="size-7 shrink-0 text-content-muted" />
      <div>
        {displayName ? (
          <>
            <span className="block text-sm font-medium text-content">{displayName}</span>
            <span className="block text-xs text-content-muted">{email}</span>
          </>
        ) : (
          <span className="block text-sm font-medium text-content">{email}</span>
        )}
      </div>
    </div>
  );
}
