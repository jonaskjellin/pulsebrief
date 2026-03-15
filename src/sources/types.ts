import type { Source } from "../config/schema";

export interface RawItem {
  title: string;
  url: string;
  source_name: string;
  domain: string;
  raw_content: string;
  published_at: string | null;
}

export interface SourceAdapter {
  fetch(source: Source): Promise<RawItem[]>;
}
