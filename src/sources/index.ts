import type { Source } from "../config/schema";
import type { SourceAdapter, RawItem } from "./types";
import { rssAdapter } from "./rss";

const adapters: Record<string, SourceAdapter> = {
  rss: rssAdapter,
};

export async function fetchAllSources(
  sources: Source[]
): Promise<{ items: RawItem[]; errors: string[] }> {
  const errors: string[] = [];
  const allItems: RawItem[] = [];

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
      allItems.push(item);
    }
  }

  return { items: allItems, errors };
}
