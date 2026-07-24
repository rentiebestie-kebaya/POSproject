import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handlePublicBookingRequest } from "@/lib/tenant-data";

export const dynamic = "force-dynamic";

/**
 * The one UNAUTHENTICATED write endpoint in the app — the Pro public booking
 * page posts here. There is deliberately no session: the service re-validates
 * the tenant slug, its plan and status, and the item, and applies flood guards.
 */
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  return handlePublicBookingRequest(request, env.DB);
}
