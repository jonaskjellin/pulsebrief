import type { Source } from "../config/schema";
import type { SourceAdapter, RawItem } from "./types";
import { rssAdapter } from "./rss";
import type Database from "better-sqlite3";

const adapters: Record<string, SourceAdapter> = {
  rss: rssAdapter,
};

export async function fetchAllSources(
  sources: Source[],
  db: Database.Database
): Promise<{ total: number; new: number; errors: string[] }> {
  const errors: string[] = [];
  let totalItems = 0;
  let newItems = 0;

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO items (url, title, source_name, domain, raw_content, published_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Fetch all sources in parallel with 8s hard timeout per source
  const SOURCE_TIMEOUT = 8000;

  const results = await Promise.allSettled(
    sources.map(async (source) => {
      const adapter = adapters[source.type];
      if (!adapter) {
        throw new Error(`No adapter for source type: ${source.type}`);
      }
      const items = await Promise.race([
        adapter.fetch(source),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), SOURCE_TIMEOUT)
        ),
      ]);
      console.log(`[fetch] ${source.name}: ${items.length} items`);
      return items;
    })
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const source = sources[i];
    if (result.status === "rejected") {
      const msg = `${source.name}: ${result.reason}`;
      console.error(`[fetch] Error — ${msg}`);
      errors.push(msg);
      continue;
    }

    for (const item of result.value) {
      totalItems++;
      const info = insertStmt.run(
        item.url,
        item.title,
        item.source_name,
        item.domain,
        item.raw_content,
        item.published_at
      );
      if (info.changes > 0) newItems++;
    }
  }

  return { total: totalItems, new: newItems, errors };
}
