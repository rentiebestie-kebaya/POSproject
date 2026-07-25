import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAppSession } from "@/lib/session";
import { handleTenantProfileRequest } from "@/lib/tenant-data";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const session = await getAppSession();
  const { env } = await getCloudflareContext({ async: true });
  return handleTenantProfileRequest(request, session, env.DB);
}
