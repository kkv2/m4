import { TenantDetail } from "./tenant-detail";

/**
 * One tenant: its summary, its users, and the forms that register and reissue.
 *
 * The layout above has already established that a signed-in operator is here.
 * `params` is a promise in this version of Next.js.
 */
export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;

  return <TenantDetail tenantId={tenantId} />;
}
