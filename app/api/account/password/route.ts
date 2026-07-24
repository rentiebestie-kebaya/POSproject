import { headers } from "next/headers";
import { getAuth } from "@/lib/auth-server";
import { getAppSession } from "@/lib/session";
import { handleAccountPasswordRequest } from "@/lib/tenant-data";

export const dynamic = "force-dynamic";

/** Self-service: change your OWN password (requires the current one). */
export async function POST(request: Request) {
  const requestHeaders = await headers();
  const session = await getAppSession();
  const auth = await getAuth();
  return handleAccountPasswordRequest(request, session, auth, requestHeaders);
}
