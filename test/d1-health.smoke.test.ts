import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

/**
 * Guards the /api/d1/health count seam: the endpoint counts identity rows from
 * the better-auth `user` table (ADR-0001), not a standalone `users` table.
 * `user` is a reserved keyword, so the count query must quote it.
 */
describe("d1 health count seam", () => {
  it("counts the quoted `user` identity table", async () => {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) AS count FROM "user"`,
    ).first<{ count: number }>();

    expect(Number(row?.count ?? -1)).toBe(0);
  });

  it("would fail against the removed `users` table", async () => {
    await expect(
      env.DB.prepare(`SELECT COUNT(*) AS count FROM users`).first(),
    ).rejects.toThrow(/no such table: users/);
  });
});
