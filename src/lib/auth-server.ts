import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAuth, type Auth } from "./auth";

/**
 * Resolves the auth instance for the current request on OpenNext/Workers.
 *
 * The D1 binding is only reachable per request via `getCloudflareContext()`, so
 * this must be called inside a request handler / server action — never at module
 * top level. The instance is memoized per binding: the binding object is stable
 * within a worker isolate, so this rebuilds only when the isolate is new.
 */
const authCache = new WeakMap<D1Database, Auth>();

export async function getAuth(): Promise<Auth> {
  const { env } = await getCloudflareContext({ async: true });
  const db = env.DB;
  if (!db) {
    throw new Error("D1 binding DB is not configured.");
  }
  let auth = authCache.get(db);
  if (!auth) {
    const secrets = env as unknown as { BETTER_AUTH_SECRET?: string; BETTER_AUTH_URL?: string };
    auth = createAuth(db, {
      secret: secrets.BETTER_AUTH_SECRET,
      baseURL: secrets.BETTER_AUTH_URL,
    });
    authCache.set(db, auth);
  }
  return auth;
}
