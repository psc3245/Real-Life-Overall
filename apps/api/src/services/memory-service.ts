import { sql } from "drizzle-orm";
import type { Database } from "../db/client";

export interface Memory {
  date: string;
  kind: "journal" | "recap";
  text: string;
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "been",
  "before",
  "being",
  "could",
  "didn",
  "does",
  "doing",
  "from",
  "have",
  "into",
  "just",
  "like",
  "more",
  "most",
  "much",
  "only",
  "other",
  "over",
  "really",
  "some",
  "than",
  "that",
  "their",
  "them",
  "then",
  "there",
  "they",
  "this",
  "today",
  "very",
  "were",
  "what",
  "when",
  "which",
  "while",
  "with",
  "would",
  "your",
  "yesterday",
]);

/**
 * Builds an OR query from the most distinctive words in `text` so a past day matches if it
 * shares any of them; ranking then favors days sharing more. Returns null if nothing usable.
 */
export function toSearchQuery(text: string, maxTerms = 16): string | null {
  const words = (text.toLowerCase().match(/[a-z][a-z0-9]{3,}/g) ?? []).filter(
    (w) => !STOP_WORDS.has(w),
  );
  const unique = [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, maxTerms);
  return unique.length ? unique.join(" | ") : null;
}

const MAX_SNIPPET = 400;

/**
 * Long-term memory (DESIGN.md §5.5): past journals and recap narratives that share words with
 * `text`, best matches first. Days on or after `before` are excluded (the caller already shows
 * recent days in full).
 */
export async function searchMemories(
  db: Database,
  userId: string,
  text: string,
  { before, limit = 5 }: { before: string; limit?: number },
): Promise<Memory[]> {
  const query = toSearchQuery(text);
  if (!query) return [];
  const result = await db.execute(sql`
    select date, kind, text from (
      select local_date::text as date, 'journal' as kind, journal as text,
             ts_rank(journal_search, to_tsquery('english', ${query})) as rank
        from day_logs
       where user_id = ${userId} and local_date < ${before}
         and journal_search @@ to_tsquery('english', ${query})
      union all
      select period_start::text, 'recap', narrative,
             ts_rank(narrative_search, to_tsquery('english', ${query}))
        from recaps
       where user_id = ${userId} and status = 'active' and kind = 'daily'
         and period_start < ${before}
         and narrative_search @@ to_tsquery('english', ${query})
    ) matches
    order by rank desc, date desc
    limit ${limit}
  `);
  // Both drivers (Neon, PGlite) return a pg-style result with `rows`.
  const rows = (result as unknown as { rows: Memory[] }).rows;
  return rows.map((r) => ({
    date: r.date,
    kind: r.kind,
    text: r.text.length > MAX_SNIPPET ? `${r.text.slice(0, MAX_SNIPPET)}…` : r.text,
  }));
}

export function renderMemories(memories: Memory[]): string {
  return memories.map((m) => `- ${m.date} (${m.kind}): ${m.text.replace(/\s+/g, " ")}`).join("\n");
}
