import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handlePublicStoreRequest } from "@/lib/tenant-data";

export const dynamic = "force-dynamic";

/**
 * Public, unauthenticated read of a shop's booking page. Returns only the
 * public projection (contact card, pieces, anonymous busy ranges) — never
 * customers, transactions, or revenue.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { env } = await getCloudflareContext({ async: true });
  return handlePublicStoreRequest(slug, env.DB);
}
