import type { RawItem } from "../sources/types";

export interface NormalizedItem {
  title: string;
  url: string;
  source_name: string;
  domain: string;
  content: string;
  published_at: string | null;
}

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

export function normalizeItems(rawItems: RawItem[]): { items: NormalizedItem[]; normalized: number; skipped: number } {
  const items: NormalizedItem[] = [];
  let normalized = 0;
  let skipped = 0;

  // Deduplicate by URL
  const seen = new Set<string>();

  for (const raw of rawItems) {
    if (seen.has(raw.url)) {
      skipped++;
      continue;
    }
    seen.add(raw.url);

    const cleaned = truncate(stripHtml(raw.raw_content || ""));
    if (!cleaned) {
      skipped++;
      continue;
    }

    items.push({
      title: raw.title,
      url: raw.url,
      source_name: raw.source_name,
      domain: raw.domain,
      content: cleaned,
      published_at: raw.published_at,
    });
    normalized++;
  }

  return { items, normalized, skipped };
}
