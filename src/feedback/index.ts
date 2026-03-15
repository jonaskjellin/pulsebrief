import {
  readBriefs,
  readFeedback,
  appendFeedback,
  type BriefRecord,
  type FeedbackRecord,
} from "../state";

export interface FeedbackEntry {
  brief_id: number;
  item_index: number;
  signal: "useful" | "not_useful" | "more_like_this" | "less_like_this";
  comment?: string;
}

export function submitFeedback(entry: FeedbackEntry): void {
  appendFeedback(entry);
}

export function getRecentFeedback(limit: number = 20): string {
  const feedback = readFeedback();
  const briefs = readBriefs();

  if (feedback.length === 0) return "";

  // Build a map of brief id -> content_json (rendered_md contains the markdown, but we
  // need the structured items). We stored rendered_md in briefs.json but not content_json.
  // Instead, we parse titles from the rendered_md or just use the feedback signals directly.
  // Since we don't have content_json in the new format, we'll show what we can.
  const briefMap = new Map<number, BriefRecord>();
  for (const b of briefs) {
    briefMap.set(b.id, b);
  }

  const recent = feedback
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  const lines = ["## Recent feedback from the reader"];
  for (const row of recent) {
    const brief = briefMap.get(row.brief_id);
    const briefLabel = brief ? `brief #${row.brief_id} (${brief.run_type})` : `brief #${row.brief_id}`;
    const line = `- Item ${row.item_index} in ${briefLabel}: ${row.signal}${row.comment ? ` — "${row.comment}"` : ""}`;
    lines.push(line);
  }

  return lines.join("\n");
}

export function listBriefs(limit: number = 5): { id: number; run_type: string; created_at: string; item_count: number }[] {
  const briefs = readBriefs();
  return briefs
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
    .map((b) => {
      // Count items by counting "### " headers in rendered markdown
      const itemCount = (b.rendered_md || "").split("\n").filter((l) => l.startsWith("### ")).length;
      return { id: b.id, run_type: b.run_type, created_at: b.created_at, item_count: itemCount };
    });
}

export function getBriefItems(briefId: number): { index: number; title: string; section: string }[] {
  const briefs = readBriefs();
  const brief = briefs.find((b) => b.id === briefId);

  if (!brief || !brief.rendered_md) return [];

  // Parse items from rendered markdown — each item is a "### " line under a "## Section" header
  const lines = brief.rendered_md.split("\n");
  const items: { index: number; title: string; section: string }[] = [];
  let currentSection = "";
  let itemIndex = 0;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      currentSection = line.replace("## ", "").trim();
    } else if (line.startsWith("### ")) {
      // Extract title — may be linked: ### [Title](url) or plain: ### Title
      const titleMatch = line.match(/^### \[(.+?)\]\(.+?\)$/) || line.match(/^### (.+)$/);
      const title = titleMatch ? titleMatch[1] : line.replace("### ", "");
      items.push({ index: itemIndex, title, section: currentSection });
      itemIndex++;
    }
  }

  return items;
}
