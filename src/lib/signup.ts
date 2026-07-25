import type { Auth } from "./auth";

type SignupPlan = "free" | "starter" | "pro";

interface SignupFields {
  storeName: string;
  ownerName: string;
  email: string;
  password: string;
  location: string;
  whatsapp: string;
  plan: SignupPlan;
  bookingSlug: string;
}

interface CreatedTenant {
  id: string;
  name: string;
  subdomain: string;
}

class SignupError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "SignupError";
  }
}

const PLANS = new Set<SignupPlan>(["free", "starter", "pro"]);

function text(input: Record<string, unknown>, key: string): string {
  return typeof input[key] === "string" ? input[key].trim() : "";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.rentie\.id$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function parseSignupFields(input: unknown): SignupFields {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new SignupError(400, "Invalid signup payload.");
  }

  const row = input as Record<string, unknown>;
  const storeName = text(row, "storeName");
  const ownerName = text(row, "ownerName");
  const email = text(row, "email").toLowerCase();
  const password = typeof row.password === "string" ? row.password : "";
  const location = text(row, "location");
  const whatsapp = text(row, "whatsapp");
  const plan = text(row, "plan") as SignupPlan;
  const bookingSlug = slugify(text(row, "bookingSlug") || storeName);

  if (storeName.length < 2) throw new SignupError(400, "Store name is required.");
  if (ownerName.length < 2) throw new SignupError(400, "Owner name is required.");
  if (!email || !email.includes("@")) throw new SignupError(400, "Enter a valid email address.");
  if (password.length < 8) throw new SignupError(400, "Password must be at least 8 characters.");
  if (location.length < 2) throw new SignupError(400, "Store location is required.");
  if (whatsapp.length < 6) throw new SignupError(400, "WhatsApp number is required.");
  if (!PLANS.has(plan)) throw new SignupError(400, "Choose a valid plan.");
  if (bookingSlug.length < 2) throw new SignupError(400, "Store name cannot create a booking URL.");

  return {
    storeName,
    ownerName,
    email,
    password,
    location,
    whatsapp,
    plan,
    bookingSlug,
  };
}

async function tenantSlugAvailable(db: D1Database, slug: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 AS found FROM tenants WHERE id = ? OR subdomain = ? LIMIT 1`)
    .bind(slug, `${slug}.rentie.id`)
    .first<{ found: number }>();
  return !row;
}

async function createTenant(db: D1Database, fields: SignupFields): Promise<CreatedTenant> {
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const suffixText = suffix === 0 ? "" : `-${suffix + 1}`;
    const slug = `${fields.bookingSlug}${suffixText}`;
    if (!(await tenantSlugAvailable(db, slug))) continue;

    try {
      await db
        .prepare(
          `INSERT INTO tenants
             (id, name, subdomain, location, whatsapp, booking_deposit_amount,
              booking_deposit_policy, plan, billing_status, status,
              onboarding_status, limit_overrides_json)
           VALUES (?, ?, ?, ?, ?, 100000, 'non_refundable', ?, ?, 'active', 'incomplete', '{}')`,
        )
        .bind(
          slug,
          fields.storeName,
          `${slug}.rentie.id`,
          fields.location,
          fields.whatsapp,
          fields.plan,
          fields.plan === "free" ? "active" : "pending",
        )
        .run();

      return {
        id: slug,
        name: fields.storeName,
        subdomain: `${slug}.rentie.id`,
      };
    } catch (error) {
      // A concurrent signup may have claimed the slug after the availability
      // check. Retry only when the candidate is now occupied.
      if (await tenantSlugAvailable(db, slug)) throw error;
    }
  }

  throw new SignupError(409, "Could not reserve a unique booking URL.");
}

async function rollbackSignup(db: D1Database, tenantId: string, userId?: string): Promise<void> {
  if (userId) {
    await db.prepare(`DELETE FROM "user" WHERE id = ?`).bind(userId).run();
  }
  await db.prepare(`DELETE FROM tenants WHERE id = ?`).bind(tenantId).run();
}

function signupFailure(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("already exists") || message.includes("use another email")) {
    return { status: 409, message: "Email sudah terdaftar. Silakan masuk." };
  }
  if (message.includes("invalid email")) return { status: 400, message: "Enter a valid email address." };
  return { status: 500, message: "Store could not be created. Please try again." };
}

export async function handleSignupRequest(
  request: Request,
  auth: Auth,
  db: D1Database,
): Promise<Response> {
  let fields: SignupFields;
  try {
    fields = parseSignupFields(await request.json());
  } catch (error) {
    if (error instanceof SignupError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Invalid signup payload." }, { status: 400 });
  }

  let tenant: CreatedTenant | undefined;
  let userId: string | undefined;

  try {
    tenant = await createTenant(db, fields);

    const created = await auth.api.createUser({
      body: {
        email: fields.email,
        password: fields.password,
        name: fields.ownerName,
        role: "owner",
        data: { tenant_id: tenant.id },
      },
    });
    userId = created.user.id;

    const sessionResponse = await auth.api.signInEmail({
      body: { email: fields.email, password: fields.password },
      asResponse: true,
    });

    if (!sessionResponse.ok) {
      await rollbackSignup(db, tenant.id, userId);
      return Response.json({ error: "Store was created, but the owner session could not be started." }, { status: 500 });
    }

    return sessionResponse;
  } catch (error) {
    if (tenant) await rollbackSignup(db, tenant.id, userId);
    if (error instanceof SignupError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const failure = signupFailure(error);
    return Response.json({ error: failure.message }, { status: failure.status });
  }
}
