import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAuth } from "@/lib/auth-server";
import { getAppSession } from "@/lib/session";
import { handleStaffPasswordRequest } from "@/lib/tenant-data";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestHeaders = await headers();
  const session = await getAppSession();
  const auth = await getAuth();
  const { env } = await getCloudflareContext({ async: true });
  return handleStaffPasswordRequest(request, session, auth, requestHeaders, env.DB);
}
