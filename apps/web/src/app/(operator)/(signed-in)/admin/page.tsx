import { TenantConsole } from "./tenant-console";

/**
 * The console's home: register a tenant, and see every tenant with its
 * identifier, user count and chat count (FR-010 to FR-013).
 *
 * The layout above has already established that a signed-in operator is here.
 */
export default function AdminHomePage() {
  return <TenantConsole />;
}
