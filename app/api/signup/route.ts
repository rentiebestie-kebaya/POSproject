import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAuth } from "@/lib/auth-server";
import { handleSignupRequest } from "@/lib/signup";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.DB) return Response.json({ error: "D1 binding DB is not configured." }, { status: 503 });
  return handleSignupRequest(request, await getAuth(), env.DB);
}

