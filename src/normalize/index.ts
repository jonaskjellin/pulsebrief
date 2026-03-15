import type Database from "better-sqlite3";

// Strip HTML tags and decode common entities
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Truncate content to a reasonable length for the AI layer
function truncate(text: string, maxLength: number = 2000): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function normalizeItems(db: Database.Database): { normalized: number; skipped: number } {
  const unnormalized = db
    .prepare("SELECT id, raw_content FROM items WHERE normalized = 0")
    .all() as { id: number; raw_content: string }[];

  let normalized = 0;
  let skipped = 0;

  const updateStmt = db.prepare(
    "UPDATE items SET content = ?, normalized = 1 WHERE id = ?"
  );

  for (const item of unnormalized) {
    const cleaned = truncate(stripHtml(item.raw_content || ""));
    if (!cleaned) {
      skipped++;
      // Still mark as normalized so we don't reprocess
      updateStmt.run("", item.id);
      continue;
    }
    updateStmt.run(cleaned, item.id);
    normalized++;
  }

  return { normalized, skipped };
}

export function getDeduplicationStats(db: Database.Database): { total: number; unique_urls: number } {
  const total = (db.prepare("SELECT COUNT(*) as c FROM items").get() as { c: number }).c;
  // URL dedup is handled by the UNIQUE constraint on insert — all items are already unique by URL
  return { total, unique_urls: total };
}
