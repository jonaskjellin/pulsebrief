import type Database from "better-sqlite3";

export interface FeedbackEntry {
  brief_id: number;
  item_index: number;
  signal: "useful" | "not_useful" | "more_like_this" | "less_like_this";
  comment?: string;
}

export function submitFeedback(db: Database.Database, entry: FeedbackEntry): void {
  db.prepare(
    `INSERT INTO feedback (brief_id, item_index, signal, comment) VALUES (?, ?, ?, ?)`
  ).run(entry.brief_id, entry.item_index, entry.signal, entry.comment || null);
}

export function getRecentFeedback(db: Database.Database, limit: number = 20): string {
  const rows = db
    .prepare(
      `SELECT f.signal, f.comment, b.run_type,
              json_extract(b.content_json, '$[' || f.item_index || '].title') as item_title,
              json_extract(b.content_json, '$[' || f.item_index || '].section') as item_section
       FROM feedback f
       JOIN briefs b ON b.id = f.brief_id
       ORDER BY f.created_at DESC
       LIMIT ?`
    )
    .all(limit) as { signal: string; comment: string | null; item_title: string; item_section: string }[];

  if (rows.length === 0) return "";

  const lines = ["## Recent feedback from the reader"];
  for (const row of rows) {
    const line = `- "${row.item_title}" (${row.item_section}): ${row.signal}${row.comment ? ` — "${row.comment}"` : ""}`;
    lines.push(line);
  }

  return lines.join("\n");
}

export function listBriefs(db: Database.Database, limit: number = 5): { id: number; run_type: string; created_at: string; item_count: number }[] {
  return db
    .prepare(
      `SELECT id, run_type, created_at,
              json_array_length(content_json) as item_count
       FROM briefs
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit) as { id: number; run_type: string; created_at: string; item_count: number }[];
}

export function getBriefItems(db: Database.Database, briefId: number): { index: number; title: string; section: string }[] {
  const brief = db
    .prepare(`SELECT content_json FROM briefs WHERE id = ?`)
    .get(briefId) as { content_json: string } | undefined;

  if (!brief) return [];

  const items = JSON.parse(brief.content_json) as { title: string; section: string }[];
  return items.map((item, i) => ({ index: i, title: item.title, section: item.section }));
}
