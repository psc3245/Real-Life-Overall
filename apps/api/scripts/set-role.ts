/**
 * Grants or removes the admin role (DESIGN.md §8.7):
 *   npm run set-role -w @rlo/api -- you@example.com admin
 *   npm run set-role -w @rlo/api -- username user
 * Uses DATABASE_URL from apps/api/.env.
 */
import { eq, or } from "drizzle-orm";
import { createNeonDb } from "../src/db/client";
import { users } from "../src/db/schema";

const [who, role = "admin"] = process.argv.slice(2);
if (!who || (role !== "admin" && role !== "user")) {
  console.error("Usage: npm run set-role -w @rlo/api -- <email or username> [admin|user]");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (apps/api/.env)");
  process.exit(1);
}
const { db, dispose } = createNeonDb(url);
const rows = await db
  .update(users)
  .set({ role })
  .where(or(eq(users.email, who), eq(users.username, who.toLowerCase())))
  .returning({ username: users.username, email: users.email, role: users.role });
await dispose();
if (!rows.length) {
  console.error(`No user with email or username "${who}"`);
  process.exit(1);
}
for (const r of rows) console.log(`${r.username} (${r.email}) is now ${r.role}`);
