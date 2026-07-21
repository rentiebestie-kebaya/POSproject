import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAuth } from "@/lib/auth-server";
import { getSessionScopedBootstrap } from "@/lib/tenant-data";

// Returns the signed-in tenant's entire dataset for the client store's
// bootstrap-and-cache load (ADR-0002). The tenant is derived server-side from
// the validated session inside the data seam — never from client input — so a
// request can only read its own tenant's data.
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuth();
  const { env } = await getCloudflareContext({ async: true });
  const bootstrap = await getSessionScopedBootstrap(auth, await headers(), env.DB);
  if (!bootstrap) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json(bootstrap);
}
