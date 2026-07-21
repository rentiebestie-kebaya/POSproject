import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getAppSession } from "@/lib/session";

// Returns the signed-in identity as derived server-side from the validated
// session. The client store reads this to learn who is signed in (the session
// itself lives in an HTTP-only cookie the client can't read), so it doubles as
// the proof that `tenant_id` + `role` are resolved server-side.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAppSession();
  if (!session) {
    return Response.json({ authenticated: false }, { status: 401 });
  }

  // Resolve the workspace name from the tenant scoped to this session (server-side).
  const { env } = await getCloudflareContext({ async: true });
  const tenant = await env.DB.prepare(`SELECT name FROM tenants WHERE id = ?`)
    .bind(session.tenantId)
    .first<{ name: string }>();

  return Response.json({
    authenticated: true,
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      tenantId: session.tenantId,
      tenantName: tenant?.name ?? null,
      role: session.role,
    },
  });
}
