"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import type { Auth } from "./auth";

/**
 * Browser-side better-auth client. Same-origin, so the base URL is inferred from
 * `window.location`. `inferAdditionalFields<Auth>()` carries the `tenant_id` /
 * `role` types through to `signIn`/`useSession`; `adminClient()` mirrors the
 * server admin plugin so type inference lines up (staff provisioning is ticket 09).
 */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>(), adminClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
