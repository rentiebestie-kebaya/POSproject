import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAppSession } from "@/lib/session";
import { handleBookingRequestRejection } from "@/lib/tenant-data";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getAppSession();
  const { env } = await getCloudflareContext({ async: true });
  return handleBookingRequestRejection(request, session, env.DB);
}
