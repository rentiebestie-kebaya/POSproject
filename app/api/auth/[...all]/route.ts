import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth-server";

// The auth instance is built per request (the D1 binding only exists per
// request on Workers — see src/lib/auth.ts), so the better-auth Next handler is
// resolved inside each method rather than at module load.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await getAuth();
  return toNextJsHandler(auth).GET(request);
}

export async function POST(request: Request) {
  const auth = await getAuth();
  return toNextJsHandler(auth).POST(request);
}
