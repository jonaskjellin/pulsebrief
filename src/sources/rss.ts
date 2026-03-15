import RssParser from "rss-parser";
import type { Source } from "../config/schema";
import type { SourceAdapter, RawItem } from "./types";

const parser = new RssParser({
  timeout: 5000,
});

export const rssAdapter: SourceAdapter = {
  async fetch(source: Source): Promise<RawItem[]> {
    const feed = await parser.parseURL(source.url);
    return (feed.items || []).map((item) => ({
      title: item.title || "(untitled)",
      url: item.link || source.url,
      source_name: source.name,
      domain: source.domain,
      raw_content: item.contentSnippet || item.content || item.summary || "",
      published_at: item.isoDate || item.pubDate || null,
    }));
  },
};
