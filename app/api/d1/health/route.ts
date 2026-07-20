import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

type CountRow = {
  count: number;
};

async function countRows(db: D1Database, table: string): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first<CountRow>();
  return Number(row?.count ?? 0);
}

export async function GET() {
  const { env } = await getCloudflareContext({ async: true });

  if (!env.DB) {
    return Response.json(
      {
        ok: false,
        error: "D1 binding DB is not configured.",
      },
      { status: 500 },
    );
  }

  const [tenants, users, inventoryItems, customers, bookings, transactions] = await Promise.all([
    countRows(env.DB, "tenants"),
    countRows(env.DB, "users"),
    countRows(env.DB, "inventory_items"),
    countRows(env.DB, "customers"),
    countRows(env.DB, "bookings"),
    countRows(env.DB, "transactions"),
  ]);

  return Response.json({
    ok: true,
    database: "rentie-db",
    counts: {
      tenants,
      users,
      inventoryItems,
      customers,
      bookings,
      transactions,
    },
  });
}
