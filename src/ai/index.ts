import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { buildPersonaContext } from "../persona";
import { getRecentFeedback } from "../feedback";
import { getLastCoversUntil, getRecentBriefsMd } from "../state";
import type { Persona, Settings } from "../config/schema";
import type { NormalizedItem } from "../normalize";

export const SECTIONS = ["cyber", "ai", "tech", "business"] as const;
export type Section = typeof SECTIONS[number];

export const SECTION_LABELS: Record<Section, string> = {
  cyber: "Cyber Security",
  ai: "AI & Machine Learning",
  tech: "Technology",
  business: "Business & Markets",
};

export interface BriefItem {
  section: Section;
  title: string;
  body: string;
  why: string;
  date: string;
  sources: { name: string; url: string }[];
}

interface GenerateBriefInput {
  items: NormalizedItem[];
  persona: Persona;
  settings: Settings;
  since?: Date;
  until?: Date;
}

export async function generateBrief(input: GenerateBriefInput): Promise<BriefItem[]> {
  const { items: allItems, persona, settings, since, until } = input;

  // Determine the time window
  let sinceTimestamp: string;
  if (since) {
    sinceTimestamp = since.toISOString();
    console.log(`[ai] Items published since ${since.toLocaleString()}`);
  } else {
    // Default: since last brief's anchor time, or last 24h on first run
    const lastCoversUntil = getLastCoversUntil();
    if (lastCoversUntil) {
      sinceTimestamp = lastCoversUntil;
      console.log(`[ai] Items since ${new Date(sinceTimestamp).toLocaleString()}`);
    } else {
      sinceTimestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      console.log(`[ai] First run — items from last 24h`);
    }
  }

  const untilTimestamp = until ? until.toISOString() : new Date().toISOString();

  // Filter items by time window
  const items = allItems.filter((item) => {
    if (!item.published_at) return true; // Include items with unknown dates
    return item.published_at > sinceTimestamp && item.published_at <= untilTimestamp;
  });

  // Count how many different sources cover similar stories (simple title similarity)
  const itemsWithCount = items.map((item) => {
    const titleWords = new Set(item.title.toLowerCase().split(/\s+/).filter(w => w.length > 4));
    let overlap = 0;
    for (const other of items) {
      if (other.url === item.url) continue;
      if (other.source_name === item.source_name) continue;
      const otherWords = new Set(other.title.toLowerCase().split(/\s+/).filter(w => w.length > 4));
      const common = [...titleWords].filter(w => otherWords.has(w)).length;
      if (common >= 2) overlap++;
    }
    return { ...item, source_count: overlap + 1 };
  });

  if (itemsWithCount.length === 0) {
    console.log("[ai] No items to process");
    return [];
  }

  const multiSource = itemsWithCount.filter(i => i.source_count > 1).length;
  console.log(`[ai] Processing ${itemsWithCount.length} items (${multiSource} covered by multiple sources)`);

  // Get recent briefs for context from state files
  const recentBriefs = getRecentBriefsMd(3);

  const personaContext = buildPersonaContext(persona);
  const feedbackContext = getRecentFeedback();
  const systemPrompt = buildSystemPrompt({
    personaContext,
    items: itemsWithCount,
    recentBriefs,
    feedbackContext,
  });
  const userPrompt = buildUserPrompt(itemsWithCount);

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const client = new Anthropic();

  const response = await client.messages.create({
    model: settings.ai.model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse JSON response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("[ai] Failed to parse AI response as JSON");
    console.error("[ai] Raw response:", text.slice(0, 500));
    return [];
  }

  const briefItems: BriefItem[] = JSON.parse(jsonMatch[0]);
  console.log(`[ai] Brief generated: ${briefItems.length} items`);

  return briefItems;
}
