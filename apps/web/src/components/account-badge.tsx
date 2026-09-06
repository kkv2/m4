/**
 * Who the viewer is signed in as (FR-009 for operators, FR-041 for tenant
 * users). Takes props rather than fetching: both layouts already have the
 * account in hand, and a component that fetches would make every screen wait
 * on it.
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
    <div className={className}>
      {displayName ? (
        <>
          <span className="block text-sm font-medium text-content">{displayName}</span>
          <span className="block text-xs text-content-muted">{email}</span>
        </>
      ) : (
        <span className="block text-sm font-medium text-content">{email}</span>
      )}
    </div>
  );
}
